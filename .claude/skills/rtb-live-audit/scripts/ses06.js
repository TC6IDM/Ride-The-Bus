async page => {
  const f = page.frames().find(fr => fr.url().includes('live.engine.io'));
  return await f.evaluate(async () => {
    const html = await (await fetch(location.pathname + 'index.html', { cache: 'no-store' })).text();
    const count = (re) => (html.match(re) || []).length;
    return {
      bytes: html.length,
      sdkLoaderBg_041721: count(/#041721/gi),
      loaderStakeEngine: count(/LoaderStakeEngine|stake-engine-loader|stakeEngineLoader/gi),
      stakeLoaderAsset: count(/loader[^"']{0,40}\.(json|webm|mp4|gif)/gi),
      ownLoaderClass: count(/rtb-loader|class="loader|\.loader\b/gi),
      externalOrigins: [...new Set((html.match(/https?:\/\/[a-z0-9.-]+/gi) || []))].filter(u => !/svelte\.dev|example\.com|openjsf|npms\.io|w3\.org|github\.com|mozilla/.test(u)).slice(0, 15),
    };
  });
}
