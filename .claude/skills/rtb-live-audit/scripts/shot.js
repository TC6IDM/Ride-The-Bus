async page => {
  const el = await page.$('iframe');
  await el.screenshot({ path: 'C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/SHOTNAME.png' });
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  return await f.evaluate(() => [...document.querySelectorAll('.card-mult')].map(e => e.textContent.trim()));
}
