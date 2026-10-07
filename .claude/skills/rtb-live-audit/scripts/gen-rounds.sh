#!/bin/sh
# usage: gen-rounds.sh <name> <familyLabel|-> <rounds> <picksCSV|->
NAME=$1; FAM=$2; N=$3; PICKS=$4
"$(dirname "$0")/mk.sh" "$NAME" <<JS
const f = frameOf(page);
const FAM = '$FAM', N = $N, PICKS = '$PICKS';
const modeNow = () => f.evaluate(() => document.querySelector('.cb-mode-btn')?.getAttribute('title'));
while (await f.locator('.popup').count()) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
if (FAM !== '-' && (await modeNow()) !== FAM) {
  await f.getByRole('button', { name: /Choose game mode/ }).click(); await page.waitForTimeout(450);
  await f.locator('.popup').getByRole('button', { name: new RegExp('^' + FAM) }).click(); await page.waitForTimeout(450);
  await f.locator('.popup').getByRole('button', { name: /^Switch/ }).click(); await page.waitForTimeout(700);
}
if (PICKS !== '-') {
  const cols = f.locator('.choice-row .choice-column');
  const names = PICKS.split(',');
  for (let i = 0; i < names.length; i++) {
    const b = cols.nth(i).getByRole('button', { name: names[i], exact: true }).first();
    const cls = (await b.getAttribute('class')) || '';
    if (!/selected/.test(cls)) { await b.click(); await page.waitForTimeout(150); }
  }
}
const rounds = [];
for (let i = 0; i < N; i++) {
  const before = (await boardState(f)).balance;
  const rec = recorder(page);
  await f.getByRole('button', { name: 'Deal' }).click();
  const waited = await waitSettled(page, f, 45000);
  await page.waitForTimeout(900);
  rec.stop();
  const b = await boardState(f);
  rounds.push({ before, after: b.balance, lastWin: b.lastWin, readout: b.readout, waited, error: b.error, rgs: rec.log });
}
return { mode: await modeNow(), rounds };
JS
