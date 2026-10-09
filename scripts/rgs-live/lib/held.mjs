// Time spent queued at the RGS gate, per page and per task.
//
// Every time limit in the harness is about the GAME (did it answer? did the
// round settle?), never about the gate (was it this request's turn?). Under the
// window cap a request can wait its turn for many seconds, and limits that
// counted that wait failed whole tasks that had nothing wrong with them
// (2026-10-09: four of seven in section 03). So each limit stretches by the
// time its requests sat queued: deadline() for a helper on one page,
// taskHeldMs() for a task's own timeout.
const pages = new WeakMap();
const tasks = new Map();

const entry = (map, key) => { let r = map.get(key); if (!r) map.set(key, r = { n: 0, since: 0, ms: 0 }); return r; };
const total = (r) => (r ? r.ms + (r.n ? Date.now() - r.since : 0) : 0);

/** Mark a wait at the gate as begun; call the returned function when it ends. */
export function held(page, task) {
  const rs = [];
  if (page && typeof page === 'object') rs.push(entry(pages, page));
  if (task) rs.push(entry(tasks, task));
  for (const r of rs) if (r.n++ === 0) r.since = Date.now();
  let done = false;
  return () => {
    if (done) return;
    done = true;
    for (const r of rs) if (--r.n === 0) r.ms += Date.now() - r.since;
  };
}

export const pageHeldMs = (page) => total(pages.get(page));
export const taskHeldMs = (task) => total(tasks.get(task));

/** A deadline `ms` from now whose clock stops while the page has a request waiting at the gate. */
export function deadline(page, ms) {
  const t0 = Date.now(), h0 = pageHeldMs(page);
  return () => Date.now() - t0 - (pageHeldMs(page) - h0) > ms;
}
