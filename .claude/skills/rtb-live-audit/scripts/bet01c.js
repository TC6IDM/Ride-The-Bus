async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const bet = () => f.evaluate(() => document.querySelector('.cb-bet-display')?.textContent.replace(/\s+/g, ' ').trim());
  const out = {};
  for (const typed of ['5000', '1.234', '0.004', '2.5']) {
    await f.getByRole('button', { name: 'Choose bet amount' }).click();
    await page.waitForTimeout(400);
    const input = f.locator('input[name="bet-amount"]');
    await input.fill(typed);
    await input.press('Enter');
    await page.waitForTimeout(400);
    const msg = await f.evaluate(() => { const p = document.querySelector('.popup'); return p ? (p.querySelector('[role=alert],[aria-live],.bet-error,.field-error')?.textContent || '').trim() : null; });
    out[typed] = { bet: await bet(), popupStillOpen: msg !== null, message: msg };
    if (msg !== null) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  }
  return out;
}
