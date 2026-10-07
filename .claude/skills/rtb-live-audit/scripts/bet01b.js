async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const bet = () => f.evaluate(() => document.querySelector('.cb-bet-display')?.textContent.replace(/\s+/g, ' ').trim());
  const dis = (name) => f.getByRole('button', { name }).isDisabled();
  const out = {};
  await f.getByRole('button', { name: '$0.01', exact: true }).click();
  await page.waitForTimeout(400);
  out.afterChipMin = await bet();
  out.popupOpenAfterChip = await f.evaluate(() => !!document.querySelector('.popup'));
  if (out.popupOpenAfterChip) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  out.minusDisabledAtMin = await dis('Decrease bet');
  let presses = 0;
  while (!(await dis('Increase bet')) && presses < 60) { await f.getByRole('button', { name: 'Increase bet' }).click(); presses++; }
  out.plusPressesToMax = presses; out.atMax = await bet(); out.plusDisabledAtMax = await dis('Increase bet');
  const seen = [];
  for (let i = 0; i < 4; i++) { await f.getByRole('button', { name: 'Decrease bet' }).click(); seen.push(await bet()); }
  out.stepDownFromMax = seen;
  return out;
}
