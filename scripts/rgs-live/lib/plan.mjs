// RGS_TEST_PLAN.md: the catalogue of checks, and writing results back into it.
//
// The runner records ONE line per check, tagged "rgs-live", and replaces its
// own previous line on the next run - so the plan keeps every hand-written
// pass's history and does not grow by 132 lines per run. A PASS ticks the box,
// a FAIL unticks it (a regression must show), anything else leaves it alone.
import { readFileSync, writeFileSync } from 'node:fs';

const BOX = /^- \[( |x)\] \*\*([A-Z]+-\d+) · (.*?)\*\* [—-] \*([A-Za-z]+)\*/;

export function readPlan(file) {
  const text = readFileSync(file, 'utf8');
  const checks = [];
  let section = '';
  for (const line of text.split('\n')) {
    const h = line.match(/^## (\d\d) · (.*)/);
    if (h) section = `${h[1]} ${h[2].trim()}`;
    const m = line.match(BOX);
    if (m) checks.push({ id: m[2], title: m[3].replace(/`/g, ''), severity: m[4], ticked: m[1] === 'x', section });
  }
  return checks;
}

// marker: the tag's runner name. Each runner replaces only ITS OWN previous
// line ("(rgs-live" / "(rgs-local"), never the other's and never a hand-written one.
export function recordResults(file, results, tag, marker = 'rgs-live') {
  const lines = readFileSync(file, 'utf8').split('\n');
  let n = 0;
  for (const [id, r] of Object.entries(results)) {
    if (!['PASS', 'FAIL', 'SIM'].includes(r.status)) continue;
    const i = lines.findIndex(l => BOX.test(l) && l.match(BOX)[2] === id);
    if (i < 0) continue;
    if (r.status === 'PASS') lines[i] = lines[i].replace('- [ ]', '- [x]');
    if (r.status === 'FAIL') lines[i] = lines[i].replace('- [x]', '- [ ]');
    let end = i + 1;
    while (end < lines.length && /^ {2}\*\*(Live|Read|Local) /.test(lines[end])) end++;
    for (let k = end - 1; k > i; k--) if (lines[k].includes(`(${marker}`)) { lines.splice(k, 1); end--; }
    const word = r.status === 'SIM' ? 'SIMULATED' : r.status;
    const ev = String(r.evidence || '').replace(/\s+/g, ' ').trim();
    lines.splice(end, 0, `  ${tag} ${word}${ev ? ' - ' + ev : ''}`);
    n++;
  }
  writeFileSync(file, lines.join('\n'));
  return n;
}
