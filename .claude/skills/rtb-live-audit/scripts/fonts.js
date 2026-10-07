async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  return await f.evaluate(async () => {
    const r = await fetch(location.pathname, { cache: 'no-store' });
    const csp = r.headers.get('content-security-policy');
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || null;
    await document.fonts.ready;
    const faces = [...document.fonts].map(ff => ff.family.replace(/"/g, '') + ':' + ff.weight + ':' + ff.status);
    const counts = faces.reduce((a, s) => { const k = s.split(':')[0] + ':' + s.split(':')[2]; a[k] = (a[k] || 0) + 1; return a; }, {});
    return { cspHeader: csp, cspMeta: meta, fontStatus: counts,
      geist: document.fonts.check('16px Geist'), bigShoulders: document.fonts.check('700 16px "Big Shoulders"') || document.fonts.check('700 16px "Big Shoulders Display"'),
      bodyFont: getComputedStyle(document.querySelector('.cb-balance') || document.body).fontFamily.slice(0, 80) };
  });
}
