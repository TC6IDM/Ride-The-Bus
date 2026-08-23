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

function scenariosFor(mode) {
  const txt = readFileSync(path.join(PUBLISH, MODES.get(mode).weights), 'utf8');
  const drawable = [];
  const weightByPayout = new Map();
  for (const line of txt.split('\n')) {
    const [id, w, p] = line.trim().split(',');
    if (!id || w === undefined || p === undefined) continue;
    const weight = BigInt(w);
    if (weight === 0n) continue;
    const payout = Number(p);
    drawable.push({ id: Number(id), payout });
    weightByPayout.set(payout, (weightByPayout.get(payout) || 0n) + weight);
  }

  const wins = drawable.filter((r) => r.payout > 0).sort((a, b) => a.payout - b.payout);
  const loss = drawable.find((r) => r.payout === 0) || null;
  if (!wins.length) return { max: null, big: null, win: null, loss };

  // The FIRST row paying the cap, not the last. Several simulations reach a
  // mode's ceiling, and replay-events.js takes the first - so taking a
  // different one here would make this server disagree with REPLAY_EVENTS.md,
  // which is the list a reviewer is working from.
  const capPayout = wins[wins.length - 1].payout;
  const cap = wins.find((r) => r.payout === capPayout);

  // BIG: the smallest payout worth at least a quarter of this mode's cap, so it
  // reads as clearly large but is still a different round from the cap.
  const bigTarget = cap.payout * 0.25;
  const big = wins.find((r) => r.payout >= bigTarget && r.payout < cap.payout) || cap;

  // WIN: the most likely payout that is an actual PROFIT. The most likely
  // non-zero payout in every mode is 0.50x - the stage-2 consolation - which is
  // a loss from the player's side.
  let best = -1n;
  let target = null;
  for (const [p, weight] of weightByPayout) {
    if (p <= 100) continue;
    if (weight > best) {
      best = weight;
      target = p;
    }
  }
  const win = wins.find((r) => r.payout === (target ?? wins[0].payout)) || wins[0];

  return { max: cap, big, win, loss };
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
let scan = null;
function scenarios() {
  if (scan) return scan;
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
  scan = { byMode, familyCeiling };
  return scan;
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
  button.pick.red[aria-pressed=true]{background:#5a1620;border-color:#ff6b6b;
       box-shadow:0 0 0 1px #ff6b6b inset}
  button.pick.blk[aria-pressed=true]{background:#20232a;border-color:#cfd6e4;
       box-shadow:0 0 0 1px #cfd6e4 inset}
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
</style>
<h1>Ride The Bus &mdash; local replay</h1>
<p>Build a replay link the way the game builds a bet: pick a mode, then four guesses.</p>

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
</div>

<p class=modeline id=modeline></p>
<a class=out id=out target=_blank></a>

<p class=note style="margin-top:1.7rem"><b>&ldquo;Max&rdquo; is that MODE's cap, not the family's.</b>
   Each mode is one guess combination and most stop well short. Only these three
   reach their family ceiling, so only these fire the <b>MAX WIN</b> tier:</p>
<ul class=note>${ceilings}</ul>

<script>
const SC = ${JSON.stringify(byMode)};
const GAME_PORT = ${GAME_PORT};
const RGS = 'localhost:${PORT}';

const state = { fam:'hs_', color:'red', hl:'equal', io:'equal', suit:'heart',
                ev:'max', cur:'USD', lang:'en' };

const FAM  = [['','Classic'],['sc_','Second Chance'],['hs_','High Stakes']];
const COL  = [['red','Red','red'],['black','Black','blk']];
const HL   = [['higher','Higher'],['lower','Lower'],['equal','Equal']];
const IO   = [['inside','Inside'],['outside','Outside'],['equal','Equal']];
const SUIT = [['heart','♥ Heart'],['diamond','♦ Diamond'],
              ['club','♣ Club'],['spade','♠ Spade']];
const EV   = [['max','Max'],['big','Big'],['win','Win'],['loss','Loss']];
const CUR  = ['USD','EUR','GBP','JPY','BRL','INR','CAD','AUD','MXN','NOK','ISK',
              'XGC','XSC','XEC'];
const LANG = ['en','ar','de','es','fi','fr','hi','id','ja','ko','pl','pt','ru','tr','vi','zh'];

const modeName = () =>
  state.fam + state.color + '_' + state.hl + '_' + state.io + '_' + state.suit;

// Equal-then-Inside is not a published mode: nothing falls strictly between two
// cards of the same rank.
const insideBlocked = () => state.hl === 'equal';

function fill(id, items, key, multFor) {
  const host = document.getElementById(id);
  host.textContent = '';
  for (const [val, label, cls] of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick' + (cls ? ' ' + cls : '');
    b.setAttribute('aria-pressed', String(state[key] === val));
    if (id === 'io' && val === 'inside' && insideBlocked()) b.disabled = true;
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

  const mode = modeName();
  const sc = SC[mode];

  fill('fam', FAM, 'fam');
  fill('color', COL, 'color');
  fill('hl', HL, 'hl');
  fill('io', IO, 'io');
  fill('suit', SUIT, 'suit');
  fill('ev', EV, 'ev', (v) => {
    const s = sc && sc[v];
    if (!s) return '—';
    return (s.payout / 100).toFixed(2) + 'x  #' + s.id;
  });

  document.getElementById('modeline').textContent =
    mode + (sc && sc.max ? '   cap ' + (sc.max.payout / 100).toFixed(2) + 'x' : '');

  const q = new URLSearchParams({
    replay: 'true', game: 'ride_the_bus', version: '1',
    mode: mode, event: state.ev, rgs_url: RGS,
    currency: state.cur,
    amount: String(Math.round(Number(document.getElementById('amt').value || 1) * 1e6)),
    lang: state.lang,
  });
  const url = 'http://localhost:' + GAME_PORT + '/?' + q;
  const a = document.getElementById('out');
  a.href = url;
  a.textContent = url;
}

const cur = document.getElementById('cur');
CUR.forEach((c) => cur.add(new Option(c, c)));
cur.value = state.cur;
cur.onchange = () => { state.cur = cur.value; render(); };

const lang = document.getElementById('lang');
LANG.forEach((l) => lang.add(new Option(l, l)));
lang.value = state.lang;
lang.onchange = () => { state.lang = lang.value; render(); };

document.getElementById('amt').addEventListener('input', render);
render();
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
      } else {
        id = Number(rawEvent);
        if (!Number.isInteger(id)) {
          return json(res, 400, {
            error: `event must be a simulation ID or one of ${ALIASES.join(', ')}`,
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
        `  replay ${mode} #${id}${ALIASES.includes(rawEvent) ? ` (${rawEvent})` : ''}` +
          ` -> ${payoutMultiplier.toFixed(2)}x`,
      );

      // The shape Stake documents, and the shape Authenticate.svelte spreads
      // into stateBet.betToResume: { payoutMultiplier, costMultiplier, state }.
      return json(res, 200, {
        payoutMultiplier,
        costMultiplier: MODES.get(mode).cost,
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
  console.log("modes. If the game runs on a different port, restart this with:");
  console.log("");
  console.log("    GAME_PORT=<port> node scripts/replay-server.mjs");
  console.log("");
});
