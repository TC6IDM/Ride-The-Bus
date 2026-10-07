async page => {
  // The versions to launch: the latest uploaded math and front.
  const MATH = 13, FRONT = 72;
  const q = globalThis.__q || 'currency=USD&language=en&deviceType=desktop&balance=1000000000&social=false';
  await page.goto(`https://studio.engine.io/teams/takeovercasino/games/ride-the-bus/math?launch=true&team=takeovercasino&game=ride-the-bus&${q}&math=${MATH}&front=${FRONT}&checklist=false&replay=false&amount=1000000`);
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
    if (f) {
      await page.waitForTimeout(7000);
      return { ok: true, frame: f.url().replace(/sessionID=[^&]+/, 'sessionID=<redacted>') };
    }
  }
  return { ok: false, url: page.url().slice(0, 120) };
}
