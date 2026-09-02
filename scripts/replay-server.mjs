/**
 * A local stand-in for the RGS replay endpoint, so a specific round can be
 * replayed on localhost without the game being uploaded to Stake.
 *
 *   node scripts/replay-server.mjs
 *
 * PLAIN HTTP, which needs one line of help from the frontend. rgsFetcher.ts
 * hardcodes the scheme - `rgs_url=localhost:3010` is fetched as
 * `https://localhost:3010/...` - so this used to serve TLS with a self-signed
 * certificate. That was a trap: the browser silently refuses such a fetch until
 * someone has visited the origin and clicked through a warning, and in a dev
 * build the resulting failure is INVISIBLE, because Game.svelte clears error
 * modals when there is no session. The symptom was the replay hanging on
 * "Loading replay..." with no clue why.
 *
 * rgsFetcher.ts now uses http for loopback hosts in dev builds only - see the
 * LOCAL ADDITION note there. Nothing to trust, nothing to click.
 *
 * It reads the real published books, so what it replays is exactly what the RGS
 * would replay: same events, same payout, same book id.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { createZstdDecompress } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLISH = path.join(
  ROOT,
  'math-sdk/games/ride_the_bus/library/publish_files',
);
const PORT = Number(process.env.REPLAY_PORT || 3010);
const GAME_PORT = Number(process.env.GAME_PORT || 3001);

if (!existsSync(PUBLISH)) {
  console.error(`No published math at ${PUBLISH}`);
  console.error('Run the math build first, or check out a commit that has it.');
  process.exit(1);
}

const index = JSON.parse(readFileSync(path.join(PUBLISH, 'index.json'), 'utf8'));
const MODES = new Map(index.modes.map((m) => [m.name, m]));

/**
 * bustwin / forgiven, precomputed by scripts/replay-events.js at the end of
 * every math build. See the note by BOOK_ALIASES below.
 *
 * Absent on a checkout predating that generator change, or if the build's
 * best-effort call to it failed. Then the scan path takes over, so the tool
 * still works - just slowly, and the first time per mode.
 */
/**
 * bustwin / forgiven, read out of REPLAY_EVENTS.md.
 *
 * That file is the build's own record - scripts/replay-events.js writes it from
 * the published books and run.py calls that at the end of every math build, so
 * it is regenerated exactly when it would otherwise go stale. Parsing it here
 * means this server does NO book scanning: it used to stream a 215k-round file
 * on demand the first time either scenario was asked for, which put minutes of
 * work behind a dev server start.
 *
 * Rows look like:
 *   | `mode_name` | 0 | 85 (7.20x) | 20751 (1260.00x) | 975 (1354.20x) | 1393 (129.00x) | - (-) |
 *
 * A `-` is a real answer meaning "this mode has none", and it has to survive as
 * null rather than be dropped - the builder greys the button out on it, which
 * is the difference between telling someone a round does not exist and letting
 * them build a link that 404s.
 */
const SCENARIOS = (() => {
  // Overridable so the parser can be exercised against a fixture without
  // touching the generated file, which is never hand-edited.
  const file = process.env.REPLAY_EVENTS_MD || path.join(ROOT, 'REPLAY_EVENTS.md');
  const byMode = new Map();
  if (!existsSync(file)) {
    console.log('No REPLAY_EVENTS.md - no scenarios to offer.');
    console.log('Generate it with: node scripts/replay-events.js');
    return byMode;
  }

  // "1393 (129.00x)" -> { id, payout }, payout in the CSV's raw units.
  // "-" and "- (-)" are real answers meaning this mode has no such round.
  const cell = (text) => {
    const match = /^(\d+)\s*\(([\d.]+)x\)$/.exec(text.trim());
    return match ? { id: Number(match[1]), payout: Math.round(Number(match[2]) * 100) } : null;
  };

  const text = readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').map((c) => c.trim());
    // ['', '`mode`', loss, normal, big, cap, bustwin?, forgiven?, '']
    if (cells.length < 7) continue;
    const mode = cells[1].split('`').join('');
    const lossId = Number(cells[2]);
    byMode.set(mode, {
      loss: Number.isInteger(lossId) ? { id: lossId, payout: 0 } : null,
      win: cell(cells[3]),
      big: cell(cells[4]),
      max: cell(cells[5]),
      // undefined, not null: the columns are absent on a table generated before
      // they existed, and "no column" has to be distinguishable from "no such
      // round" - one is fixed by regenerating, the other never will be.
      bustwin: cells.length >= 9 ? cell(cells[6]) : undefined,
      forgiven: cells.length >= 9 ? cell(cells[7]) : undefined,
    });
  }
  console.log(`Scenarios for ${byMode.size} modes, from REPLAY_EVENTS.md`);
  return byMode;
})();

const familyOf = (name) =>
  name.startsWith('sc_') ? 'sc' : name.startsWith('hs_') ? 'hs' : 'base';

/* ---- Scenarios -----------------------------------------------------------
   `event` is normally a simulation ID straight out of REPLAY_EVENTS.md, but
   one of these four names resolves it from the mode's lookup table using the
   SAME rules scripts/replay-events.js documents - so `event=max` always lands
   that mode's ceiling without looking anything up.

   Only rows with a NON-ZERO weight are considered. A zero-weight row exists in
   the table but can never be drawn, so replaying one would be replaying a round
   that cannot happen.

   Payouts stay in RAW UNITS here (100 = 1.00x), matching the CSV; the division
   happens once, at the point of display or of serving. */
const ALIASES = ['max', 'big', 'win', 'loss'];

/* ---- Scenarios that need the BOOKS, not just the lookup table ------------
   The four above are answered from the CSV, which is three columns and instant.
   These two are about the SHAPE of a round rather than its payout - whether it
   busted, whether it spent a Second Chance - and that lives in the book events.

     bustwin   Busted, and still paid enough to take the screen over. A round
               does not have to be a full game win to celebrate: a bust on the
               last card keeps its retention of a multiplier that may already be
               large, and Classic reaches 129x that way.

     forgiven  Second Chance only: the round spent its forgiveness, survived,
               and finished big enough to celebrate. The case the clean-sweep
               rule deliberately does not floor.

   THIS SERVER DOES NOT SCAN FOR THEM. It reads them out of REPLAY_EVENTS.md,
   which the math build writes (run.py calls scripts/replay-events.js at the
   end). An earlier pass resolved them here by streaming the book file on
   demand; it worked, but it put minutes of work behind a dev server and made a
   mode with no such round pay for a full 215k-row pass to discover that. The
   answer belongs in the build that produced the books, not in the tool that
   reads them. See SCENARIOS at the top of this file. */
const BOOK_ALIASES = ['bustwin', 'forgiven'];

/**
 * The music candidates, read out of the app rather than duplicated here.
 *
 * This is a standalone dev script with no build step, so it cannot import from
 * the app - the same constraint that gives CUR its own copy of the currency
 * list. A regex over the manifest is the cheap half-measure: it means a fifth
 * candidate shows up on this page without anyone remembering to add it, and if
 * musicTracks.ts is ever reshaped the worst case is an empty picker and a link
 * with no dev_music on it, which is just the default track.
 */
function musicTracks() {
  const file = path.join(
    ROOT,
    "web-sdk/apps/Ride-The-Bus/src/game/musicTracks.ts",
  );
  if (!existsSync(file)) return [];
  const src = readFileSync(file, "utf8");
  const out = [];
  const re = /id:\s*'([a-z0-9-]+)',[\s\S]{0,400}?label:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) out.push([m[1], m[2]]);
  return out;
}

function scenariosFor(mode) {
  return SCENARIOS.get(mode) ?? {};
}

/**
 * Every mode's four scenarios, and which mode carries each FAMILY's ceiling.
 *
 * Lazy, and cached after the first call. The scan reads all 192 lookup tables
 * and takes about ten seconds; only the landing page needs it, and replaying a
 * round by ID does not, so paying for it at boot would delay the server coming
 * up for the common case.
 *
 * The family ceiling is worth surfacing because `max` is easy to misread: it is
 * the cap of the ONE GUESS COMBINATION named in the URL, not the family's
 * headline figure. Most of a family's 64 combinations stop well short (Classic's
 * lowest cap is 68.20x against a family ceiling of 1354.20x), and only the mode
 * that actually reaches the ceiling fires the MAX WIN tier, because winTierFor
 * matches that band on equality.
 */
function scenarios() {
  const byMode = {};
  const familyCeiling = {};
  for (const mode of index.modes) {
    const s = scenariosFor(mode.name);
    byMode[mode.name] = s;
    const fam = familyOf(mode.name);
    const cap = s.max ? s.max.payout : 0;
    if (!familyCeiling[fam] || cap > familyCeiling[fam].cap) {
      familyCeiling[fam] = { mode: mode.name, cap };
    }
  }
  return { byMode, familyCeiling };
}

function resolveAlias(mode, alias) {
  const picked = scenariosFor(mode)[alias];
  return picked ? picked.id : null;
}

/* ---- Book lookup ---------------------------------------------------------
   Streamed and stopped on the match rather than decompressed whole: one mode is
   215k rounds, which blows past V8's maximum string length. Same approach as
   payout.test.ts. */
async function findBook(mode, id) {
  const file = path.join(PUBLISH, MODES.get(mode).events);
  const stream = createReadStream(file).pipe(createZstdDecompress());
  const lines = createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      const book = JSON.parse(line);
      if (book.id === id) return book;
      // Books are written in ascending id order, so once we are past it the
      // record is not in this file.
      if (book.id > id) return null;
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return null;
}

/* ---- HTTP ---------------------------------------------------------------- */
const json = (res, status, body) => {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
  });
  res.end(JSON.stringify(body));
};

/* ---- The link builder ----------------------------------------------------
   Modelled on the game's own guess row rather than on a dropdown of 192 slugs:
   pick a family, then a colour, a higher/lower, an inside/outside and a suit,
   exactly as a player does. The mode name is assembled from the picks, which is
   what modeName() does on the client and mode_name does in the math.

   Equal-then-Inside is disabled, because nothing falls strictly between two
   cards of the same rank - the same rule isCombinationPlayable enforces, and
   why there are 64 playable combinations per family rather than 72.

   Each round button carries the multiplier and simulation ID it would replay
   FOR THE MODE CURRENTLY PICKED, so the consequence of a pick is visible before
   the link is opened rather than after. */
function landingPage() {
  const { byMode, familyCeiling } = scenarios();

  const ceilings = ['base', 'sc', 'hs']
    .map((f) => {
      const c = familyCeiling[f];
      return `<li><code>${c.mode}</code> &mdash; ${(c.cap / 100).toFixed(2)}x</li>`;
    })
    .join('');

  return `<!doctype html><meta charset="utf-8"><title>Ride The Bus - local replay</title>
<style>
  :root{color-scheme:dark}
  body{font:15px/1.6 system-ui,sans-serif;max-width:60rem;margin:2.5rem auto;padding:0 1.5rem;
       background:#141714;color:#e8e0d0}
  h1{font-size:1.35rem;margin:0 0 .2rem}
  p{color:#a8b0a4;margin:.5rem 0}
  code{color:#ffe08a;font:12.5px ui-monospace,monospace}
  .grid{display:grid;grid-template-columns:8rem 1fr;gap:.55rem 1rem;align-items:center;margin:1.3rem 0}
  .lab{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:#8b9488}
  .row{display:flex;flex-wrap:wrap;gap:.4rem;align-items:stretch}
  button.pick{background:#1e2220;color:#c8d0c4;border:1px solid #39423a;border-radius:8px;
       padding:.42rem .85rem;font:600 13px system-ui,sans-serif;cursor:pointer;text-align:center}
  button.pick:hover:not([disabled]){border-color:#5d6a5c}
  button.pick[aria-pressed=true]{background:#2c3a2e;border-color:#7cffb2;color:#fff;
       box-shadow:0 0 0 1px #7cffb2 inset}
  button.pick[disabled]{opacity:.28;cursor:not-allowed}
  /* ---- The game's own colours, on the page that builds a link into it ------
     Red and Black were already painted this way and the other three rows were
     not, so half the picker spoke the game's language and half spoke the
     page's generic green. Every value below is copied from the app's
     styles/tokens.css by name, so a change there has one place to be mirrored:

       --choice-higher  #2ecc71   --choice-lower   #c0392b
       --choice-inside  #00bcd4   --choice-outside #d81ce0
       --choice-equal   #f1c40f   --suit-red       #e74c3c
       --card-red       #b3252b

     Same treatment as the replay-info badges inside the game, and for the same
     reason recorded in CLAUDE.md: the one screen whose whole job is to restate
     the bet should not restate it in colours the player has never seen.

     Each selected chip is the choice colour as a rim and a wash of it as a
     fill, so the row reads at a glance without turning into four solid blocks.

     The ink stays LIGHT on all of them, unlike the app. The app flips to a dark
     --on-choice-ink because its fills are the colour at full strength - a solid
     yellow square. These are 26% of it over near-black, so every fill here is
     dark and a dark ink on top was unreadable: the selected "Equal" came out
     near-black type on a dark olive. Same colour, different ground, opposite
     answer. */
  button.pick[aria-pressed=true][data-c]{
       background:color-mix(in srgb, var(--pick-c) 26%, #14170f);
       border-color:var(--pick-c);
       color:#fff;
       box-shadow:0 0 0 1px var(--pick-c) inset}
  button.pick[aria-pressed=true][data-c] .mult{color:#ffe08a;opacity:.9}

  /* The three families take their own volatility rating's colour - the same
     --vol-base / --vol-sc / --vol-hs the MODE button and the mode picker wear
     in the game, and the same ramp the bolt meters spend. Classic yellow,
     Second Chance green, High Stakes red. */
  button.pick.fam-base{--pick-c:#ffc93c}
  button.pick.fam-sc{--pick-c:#3ddc84}
  button.pick.fam-hs{--pick-c:#ff5c5c}

  button.pick.red{--pick-c:#b3252b}
  button.pick.blk{--pick-c:#cfd6e4}
  button.pick.higher{--pick-c:#2ecc71}
  button.pick.lower{--pick-c:#c0392b}
  button.pick.inside{--pick-c:#00bcd4}
  button.pick.outside{--pick-c:#d81ce0}
  button.pick.equal{--pick-c:#f1c40f}
  /* The four suits take the card face's own two inks: hearts and diamonds
     red, clubs and spades the dark the pips are printed in. */
  button.pick.suit-red{--pick-c:#e74c3c}
  button.pick.suit-blk{--pick-c:#cfd6e4}

  /* An unselected chip carries NO colour at all - it is the plain grey border
     every other button has. A tinted hairline on all twelve was tried and made
     the row read as twelve half-selected things; the colour has to mean
     "picked" or it means nothing. Hover still previews it. */
  button.pick[data-c]:not([aria-pressed=true]):hover:not([disabled]){
       border-color:var(--pick-c)}
  button.pick .mult{display:block;font:500 11px ui-monospace,monospace;color:#8b9488;margin-top:.12rem}
  button.pick[aria-pressed=true] .mult{color:#ffe08a}
  select,input{background:#1e2220;color:#e8e0d0;border:1px solid #39423a;border-radius:8px;
       padding:.44rem .6rem;font:13px ui-monospace,monospace}
  a.out{display:block;word-break:break-all;background:#1a1f1c;border:1px solid #3a423a;
       border-radius:10px;padding:.9rem 1rem;margin-top:.3rem;color:#ffe08a;text-decoration:none;
       font:12.5px ui-monospace,monospace}
  a.out:hover{border-color:#7cffb2}
  .note{font-size:13px;color:#8b9488} .note b{color:#c8d0c4}
  ul.note{margin:.2rem 0 0 1.1rem}
  .modeline{font:12.5px ui-monospace,monospace;color:#7cffb2;margin:.2rem 0 .1rem}
  hr.sep{border:0;border-top:1px solid #2a312a;margin:2.6rem 0 1.7rem}
  h2{font-size:1.15rem;margin:0 0 .2rem}
</style>
<h1>Ride The Bus &mdash; local replay</h1>
<p>Build a replay link the way the game builds a bet: pick a mode, then four guesses.
   For the ordinary game with no round to replay, skip to
   <a href="#plain" style="color:#7cffb2">Regular game</a> at the bottom.</p>

<div class=grid>
  <span class=lab>Mode</span><div class=row id=fam></div>
  <span class=lab>Colour</span><div class=row id=color></div>
  <span class=lab>Higher / Lower</span><div class=row id=hl></div>
  <span class=lab>Inside / Outside</span><div class=row id=io></div>
  <span class=lab>Suit</span><div class=row id=suit></div>
  <span class=lab>Round</span><div class=row id=ev></div>
  <span class=lab>Currency</span>
  <div class=row>
    <select id=cur title="currency code"></select>
    <input id=amt value="1" size=6 title="bet amount, in display units">
    <select id=lang title="language"></select>
  </div>
  <span class=lab>Game port</span>
  <div class=row>
    <input id=port value="${GAME_PORT}" size=6 inputmode=numeric
           title="the port the game's dev server is on - vite picks the next free one if 3001 is taken">
    <span class=note style="margin:0">vite moves to 3002+ when 3001 is busy. Remembered in this browser.</span>
  </div>
</div>

<p class=modeline id=modeline></p>
<a class=out id=out target=_blank></a>

<p class=note style="margin-top:1.7rem"><b>&ldquo;Max&rdquo; is that MODE's cap, not the family's.</b>
   Each mode is one guess combination and most stop well short. Only these three
   reach their family ceiling, so only these fire the <b>MAX WIN</b> tier:</p>
<ul class=note>${ceilings}</ul>

<hr class=sep>

<h2 id=plain>Regular game &mdash; no replay</h2>
<p>The ordinary game, with <b>no RGS behind it at all</b>. Nothing below touches this
   server: with no <code>sessionID</code> the client deals its own cards from
   <code>game/localRound.ts</code> and prices its own stages, and the bet is set on the
   bar rather than in the link. That is a DEV-only path &mdash; Game.svelte imports it
   from inside an <code>import.meta.env.DEV</code> branch, so it is dropped from a
   production build.</p>

<div class=grid>
  <span class=lab>Currency</span>
  <div class=row>
    <select id=pcur title="currency code"></select>
    <select id=plang title="language"></select>
  </div>
  <span class=lab>Social mode</span><div class=row id=psocial></div>
  <span class=lab>Music</span><div class=row id=pmusic></div>
</div>

<a class=out id=pout target=_blank></a>

<p class=note style="margin-top:1.2rem"><b>Social mode</b> is Stake.US: it forces English
   whatever the language picker says, and swaps the restricted gambling terms out. The
   three <code>X</code> currencies (Gold Coins, Stake Cash, Stake Euro Cash) are the ones
   that go with it.</p>
<p class=note><b>Music</b> picks a candidate from <code>game/musicTracks.ts</code> without
   editing <code>ACTIVE_TRACK_ID</code>. Add <code>&amp;dev_loop=40,70,4</code> by hand to
   shorten the loop region so the seam comes round every 26s instead of every five
   minutes.</p>
<p class=note>Any other <code>dev_*</code> override can be appended by hand &mdash;
   <code>dev_minBet</code>, <code>dev_maxBet</code>, <code>dev_stepBet</code>,
   <code>dev_disabledTurbo</code>, <code>dev_disabledAutoplay</code>,
   <code>dev_minimumRoundDuration</code>, <code>dev_displayRTP</code>. Without bet limits
   every helper in <code>betLimits.ts</code> correctly reads
   <code>{0,0,0}</code> as unconstrained.</p>

<script>
const SC = ${JSON.stringify(byMode)};
const GAME_PORT = ${GAME_PORT};
const RGS = 'localhost:${PORT}';

const state = { fam:'hs_', color:'red', hl:'equal', io:'equal', suit:'heart',
                ev:'max', cur:'USD', lang:'en' };

const FAM  = [['','Classic','fam-base'],['sc_','Second Chance','fam-sc'],
              ['hs_','High Stakes','fam-hs']];
/* Third entry is the colour class - see the button.pick rules in the stylesheet
   above, which take their values from the game's own tokens.css. */
const COL  = [['red','Red','red'],['black','Black','blk']];
const HL   = [['higher','Higher','higher'],['lower','Lower','lower'],['equal','Equal','equal']];
const IO   = [['inside','Inside','inside'],['outside','Outside','outside'],['equal','Equal','equal']];
const SUIT = [['heart','♥ Heart','suit-red'],['diamond','♦ Diamond','suit-red'],
              ['club','♣ Club','suit-blk'],['spade','♠ Spade','suit-blk']];

const EV   = [['max','Max'],['big','Big'],['win','Win'],['loss','Loss'],
              ['bustwin','Bust + win'],['forgiven','2nd chance']];
// The two scenarios that come from REPLAY_EVENTS.md rather than from a lookup
// table. Same shape as the other four here - the server has already read them -
// so the only thing this list is for is telling apart "no such round in this
// mode" (grey the button out) from "the table predates these columns".
const SCAN_EV = ['bustwin', 'forgiven'];
/* Every currency the RGS can send, in the Stake Engine dashboard's own order,
   with its dashboard name. This page had fourteen of them, which meant the
   shapes that actually break a layout - a weak unit with a twelve-figure
   settled win, a three-letter code where a symbol is expected - could not be
   reached from here at all.

   Kept in step with web-sdk/apps/Ride-The-Bus/src/game/currencies.ts, which is
   the copy the game's own tests walk. This file is a standalone dev script with
   no build step, so it cannot import from the app - hence a second list rather
   than one. currencies.test.ts pins the app's; this comment is the pointer. */
const CUR = [
  ['USD','United States Dollar'],['CAD','Canadian Dollar'],['JPY','Japanese Yen'],
  ['EUR','Euro'],['RUB','Russian Ruble'],['CNY','Chinese Yuan'],
  ['PHP','Philippine Peso'],['INR','Indian Rupee'],['IDR','Indonesian Rupiah'],
  ['KRW','South Korean Won'],['BRL','Brazilian Real'],['MXN','Mexican Peso'],
  ['DKK','Danish Krone'],['PLN','Polish Zloty'],['VND','Vietnamese Dong'],
  ['TRY','Turkish Lira'],['CLP','Chilean Peso'],['ARS','Argentine Peso'],
  ['PEN','Peruvian Sol'],['NGN','Nigerian Naira'],['SAR','Saudi Riyal'],
  ['ILS','Israeli New Shekel'],['AED','UAE Dirham'],['TWD','Taiwan New Dollar'],
  ['NOK','Norwegian Krone'],['KWD','Kuwaiti Dinar'],['JOD','Jordanian Dinar'],
  ['CRC','Costa Rican Colon'],['TND','Tunisian Dinar'],['SGD','Singapore Dollar'],
  ['MYR','Malaysian Ringgit'],['OMR','Omani Rial'],['QAR','Qatari Riyal'],
  ['BHD','Bahraini Dinar'],['PKR','Pakistani Rupee'],['EGP','Egyptian Pound'],
  ['NZD','New Zealand Dollar'],['BOB','Bolivian Boliviano'],['GHS','Ghanaian Cedi'],
  ['KES','Kenyan Shilling'],['MAD','Moroccan Dirham'],
  ['BAM','Bosnia and Herzegovina Convertible Mark'],['ISK','Icelandic Krona'],
  ['TZS','Tanzanian Shilling'],['UGX','Ugandan Shilling'],['XOF','West African CFA Franc'],
  ['XGC','Gold Coins (social)'],['XSC','Stake Cash (social)'],['XEC','Stake Euro Cash (social)'],
];
const LANG = ['en','ar','de','es','fi','fr','hi','id','ja','ko','pl','pt','ru','tr','vi','zh'];

const modeName = () =>
  state.fam + state.color + '_' + state.hl + '_' + state.io + '_' + state.suit;

// Equal-then-Inside is not a published mode: nothing falls strictly between two
// cards of the same rank.
const insideBlocked = () => state.hl === 'equal';

// Only Second Chance can produce a forgiven round - the other two families bust
// on the first miss. Disabled rather than merely labelled, for the same reason
// Inside is: a pick that cannot be honoured must not be buildable into a link.
// Leaving it selectable produced a URL the server answers with a 404, which is
// a worse way to learn this than a greyed-out button.
const forgivenBlocked = () => state.fam !== 'sc_';

/* A scanned scenario this mode has no round for.
   sc_red_lower_outside_heart has no drawable bust-win, for instance: in
   Second Chance a bust needs TWO misses, and by then the multiplier rarely
   survives above the celebration floor. The button showed "none" and stayed
   clickable, so the link still went out and the game opened an error modal
   reading "RGS responded 404". Showing the answer is not the same as refusing
   the pick - the same lesson as Equal-then-Inside, learned twice. */
const scenarioMissing = (v) => SCAN_EV.indexOf(v) >= 0 && !(SC[modeName()] || {})[v];

function fill(id, items, key, multFor) {
  const host = document.getElementById(id);
  host.textContent = '';
  for (const [val, label, cls] of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (cls ? ' ' + cls : '');
    if (cls) b.setAttribute('data-c', '');
    b.setAttribute('aria-pressed', String(state[key] === val));
    if (id === 'io' && val === 'inside' && insideBlocked()) b.disabled = true;
    if (id === 'ev' && val === 'forgiven' && forgivenBlocked()) b.disabled = true;
    if (id === 'ev' && scenarioMissing(val)) b.disabled = true;
    const mult = multFor ? multFor(val) : null;
    b.textContent = label;
    if (mult) {
      const span = document.createElement('span');
      span.className = 'mult';
      span.textContent = mult;
      b.appendChild(span);
    }
    b.onclick = () => { state[key] = val; render(); };
    host.appendChild(b);
  }
}

function render() {
  // Repair an impossible pick rather than let it build an unpublished mode -
  // the same guard the game applies when Equal takes Inside away.
  if (insideBlocked() && state.io === 'inside') state.io = 'equal';
  // Same for a forgiven round on a family that cannot forgive: switching away
  // from Second Chance must not leave a dead scenario selected.
  if (forgivenBlocked() && state.ev === 'forgiven') state.ev = 'max';
  // And for a scenario the newly-picked mode has no round for. This fires on a
  // GUESS change as well as a family change - "Bust + win" exists in one mode
  // and not the next, so the pick has to be re-checked every render.
  if (scenarioMissing(state.ev)) state.ev = 'max';

  const mode = modeName();
  const sc = SC[mode];

  fill('fam', FAM, 'fam');
  fill('color', COL, 'color');
  fill('hl', HL, 'hl');
  fill('io', IO, 'io');
  fill('suit', SUIT, 'suit');
  fill('ev', EV, 'ev', (v) => {
    if (v === 'forgiven' && forgivenBlocked()) return 'sc only';
    const s = sc && sc[v];
    if (s === undefined && SCAN_EV.indexOf(v) >= 0) return 'rebuild';
    if (!s) return 'none';
    return (s.payout / 100).toFixed(2) + 'x  #' + s.id;
  });

  document.getElementById('modeline').textContent =
    mode + (sc && sc.max ? '   cap ' + (sc.max.payout / 100).toFixed(2) + 'x' : '');

  // The SIMULATION ID wherever this page knows it, because a real Stake replay
  // URL always carries one - event is documented as the "unique simulation ID".
  // The game prints the ID it was SERVED (the response's bookId), falling back
  // to the parameter, so the two scan aliases can go out as words and the
  // round-details panel still shows a number.
  const picked = sc && sc[state.ev];
  const ev = picked ? String(picked.id) : state.ev;

  const q = new URLSearchParams({
    replay: 'true', game: 'ride_the_bus', version: '1',
    mode: mode, event: ev, rgs_url: RGS,
    currency: state.cur,
    amount: String(Math.round(Number(document.getElementById('amt').value || 1) * 1e6)),
    lang: state.lang,
  });
  const url = 'http://localhost:' + gamePort() + '/?' + q;
  const a = document.getElementById('out');
  a.href = url;
  a.textContent = url;
}

/* The game's port is a FIELD, not a constant.
   vite takes the next free port when 3001 is busy - which happens every time a
   previous dev server is still up - and until now this page kept building links
   to 3001 regardless, so the link opened a dead tab or, worse, an older build.
   Defaults to whatever the server was told (GAME_PORT), and remembers an
   override per browser so it does not have to be retyped every session. */
const portInput = document.getElementById('port');
try {
  const saved = localStorage.getItem('rtb-game-port');
  if (saved) portInput.value = saved;
} catch (e) { /* private window, or site data blocked */ }

function gamePort() {
  const n = Number(portInput.value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : GAME_PORT;
}

portInput.addEventListener('input', () => {
  try {
    localStorage.setItem('rtb-game-port', portInput.value);
  } catch (e) { /* nothing to do - the field still works for this session */ }
  render();
  // Both links carry the port. Missing this left the plain-game link pointing at
  // whatever vite had last time while the replay link followed the field.
  renderPlain();
});

const cur = document.getElementById('cur');
CUR.forEach(([code, name]) => cur.add(new Option(code + ' (' + name + ')', code)));
cur.value = state.cur;
cur.onchange = () => { state.cur = cur.value; render(); };

const lang = document.getElementById('lang');
LANG.forEach((l) => lang.add(new Option(l, l)));
lang.value = state.lang;
lang.onchange = () => { state.lang = lang.value; render(); };

document.getElementById('amt').addEventListener('input', render);

/* ---- the plain-game link -------------------------------------------------
   Deliberately its own state rather than sharing the replay builder's. The two
   are used for different things - a replay in JPY while checking a layout, and
   a plain game in Arabic to look at the RTL board - and making one picker drive
   both meant every switch between the two workflows retyped the other's
   settings. Two selects is the cheaper duplication. The CUR and LANG lists ARE
   shared; only the DOM is not. */
const plain = { cur:'USD', lang:'en', social:'off', music:'' };

const SOCIAL = [['off','Off'],['on','On']];
/* Read out of musicTracks.ts at server start rather than hardcoded here, so a
   fifth candidate appears without this file being touched. Empty value means
   "whatever ACTIVE_TRACK_ID says", which is what a link with no dev_music does. */
const MUSIC = [['','Default']].concat(${JSON.stringify(musicTracks())});

function fillPlain(id, items, key) {
  const host = document.getElementById(id);
  host.textContent = '';
  for (const [val, label] of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    b.setAttribute('aria-pressed', String(plain[key] === val));
    b.textContent = label;
    b.onclick = () => { plain[key] = val; renderPlain(); };
    host.appendChild(b);
  }
}

function renderPlain() {
  fillPlain('psocial', SOCIAL, 'social');
  fillPlain('pmusic', MUSIC, 'music');

  // No replay, no game/version/mode/event, and NO rgs_url: handing the client a
  // URL it cannot authenticate against is what produces the error modal this
  // path exists to avoid. Game.svelte suppresses that modal in DEV only when
  // there is neither a sessionID nor a replay, which is exactly this shape.
  const q = new URLSearchParams({ currency: plain.cur, lang: plain.lang });
  if (plain.social === 'on') q.set('social', 'true');
  if (plain.music) q.set('dev_music', plain.music);

  const url = 'http://localhost:' + gamePort() + '/?' + q;
  const a = document.getElementById('pout');
  a.href = url;
  a.textContent = url;
}

const pcur = document.getElementById('pcur');
CUR.forEach(([code, name]) => pcur.add(new Option(code + ' (' + name + ')', code)));
pcur.value = plain.cur;
pcur.onchange = () => { plain.cur = pcur.value; renderPlain(); };

const plang = document.getElementById('plang');
LANG.forEach((l) => plang.add(new Option(l, l)));
plang.value = plain.lang;
plang.onchange = () => { plain.lang = plang.value; renderPlain(); };

render();
renderPlain();
</script>`;
}

createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-headers': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
      });
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);
    const parts = url.pathname.split('/').filter(Boolean);

    if (parts.length === 0) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(landingPage());
    }

    // /bet/replay/{game}/{version}/{mode}/{event}
    if (parts[0] === 'bet' && parts[1] === 'replay' && parts.length === 6) {
      const [, , , , mode, rawEvent] = parts;
      if (!MODES.has(mode)) {
        return json(res, 404, { error: `unknown mode "${mode}"` });
      }

      let id;
      if (ALIASES.includes(rawEvent)) {
        id = resolveAlias(mode, rawEvent);
        if (id === null) {
          return json(res, 404, { error: `no "${rawEvent}" round in ${mode}` });
        }
      } else if (BOOK_ALIASES.includes(rawEvent)) {
        const hit = scenariosFor(mode)[rawEvent];
        id = hit && hit.id;
        if (!hit) {
          return json(res, 404, {
            error:
              hit === undefined
                ? `REPLAY_EVENTS.md has no "${rawEvent}" column for ${mode} - ` +
                  'regenerate it with: node scripts/replay-events.js'
                : rawEvent === 'forgiven' && familyOf(mode) !== 'sc'
                  ? `"forgiven" only exists in Second Chance - try sc_${mode}`
                  : `no drawable "${rawEvent}" round in ${mode} above the celebration floor`,
          });
        }
      } else {
        id = Number(rawEvent);
        if (!Number.isInteger(id)) {
          return json(res, 400, {
            error:
              'event must be a simulation ID or one of ' +
              [...ALIASES, ...BOOK_ALIASES].join(', '),
          });
        }
      }

      const book = await findBook(mode, id);
      if (!book) return json(res, 404, { error: `no simulation ${id} in ${mode}` });

      // The books store RAW INTEGER units - 1150 means 11.5x (data_format.md:
      // "payoutMultiplier": 1150 "corresponds to an 11.5x payout"). The replay
      // ENDPOINT documents a float, and the worked example in
      // Authenticate.svelte shows "payoutMultiplier": 33.4, so the RGS divides
      // before serving. Divide here too, or a max win reports as 38190x.
      //
      // Nothing in this game actually reads the field - Game.svelte takes the
      // figure from the book's own finalWin event - but serving the wrong
      // convention would make this a bad rehearsal for the real thing.
      const raw = Number(book.payoutMultiplier);
      const payoutMultiplier = raw / 100;
      console.log(
        `  replay ${mode} #${id}${rawEvent === String(id) ? '' : ` (${rawEvent})`}` +
          ` -> ${payoutMultiplier.toFixed(2)}x`,
      );

      // The shape Stake documents, and the shape Authenticate.svelte spreads
      // into stateBet.betToResume: { payoutMultiplier, costMultiplier, state }.
      //
      // Plus `bookId`, which Stake does NOT document and does not send. It is
      // here because of the four aliases above: `event=max` resolves to a real
      // simulation ID on this side, and without telling the client which one,
      // the round-details panel can only print what the URL said - so a link
      // built with an alias made the panel read "Event #max". The panel prefers
      // this field and falls back to the URL parameter, which is the production
      // path (a real replay URL always carries the ID).
      //
      // Named bookId rather than `event` deliberately: Authenticate.svelte
      // spreads this object and then overwrites `event` with '0', so a field by
      // that name would be silently swallowed.
      return json(res, 200, {
        payoutMultiplier,
        costMultiplier: MODES.get(mode).cost,
        bookId: id,
        state: book.events,
      });
    }

  json(res, 404, { error: `no route for ${url.pathname}` });
}).listen(PORT, () => {
  console.log("");
  console.log(`Local replay RGS   http://localhost:${PORT}`);
  console.log(`Game expected on   http://localhost:${GAME_PORT}   (npm run dev)`);
  console.log("");
  console.log("Open the replay RGS in a browser to build links for any of the 192");
  console.log("modes. If the game is on a different port, change it in the Game");
  console.log("port field on that page - it is remembered per browser. This");
  console.log("server does not need restarting for that.");
  console.log("");
});
