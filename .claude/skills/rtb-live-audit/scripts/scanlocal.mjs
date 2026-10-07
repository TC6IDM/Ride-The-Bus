// Find replay events by shape, from the local replay server (same books as math v13).
const jobs = [
  ['sc_red_higher_outside_heart', 0, 1500], ['sc_red_higher_inside_heart', 0, 3000],
  ['hs_red_higher_outside_heart', 0, 3000], ['hs_red_higher_inside_heart', 0, 3000],
  ['red_higher_outside_heart', 0, 1500], ['red_higher_inside_heart', 0, 1500],
  ['ls_red_higher_inside_heart', 0, 1500], ['ls_red_higher_outside_heart', 0, 1500],
];
const found = {};
const add = (k, v) => { (found[k] ||= []); if (found[k].length < 3) found[k].push(v); };
for (const [mode, from, to] of jobs) {
  for (let id = from; id < to; id++) {
    const r = await fetch(`http://localhost:3011/bet/replay/ride-the-bus/1/${mode}/${id}`);
    if (!r.ok) continue;
    const j = await r.json();
    const rv = (j.state || []).filter((e) => e.type === 'reveal');
    const misses = rv.filter((e) => e.correct === false).map((e) => e.stage);
    const pm = j.payoutMultiplier;
    const sweep = misses.length === 0;
    const ticket = (j.state || []).find((e) => e.type === 'ticket');
    const tag = `${mode}#${id} ${pm}x miss[${misses}]${ticket ? ' t' + JSON.stringify(ticket).slice(0, 40) : ''}`;
    if (mode.startsWith('sc_')) {
      if (misses[0] === 1) add('sc_card1_miss', tag);
      if (misses.length === 1 && misses[0] > 1 && misses[0] < 4 && pm < 10) add('sc_forgiven_midround_complete_under10', tag);
      if (misses.length === 1 && misses[0] > 1 && pm >= 10) add('sc_forgiven_complete_10plus', tag);
      if (misses.length === 2) add('sc_two_misses', tag);
      if (sweep && pm < 10) add('sc_sweep_under10', tag);
      if (pm >= 28 && pm < 60) add('sc_28_60', tag);
    } else if (mode.startsWith('hs_')) {
      if (sweep && pm < 10) add('hs_sweep_under10', tag);
      if (pm >= 28 && pm < 55) add('hs_28_55', tag);
    } else if (mode.startsWith('ls_')) {
      if (misses.length && misses[0] > 1) add('ls_late_bust', tag);
      if (sweep && pm < 10) add('ls_sweep_under10', tag);
    } else {
      if (sweep && pm < 10) add('base_sweep_under10', tag);
      if (misses[0] === 2) add('base_bust_card2', tag);
      if (misses[0] === 3) add('base_bust_card3', tag);
      if (misses[0] === 4) add('base_bust_card4', tag);
      if (sweep && pm >= 10 && pm < 40) add('base_sweep_10_40', tag);
    }
  }
}
console.log(JSON.stringify(found, null, 1));
