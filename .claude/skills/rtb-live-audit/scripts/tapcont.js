async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const st = () => f.evaluate(() => ({ ov: !!document.querySelector('.wc-overlay'), prompt: document.querySelector('.wc-prompt')?.textContent.trim(), auto: !!document.querySelector('.cb-spin.stopping'), label: document.querySelector('.running-win-label')?.textContent.trim() }));
  const before = await st();
  const plays = []; const onReq = r => { if (/\/wallet\/play/.test(r.url())) plays.push(Date.now()); };
  page.on('request', onReq);
  if (before.ov) { const b = await f.locator('.wc-overlay').first().boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.85); }
  await page.waitForTimeout(6000);
  const after = await st();
  page.off('request', onReq);
  if (after.auto) { await f.locator('.cb-spin').click({ force: true }); await page.waitForTimeout(6000); }
  return { before, after, playsAfterTap: plays.length, stopped: await st() };
}
