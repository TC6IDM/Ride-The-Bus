async page => {
  // The front version under test, read off the live game frame.
  const FRONT = (page.frames().map(fr => fr.url()).find(u => u.includes('live.engine.io')) || '').match(/\/(v\d+)\//)?.[1] || 'v72';
  // REP-12: a replay that cannot load raises the error dialog ON TOP of Round
  // details, with Reload. Case 1: an event the mode does not publish (the RGS's
  // real answer). Case 2: the replay fetch dropped (simulated offline).
  const G = '019f7e00-fa38-78fa-9ea7-b4933e75765b';
  const out = [];
  for (const [kind, event] of [['unpublished', 99999999], ['offline', 2484]]) {
    const tab = await page.context().newPage();
    await tab.setViewportSize({ width: 1200, height: 675 });
    const replies = [];
    tab.on('response', async r => { if (/\/bet\/replay\//.test(r.url())) { let t = ''; try { t = await r.text(); } catch {} replies.push(r.status() + ' ' + t.slice(0, 100)); } });
    if (kind === 'offline') await tab.route(/\/bet\/replay\//, route => route.abort('internetdisconnected'));
    await tab.goto(`https://takeovercasino.live.engine.io/ride-the-bus/${FRONT}/?replay=true&game=${G}&version=13&mode=red_higher_outside_heart&event=${event}&currency=USD&amount=1000000&lang=en&device=desktop&social=false&rgs_url=rgsd.engine.io`);
    await tab.waitForTimeout(7000);
    const dlg = await tab.evaluate(() => {
      const d = document.querySelector('[role=alertdialog]');
      if (!d) return null;
      const r = d.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + 14);
      return { onTop: d.contains(top), title: d.querySelector('.err-title')?.textContent.trim(), body: d.innerText.replace(/\s+/g, ' ').trim().slice(0, 200), buttons: [...d.querySelectorAll('button')].map(b => b.textContent.trim()) };
    });
    const details = await tab.evaluate(() => !!document.querySelector('.ss-play-btn'));
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/rep12-${kind}.png` });
    let reload = null;
    if (dlg && dlg.buttons.some(b => /reload/i.test(b))) {
      const nav = tab.waitForEvent('framenavigated', { timeout: 6000 }).then(() => 'navigated').catch(() => 'no navigation');
      await tab.getByRole('button', { name: /reload/i }).first().click({ force: true });
      reload = await nav;
    }
    out.push({ kind, replies, dlg, detailsPanel: details, reload });
    await tab.close();
  }
  return out;
}
