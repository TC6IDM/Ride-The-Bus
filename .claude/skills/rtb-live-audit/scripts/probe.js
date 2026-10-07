async page => {
  // The front version under test, read off the live game frame.
  const FRONT = (page.frames().map(fr => fr.url()).find(u => u.includes('live.engine.io')) || '').match(/\/(v\d+)\//)?.[1] || 'v72';
  const G = '019f7e00-fa38-78fa-9ea7-b4933e75765b';
  const tab = await page.context().newPage();
  const seen = [];
  tab.on('response', r => { if (/rgsd/.test(r.url())) seen.push([r.status(), r.url().replace(/^https?:\/\/[^\/]+/, '')]); });
  tab.on('requestfailed', r => { if (/rgsd/.test(r.url())) seen.push(['FAILED ' + (r.failure()?.errorText || ''), r.url().replace(/^https?:\/\/[^\/]+/, '')]); });
  await tab.goto(`https://takeovercasino.live.engine.io/ride-the-bus/${FRONT}/?replay=true&game=${G}&version=13&mode=red_equal_equal_heart&event=975&currency=USD&amount=1000000&lang=en&device=desktop&social=false&rgs_url=rgsd.engine.io`);
  await tab.waitForTimeout(6000);
  const errs = [];
  await tab.close();
  return seen;
}
