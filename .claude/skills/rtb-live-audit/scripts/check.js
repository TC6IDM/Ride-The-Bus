// Reads run-code output on stdin; verifies per-round arithmetic in micro-units.
let s = ''; process.stdin.on('data', d => s += d).on('end', () => {
  const line = s.split('\n').find(l => l.startsWith('{')); if (!line) { console.log(s.slice(0, 800)); return; }
  const j = JSON.parse(line);
  const money = t => Math.round(parseFloat((t || '').replace(/[^0-9.]/g, '')) * 1e6);
  console.log('mode:', j.mode);
  for (const [i, r] of j.rounds.entries()) {
    const play = r.rgs.find(x => x.path.endsWith('/wallet/play'));
    const ends = r.rgs.filter(x => x.path.endsWith('/wallet/end-round'));
    const others = r.rgs.filter(x => !/wallet\/(play|end-round)$/.test(x.path)).map(x => x.path + ':' + x.status);
    if (!play) { console.log(i, 'NO PLAY', JSON.stringify(r).slice(0, 300)); continue; }
    const cost = play.res.round.costMultiplier || 1;
    const amt = play.req.amount, pm = play.res.round.payoutMultiplier;
    const beforeBoard = money(r.before);
    const debit = beforeBoard - play.res.balance; // board is rounded to cents, so allow < 5000 micro
    const expectedCredit = Math.round(pm * amt);
    const credit = ends.length ? ends[0].res.balance - play.res.balance : 0;
    const ok = [
      play.status === 200,
      Math.abs(debit - amt * cost) < 5000,
      pm > 0 ? (ends.length === 1 && ends[0].status === 200 && credit === expectedCredit) : ends.length === 0,
      Math.abs(money(r.after) - (ends.length ? ends[0].res.balance : play.res.balance)) < 5000,
    ];
    console.log(`${i} ${play.req.mode} amt=${amt} cost=${cost} pm=${pm} debit~${debit} end=${ends.length} credit=${credit}/${expectedCredit} board=${r.after.replace('Balance ','')} lastWin="${r.lastWin}" ${ok.every(Boolean) ? 'OK' : 'CHECK ' + ok.join(',')} ${others.length ? 'others=' + others : ''} ${r.error ? 'ERROR=' + r.error : ''} | ${play.res.round.events}`);
  }
});
