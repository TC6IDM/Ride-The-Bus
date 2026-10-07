async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  const tab = await page.context().newPage();
  await tab.setViewportSize({ width: 1200, height: 675 });
  const t0 = Date.now();
  await tab.goto(f.url().replace(/rgs_url=[^&]+/, 'rgs_url=rgs.invalid.example')).catch(() => {});
  const marks = [];
  for (const at of [2, 5, 9, 13]) {
    const wait = at * 1000 - (Date.now() - t0); if (wait > 0) await tab.waitForTimeout(wait);
    const st = await tab.evaluate(() => {
      const d = document.querySelector('[role=alertdialog], [role=dialog], .error-dialog');
      if (!d) return { dialog: false };
      const r = d.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      const cs = getComputedStyle(d);
      return { dialog: true, onTop: d.contains(top), topIs: top ? (top.className || top.tagName).toString().slice(0, 50) : null, opacity: cs.opacity, visibility: cs.visibility, z: cs.zIndex, rect: [Math.round(r.width), Math.round(r.height)] };
    });
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/ses05-t${at}.png` });
    marks.push({ at, ...st });
  }
  await tab.close();
  return marks;
}
