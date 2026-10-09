// REPLAY_EVENTS.md, read at run time: the drawable simulation IDs per mode and
// scenario, so a replay check never hard-codes an ID a rebuild has moved.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'REPLAY_EVENTS.md');
const COLS = ['loss', 'normal', 'big', 'cap', 'bustwin', 'forgiven', 't2', 't3', 't5', 't10'];
let cache = null;

/** mode -> { loss, normal, big, cap, bustwin, forgiven, t2..t10 }, each { id, x } or null. */
export function replayEvents() {
  if (cache) return cache;
  cache = {};
  for (const line of readFileSync(FILE, 'utf8').split('\n')) {
    const m = line.match(/^\| `([a-z_]+)` \|(.*)\|\s*$/);
    if (!m) continue;
    const cells = m[2].split('|').map(s => s.trim());
    const row = {};
    cells.forEach((c, i) => {
      const k = COLS[i]; if (!k) return;
      const v = c.match(/^(\d+)(?: \(([\d.,]+)x\))?$/);
      row[k] = v ? { id: Number(v[1]), x: v[2] ? Number(v[2].replace(/,/g, '')) : 0 } : null;
    });
    cache[m[1]] = row;
  }
  return cache;
}

export function eventFor(mode, scenario) {
  const e = replayEvents()[mode]?.[scenario];
  if (!e) throw new Error(`REPLAY_EVENTS.md has no ${scenario} event for ${mode}`);
  return e;
}
