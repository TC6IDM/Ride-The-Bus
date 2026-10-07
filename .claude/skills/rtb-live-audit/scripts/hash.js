async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  return await f.evaluate(async () => {
    const buf = await (await fetch(location.pathname + 'index.html', { cache: 'no-store' })).arrayBuffer();
    const h = await crypto.subtle.digest('SHA-256', buf);
    return { bytes: buf.byteLength, sha256: [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('') };
  });
}
