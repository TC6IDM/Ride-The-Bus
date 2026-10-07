// CMP-13: every stage price in the replay books captured live must sit inside
// the range How to Play's payout table prints for that family and pick.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const SRC = 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/web-sdk/apps/Ride-The-Bus/src/';
const { payoutRowsFor } = await import(pathToFileURL(SRC + 'game/math/payoutTable.ts').href);
const { FAMILY_RULES, parseModeName } = await import(pathToFileURL(SRC + 'game/math/modes.ts').href);

const LABEL: Record<number, Record<string, string>> = {
  1: { red: 'Red or Black', black: 'Red or Black' },
  2: { higher: 'Higher', lower: 'Lower', equal: 'Equal' },
  3: { inside: 'Inside', outside: 'Outside', equal: 'Equal' },
  4: { heart: 'Any suit', diamond: 'Any suit', club: 'Any suit', spade: 'Any suit' },
};
const seen = new Map<string, string>();
for (const f of ['rc1', 'rc2', 'rc3', 'rc4']) {
  let d: any[] = [];
  try { d = JSON.parse(readFileSync(`C:/Users/tcand/AppData/Local/Temp/rtb-live/${f}.json`, 'utf8')); } catch { continue; }
  for (const c of d) if (c.book?.events) seen.set(c.tag.split('-').slice(0, 2).join('#'), c.book.events + '|' + c.book.pm);
}
const perFamily: Record<string, { rounds: number; wins: number; bad: string[] }> = {};
for (const [key, val] of seen) {
  const [mode] = key.split('#');
  const [events, pm] = val.split('|');
  const parsed = parseModeName(mode);
  if (!parsed) continue;
  const fam = parsed.family;
  const rules = FAMILY_RULES[fam];
  const rows = payoutRowsFor(rules);
  const reveals = events.split(' ').filter((e) => e.startsWith('reveal:'));
  const pf = (perFamily[fam] ||= { rounds: 0, wins: 0, bad: [] });
  pf.rounds += 1;
  if (Number(pm) > 0) pf.wins += 1;
  const picks = [parsed.color, parsed.higherLower, parsed.insideOutside, parsed.suit];
  if (rules.fixedChoices) {
    // Three of a Kind: the table prints running TOTALS (x cost), the book prices per card.
    let running = 1;
    reveals.forEach((r, i) => {
      running *= Number(r.split(':')[1]);
      const row = rows.find((x: any) => x.stage === i + 1);
      const total = Math.floor(running * rules.cost * 10 + 1e-9) / 10;
      if (row && Math.abs(row.min - total) > 0.11) pf.bad.push(`${key} stage ${i + 1}: total ${total} vs table ${row.min}`);
    });
    continue;
  }
  reveals.forEach((r, i) => {
    const stage = i + 1;
    const price = Number(r.split(':')[1]);
    if (rules.ticket && stage === 4) { if (price !== 1) pf.bad.push(`${key} suit card priced ${price}, expected 1 (ticket)`); return; }
    const label = LABEL[stage][String(picks[i])];
    const row = rows.find((x: any) => x.stage === stage && x.label === label);
    if (!row) { pf.bad.push(`${key} stage ${stage}: no table row for ${label}`); return; }
    if (price < row.min - 0.006 || price > row.max + 0.006) pf.bad.push(`${key} stage ${stage} ${label}: ${price.toFixed(3)} outside ${row.min}-${row.max}`);
  });
}
console.log(JSON.stringify(perFamily, null, 1));
