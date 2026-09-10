/**
 * Regenerate the per-mode win ceilings the client shows a player.
 *
 *   node scripts/mode-ceilings.js
 *
 * WHY THE CLIENT CANNOT WORK THESE OUT FOR ITSELF.
 *
 * Every one of the 192 published bet modes is one full four-guess combination,
 * and each reaches a different ceiling: 68.2x to 1354.2x inside Classic alone.
 * The client already owns the payout maths, so enumerating the theoretical
 * maximum of a combination would be easy - and WRONG, because the RGS can only
 * ever pay what is in that mode's lookup table, and the published tables do not
 * always contain the theoretical best draw.
 *
 * That is measurable rather than assumed. Heart and diamond are both red, so
 * for a fixed colour + higher/lower + inside/outside the two must share a
 * theoretical ceiling; club and spade likewise. Across the 48 such groups,
 * HALF disagree - e.g. base/red/higher/inside comes out
 * {heart: 290.9, diamond: 268.8, club: 268.8, spade: 268.8}. A theoretical
 * ceiling cannot do that, so what the tables hold are sampled maxima.
 *
 * So the honest figure - the most this bet can actually pay - is the one the
 * build produced, and an enumeration would OVERSTATE it on about half the
 * modes. Overstating is precisely the problem this table exists to fix.
 *
 * Run after every math rebuild: the ceilings move with the simulation set.
 * run.py calls this at the end of a build, beside scripts/replay-events.js.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LIBRARY = path.join(ROOT, 'math-sdk/games/ride_the_bus/library');
const STATS = path.join(LIBRARY, 'stats_summary.json');
const PUBLISH = path.join(LIBRARY, 'publish_files');
const OUT = path.join(ROOT, 'web-sdk/apps/Ride-The-Bus/src/game/math/modeCeilings.ts');

if (!fs.existsSync(STATS) || !fs.existsSync(path.join(PUBLISH, 'index.json'))) {
  console.error('No published math found at', LIBRARY);
  console.error('Run the math build first: cd math-sdk && .venv\\Scripts\\python.exe games\\ride_the_bus\\run.py');
  process.exit(1);
}

const stats = JSON.parse(fs.readFileSync(STATS, 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(PUBLISH, 'index.json'), 'utf8'));

/**
 * Every mode the RGS will actually be given, taken from index.json rather than
 * from the stats file. The manifest is what gets uploaded; a mode present in
 * one and not the other is a build fault worth failing on rather than papering
 * over with a partial table.
 */
const published = index.modes.map((m) => m.name);
const missing = published.filter((name) => !(name in stats));
if (missing.length) {
  console.error(`${missing.length} published modes have no entry in stats_summary.json:`);
  console.error('  ' + missing.slice(0, 5).join(', ') + (missing.length > 5 ? ', ...' : ''));
  process.exit(1);
}

/* Payouts are integers in hundredths throughout the math side (135420 is
   1354.2x), which is what keeps the lookup tables free of floating point. The
   client speaks in bet multiples, so convert once, here, rather than leaving
   every caller to remember the scale. */
const ceilings = {};
for (const name of published) {
  const raw = stats[name].max_win;
  if (!Number.isFinite(raw) || raw <= 0) {
    console.error(`Mode ${name} has an unusable max_win: ${raw}`);
    process.exit(1);
  }
  ceilings[name] = Math.round(raw) / 100;
}

const familyOf = (name) =>
  name.startsWith('sc_') ? 'sc' : name.startsWith('hs_') ? 'hs' : 'base';

const entries = published
  .map((name) => `  '${name}': ${ceilings[name]},`)
  .join('\n');

const body = `/**
 * The most each published bet mode can actually pay, as a multiple of the bet.
 *
 * GENERATED - do not edit by hand. Written by scripts/mode-ceilings.js from
 * math-sdk/games/ride_the_bus/library/stats_summary.json, which run.py runs at
 * the end of every math build. Regenerate after a rebuild; these move with the
 * simulation set.
 *
 * Committed rather than read at runtime because the math library is gitignored
 * in its entirety - the 1.6 GB of published books never enters the repo, so
 * a checkout has nothing to read. modeCeilings.test.ts cross-checks this file
 * against the build when one is present, and skips when it is not.
 *
 * WHY THIS IS NOT ENUMERATED IN THE CLIENT. The four guesses fix a combination,
 * and its theoretical ceiling is derivable from payout.ts. But the RGS can only
 * pay what its lookup table holds, and the published tables are sampled: for a
 * fixed colour + higher/lower + inside/outside, heart and diamond must share a
 * theoretical ceiling and half the time they do not. An enumeration would
 * therefore print a figure ABOVE what the mode can pay, on roughly half the
 * modes - which is the overstatement this table exists to correct.
 *
 * NOT the same number as FAMILY_RULES[f].maxWin, and both are wanted. That one
 * is the most the FAMILY can reach - the headline, true of the mode a player is
 * choosing between. This one is the most THIS BET can reach. Only 8 of the 64
 * combinations in each family reach their family's figure; the median Classic
 * mode stops at 268.8x against a stated 1354.2x.
 */

/** Mode name (as published, family prefix and all) to its ceiling in bet multiples. */
export const MODE_CEILINGS: Readonly<Record<string, number>> = Object.freeze({
${entries}
});
`;

// The banner above is a JSDoc block, and prose about globs or file paths can
// easily contain the two characters that CLOSE one. That is the same failure
// that took out scripts/replay-events.js, one layer down: a delimiter hidden
// inside prose, producing a file that looks written and does not parse.
// Counted with split rather than a regex so this line has no escaping of its
// own to get wrong. (Line comments deliberately - a block comment warning
// about block comments closed itself while being written.)
const terminators = body.split('*' + '/').length - 1;
if (terminators !== 2) {
  console.error(`Generated banner is malformed: ${terminators} comment terminators, expected 2.`);
  console.error('Something in the prose above closed a block comment early.');
  process.exit(1);
}
fs.writeFileSync(OUT, body);

const byFamily = {};
for (const name of published) {
  const f = familyOf(name);
  (byFamily[f] ??= []).push(ceilings[name]);
}

console.log('wrote', path.relative(ROOT, OUT));
console.log(published.length, 'modes');
for (const [family, values] of Object.entries(byFamily)) {
  const top = Math.max(...values);
  const atTop = values.filter((v) => v === top).length;
  console.log(
    `  ${family.padEnd(4)} ${values.length} modes, ` +
      `${Math.min(...values).toFixed(1)}x - ${top.toFixed(1)}x, ` +
      `${atTop} reach the family ceiling`,
  );
}
