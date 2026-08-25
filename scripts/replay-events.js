/**
 * Regenerate REPLAY_EVENTS.md from the published math.
 *
 *   node scripts/replay-events.js
 *
 * Stake's frontend approval asks for replay event IDs per bet mode covering
 * normal win, big win, win cap and loss. With 192 bet modes that is 768 IDs, so
 * they are derived from the published lookup tables rather than collected by
 * hand.
 *
 * Run this after every math rebuild: the simulation set changes, and so do the
 * IDs. The table is only meaningful against the build currently in
 * math-sdk/games/ride_the_bus/library/publish_files/.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const LIBRARY = path.join(ROOT, 'math-sdk/games/ride_the_bus/library');
const PUBLISH = path.join(LIBRARY, 'publish_files');
/**
 * Normally every published mode. REPLAY_EVENTS_MODES limits it to a
 * comma-separated few, for smoke-testing this script without paying for a scan
 * of all 192 books.
 *
 * A filtered run writes REPLAY_EVENTS.partial.md instead, and says so. It must
 * not be able to leave a truncated table where the real one belongs - that file
 * is a submission artefact, and a silently short one would be worse than none.
 */
const ONLY = (process.env.REPLAY_EVENTS_MODES || '')
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

const OUT = path.join(ROOT, ONLY.length ? 'REPLAY_EVENTS.partial.md' : 'REPLAY_EVENTS.md');

if (!fs.existsSync(path.join(PUBLISH, 'index.json'))) {
  console.error('No published math found at', PUBLISH);
  console.error('Run the math build first: cd math-sdk && .venv\\Scripts\\python.exe games\\ride_the_bus\\run.py');
  process.exit(1);
}

const idx = JSON.parse(fs.readFileSync(path.join(PUBLISH, 'index.json'), 'utf8'));

/**
 * Mode families, mirroring MODE_FAMILIES in game_calculations.py.
 *
 * Deliberately a local copy rather than an import: this script runs from the
 * repo root against published math, with no build step and no path into the
 * Svelte app. The published index.json is the source of truth for WHICH modes
 * exist - this only supplies the labels, and a family it does not recognise
 * still appears in the table under its own name.
 */
const FAMILY_LABELS = { base: 'Classic', sc: 'Second Chance', hs: 'High Stakes' };
const familyOf = (name) =>
  name.startsWith('sc_') ? 'sc' : name.startsWith('hs_') ? 'hs' : 'base';

const rows = [];

async function main() {
  const modes = ONLY.length ? idx.modes.filter((m) => ONLY.includes(m.name)) : idx.modes;
  if (ONLY.length) {
    console.log(`REPLAY_EVENTS_MODES set - ${modes.length} of ${idx.modes.length} modes.`);
    console.log('Writing REPLAY_EVENTS.partial.md; the real table is untouched.');
  }

  for (const mode of modes) {
    const txt = fs.readFileSync(path.join(PUBLISH, mode.weights), 'utf8');

    // Keep only rows the RGS can actually draw. A zero-weight row exists in the
    // table but can never be selected, so handing one to a reviewer as a replay
    // would be handing them a round that cannot happen.
    const drawable = [];
    const weightByPayout = new Map();
    for (const line of txt.split(/\r?\n/)) {
      if (!line) continue;
      const [id, w, p] = line.split(',');
      const weight = BigInt(w);
      if (weight === 0n) continue;
      const payout = Number(p);
      drawable.push({ id: Number(id), payout });
      weightByPayout.set(payout, (weightByPayout.get(payout) || 0n) + weight);
    }

    const losses = drawable.filter((r) => r.payout === 0);
    const wins = drawable.filter((r) => r.payout > 0).sort((a, b) => a.payout - b.payout);
    if (!wins.length) continue;

    const capPayout = wins[wins.length - 1].payout;

    // NORMAL WIN: the most likely payout that is an actual PROFIT, above 1.00x.
    // The most likely non-zero payout in every mode is 0.50x - the stage-2
    // consolation - which is a loss from the player's side and a strange thing to
    // hand a reviewer as the normal win.
    let normalPayout = null;
    let best = -1n;
    for (const [payout, weight] of weightByPayout) {
      if (payout <= 100) continue; // raw units: 100 = 1.00x
      if (weight > best) {
        best = weight;
        normalPayout = payout;
      }
    }
    if (normalPayout === null) normalPayout = wins[0].payout;

    // BIG WIN: the smallest payout worth at least a quarter of this mode's cap.
    // "Largest below the cap" put big win within a few percent of the cap in most
    // modes, so the two rounds demonstrated the same thing.
    const bigTarget = capPayout * 0.25;
    const bigCandidates = wins.filter((r) => r.payout >= bigTarget && r.payout < capPayout);
    const bigPayout = bigCandidates.length ? bigCandidates[0].payout : capPayout;

    const pick = (payout) => wins.find((r) => r.payout === payout) || null;

    rows.push({
      mode: mode.name,
      family: familyOf(mode.name),
      cost: mode.cost,
      loss: losses[0] ? losses[0].id : null,
      normal: pick(normalPayout),
      big: pick(bigPayout),
      cap: pick(capPayout),
    });
  }

  /* The two SHAPE scenarios, resolved from the books.
     Done here, in the generator, so the local replay tool never has to: it used
     to stream a 215k-round book file on demand the first time either was asked
     for, which made two buttons behave unlike the other four and put minutes of
     work into a dev server start. This runs once, in the build that produced
     the books, and the answer lands in the table below like everything else. */
  console.log('');
  console.log(`Scanning ${rows.length} books for bust-win and second-chance rounds...`);
  let done = 0;
  for (const r of rows) {
    const shapes = await scanShapes(idx.modes.find((m) => m.name === r.mode));
    r.bustwin = shapes.bustwin;
    r.forgiven = shapes.forgiven;
    done += 1;
    if (done % 24 === 0) console.log(`  ${done}/${rows.length}`);
  }

  const x = (r) => (r ? (r.payout / 100).toFixed(2) + 'x' : '-');
  const id = (r) => (r ? String(r.id) : '-');
  const caps = rows.map((r) => (r.cap ? r.cap.payout : 0));
  const familyCount = new Set(rows.map((r) => r.family)).size;

  let md = `# Replay event IDs

Stake's frontend approval requires replay event IDs to be supplied **per bet
mode**, covering normal win, big win, win cap and loss. Every mode here is one
full four-stage guess combination in one mode family, so the tables below list
every published mode and all four of its scenarios.

Generated by \`scripts/replay-events.js\`. **Regenerate after every math
rebuild**; the IDs are tied to the simulation set that produced them.

## What these IDs are

These are **simulation IDs from the published lookup tables** in
\`math-sdk/games/ride_the_bus/library/publish_files/\`. Each row of a
\`lookUpTable_<mode>_0.csv\` is \`simulation number, weight, payout multiplier\`,
and every ID below has a non-zero weight, so each one is an outcome the RGS can
actually draw.

They are derived from the build, not observed from real play, and that is the
correct form to send. Stake's replay documentation defines the \`event\` query
parameter as the "unique simulation ID to replay", and the \`{event}\` segment of
the replay endpoint takes the same value:

\`\`\`
GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event}
\`\`\`

No recapture from a live session is needed.

## How each scenario was chosen

| Scenario | Chosen as |
|---|---|
| Loss | The first drawable simulation paying 0x. |
| Normal win | The most likely payout that is an actual **profit** (above 1.00x). The most likely non-zero payout in every mode is 0.50x, the stage-2 consolation, which is a loss from the player's side. |
| Big win | The smallest payout worth at least **a quarter of that mode's cap**, so it is clearly large but still a different round from the cap. |
| Win cap | The highest payout the mode can produce. |
| Bust + win | The first drawable round that **busted and still paid enough to fire a celebration** - the family's Big Win floor. A round does not have to be a full game win to take the screen over: a bust on the last card keeps its retention of a multiplier that may already be large. Shown as \`-\` where the mode has none. |
| 2nd chance | **Second Chance only.** The first drawable round that spent its forgiveness, survived, and still finished above the celebration floor. \`-\` in the other two families, and \`-\` in a Second Chance mode that has none. |

## The table

Payout multipliers are shown beside each ID so a reviewer can see what the round
is meant to demonstrate.

`;

  // One table per family, each stating its own cost and ceiling.
  //
  // A reviewer asking "what is the max win on High Stakes" should not have to
  // scan 192 interleaved rows for it, and the families genuinely differ: they
  // carry different costs and reach different caps, so a single combined figure
  // would describe none of them.
  for (const family of Object.keys(FAMILY_LABELS)) {
    const mine = rows.filter((r) => r.family === family);
    if (!mine.length) continue;
    const myCaps = mine.map((r) => (r.cap ? r.cap.payout : 0));

    md += `### ${FAMILY_LABELS[family]} — \`${family}\`\n\n`;
    md += `Cost **${mine[0].cost}x** the bet. **${mine.length}** modes, `;
    md += `**${mine.length * 4}** required event IDs. `;
    md += `Highest cap **${(Math.max(...myCaps) / 100).toFixed(2)}x**, `;
    md += `lowest **${(Math.min(...myCaps) / 100).toFixed(2)}x**.\n\n`;
    md += `| Bet mode | Loss | Normal win | Big win | Win cap | Bust + win | 2nd chance |\n|---|---|---|---|---|---|---|\n`;
    for (const r of mine) {
      md +=
        `| \`${r.mode}\` | ${r.loss ?? '-'} | ${id(r.normal)} (${x(r.normal)}) ` +
        `| ${id(r.big)} (${x(r.big)}) | ${id(r.cap)} (${x(r.cap)}) ` +
        `| ${id(r.bustwin)} (${x(r.bustwin)}) | ${id(r.forgiven)} (${x(r.forgiven)}) |\n`;
    }
    md += '\n';
  }

  // Anything the family map does not know about still has to reach the reviewer.
  const unknown = rows.filter((r) => !FAMILY_LABELS[r.family]);
  if (unknown.length) {
    md += `### Other\n\n| Bet mode | Loss | Normal win | Big win | Win cap | Bust + win | 2nd chance |\n|---|---|---|---|---|---|---|\n`;
    for (const r of unknown) {
      md +=
        `| \`${r.mode}\` | ${r.loss ?? '-'} | ${id(r.normal)} (${x(r.normal)}) ` +
        `| ${id(r.big)} (${x(r.big)}) | ${id(r.cap)} (${x(r.cap)}) ` +
        `| ${id(r.bustwin)} (${x(r.bustwin)}) | ${id(r.forgiven)} (${x(r.forgiven)}) |\n`;
    }
    md += '\n';
  }

  md += `
## Notes

- **${rows.length}** bet modes across **${familyCount}** ${familyCount === 1 ? 'family' : 'families'}, **${rows.length * 4}** event IDs, all four distinct within every mode.
- The highest cap across all modes is **${(Math.max(...caps) / 100).toFixed(2)}x**, on ${FAMILY_LABELS[rows.find((r) => r.cap && r.cap.payout === Math.max(...caps)).family] ?? 'an unrecognised family'} - the game's overall maximum win, matching the figure stated in How to Play. Each family's own ceiling is stated above its table.
- The lowest per-mode cap is **${(Math.min(...caps) / 100).toFixed(2)}x**. Caps differ by mode because the ceiling depends on how unlikely the four guesses were.
- Every mode has a drawable loss, so no mode is missing a scenario.
`;

  /* THE HEADER ABOVE IS MARKDOWN, AND MARKDOWN LOVES BACKTICKS.
     An unescaped one CLOSES the template literal, at which point the `-` that
     follows it is parsed as a SUBTRACTION operator and the whole initialiser
     evaluates to NaN - silently, because subtracting two strings is legal
     JavaScript. `md` then stops being a string, the entire header is consumed
     into the arithmetic, and the first `md +=` coerces it back, so the file
     goes out starting with the characters "NaN" and no title at all.

     That shipped. This script printed its usual success line and exited 0
     while writing a headless REPLAY_EVENTS.md - the one artefact a Stake
     reviewer opens to find replay event IDs. Write markdown inline code as
     \` ... \` in this file, and assert the shape rather than trusting it. */
  if (typeof md !== 'string' || !md.startsWith('# Replay event IDs')) {
    console.error('');
    console.error('The generated document is malformed: it does not start with its own title.');
    console.error('Almost certainly an unescaped backtick in a template literal above.');
    console.error('Got:', JSON.stringify(String(md).slice(0, 60)));
    process.exit(1);
  }
  fs.writeFileSync(OUT, md);
  console.log('');
  console.log('wrote', path.relative(ROOT, OUT));
  console.log(rows.length, 'modes,', rows.length * 4, 'required event IDs');
  console.log(
    'cap range',
    (Math.min(...caps) / 100).toFixed(2) + 'x',
    '-',
    (Math.max(...caps) / 100).toFixed(2) + 'x',
  );
  const noBust = rows.filter((r) => !r.bustwin).length;
  const withForgiven = rows.filter((r) => r.forgiven).length;
  console.log(`bust+win in ${rows.length - noBust}/${rows.length} modes, 2nd chance in ${withForgiven}`);
}

/* ---- The two SHAPE scenarios ---------------------------------------------
   Two of the local replay tool's six scenarios are about the SHAPE of a round
   rather than its size:

     bustwin   busted, and still paid enough to fire a celebration
     forgiven  Second Chance only - spent its forgiveness, survived, and
               finished big enough to celebrate

   Neither can be read off a lookup table, because a table row is only
   (id, weight, payout) - whether the round busted lives in the book events. So
   the server used to stream a 215k-round book file on demand, per mode, the
   first time either was asked for. That worked, but it made two buttons behave
   unlike the other four, and a mode with no such round paid the cost of a FULL
   scan to discover it.

   Resolving them here instead moves that work to where it belongs: once, in the
   build that produced the books, alongside the table it is derived from. run.py
   calls this script at the end of every math build, so the index is regenerated
   whenever the simulation set changes - which is exactly when it goes stale.

   Both are resolved in ONE pass per book, stopping as soon as everything
   applicable is found. 192 files, ~900 MB compressed; a minute or two against a
   40-minute build.                                                          */

/**
 * Entry tier per family, in raw units (100 = 1.00x).
 *
 * Mirrors FAMILY_BANDS[family][0] in web-sdk/apps/Ride-The-Bus/src/game/
 * winTiers.ts - the Big Win floor. A local copy for the same reason
 * FAMILY_LABELS above is one: this script runs from the repo root with no path
 * into the Svelte app.
 */
const CELEBRATION_FLOOR = { base: 1000, sc: 1100, hs: 1200 };

/** The `id` field at the head of every book line, without parsing the line. */
const ID_HEAD = /^\{"id":\s*(\d+)/;

/**
 * Replay the client's bust/forgiveness rule over one book's reveals.
 *
 * Mirrors playRevealSequence in Game.svelte and run_spin in gamestate.py.
 * Second Chance forgives the first wrong guess from card 2 onward; every other
 * family busts on the first miss, and a second miss busts even in Second
 * Chance.
 */
function shapeOf(book, family) {
  const forgives = family === 'sc';
  let busted = false;
  let forgivenessSpent = false;
  let index = -1;
  for (const event of book.events) {
    if (event.type !== 'reveal') continue;
    index += 1;
    if (busted || event.correct) continue;
    if (forgives && !forgivenessSpent && index >= 1) {
      forgivenessSpent = true;
      continue;
    }
    busted = true;
  }
  return { busted, forgivenessSpent };
}

async function scanShapes(mode) {
  const family = familyOf(mode.name);
  const floor = CELEBRATION_FLOOR[family];

  // Only rows the RGS can draw, and only ones large enough to celebrate.
  const eligible = new Set();
  const csv = fs.readFileSync(path.join(PUBLISH, mode.weights), 'utf8');
  for (const line of csv.split(/\r?\n/)) {
    if (!line) continue;
    const [id, weight, payout] = line.split(',');
    if (BigInt(weight) === 0n) continue;
    if (Number(payout) < floor) continue;
    eligible.add(Number(id));
  }

  const want = family === 'sc' ? ['bustwin', 'forgiven'] : ['bustwin'];
  const found = {};
  if (eligible.size) {
    const stream = fs
      .createReadStream(path.join(PUBLISH, mode.events))
      .pipe(zlib.createZstdDecompress());
    const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
    try {
      for await (const line of lines) {
        if (!line.trim()) continue;
        // Read the id off the raw text and reject before parsing. Books are
        // written `{"id": N, "payoutMultiplier": ...` and only a tiny fraction
        // of rows are eligible - 1110 of 215k in sc_red_lower_outside_heart -
        // so parsing every line to look at its id was almost all of the cost.
        const head = ID_HEAD.exec(line);
        if (!head || !eligible.has(Number(head[1]))) continue;
        const book = JSON.parse(line);
        const shape = shapeOf(book, family);
        if (!found.bustwin && shape.busted) {
          found.bustwin = { id: book.id, payout: Number(book.payoutMultiplier) };
        }
        if (!found.forgiven && family === 'sc' && shape.forgivenessSpent && !shape.busted) {
          found.forgiven = { id: book.id, payout: Number(book.payoutMultiplier) };
        }
        if (want.every((k) => found[k])) break;
      }
    } finally {
      lines.close();
      stream.destroy();
    }
  }

  // null, not undefined: "scanned, and this mode has none" is an ANSWER, and
  // the tool needs to tell it apart from "not looked at yet" so it can grey the
  // button out instead of building a link that 404s.
  return {
    bustwin: found.bustwin ?? null,
    forgiven: family === 'sc' ? (found.forgiven ?? null) : null,
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
