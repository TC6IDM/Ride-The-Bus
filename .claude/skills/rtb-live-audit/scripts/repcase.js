async page => {
  // The front version under test, read off the live game frame.
  const FRONT = (page.frames().map(fr => fr.url()).find(u => u.includes('live.engine.io')) || '').match(/\/(v\d+)\//)?.[1] || 'v73';
  // Replays on the uploaded build, one tab per case. Records the book, the
  // takeover's title/amount as it climbs, the fan, the settled board and the
  // Round details panel. Cases: [mode, event, {currency, amount, lang, w, h, tag, tapMid}]
  const G = '019f7e00-fa38-78fa-9ea7-b4933e75765b';
  const CASES = __CASES__;
  const out = [];
  for (const [mode, event, o = {}] of CASES) {
    const w = o.w || 1200, h = o.h || 675;
    const tab = await page.context().newPage();
    await tab.setViewportSize({ width: w, height: h });
    let book = null; const wallet = [];
    tab.on('request', r => { if (/\/wallet\//.test(r.url())) wallet.push(r.url().replace(/^https?:\/\/[^\/]+/, '')); });
    tab.on('response', async r => {
      if (!/\/bet\/replay\//.test(r.url())) return;
      try {
        const j = await r.json(); const st = j.state || [];
        book = { status: r.status(), pm: j.payoutMultiplier, cost: j.costMultiplier,
          events: st.map(e => e.type + (e.payout !== undefined ? ':' + e.payout : '') + (e.ticket !== undefined ? ':t' + e.ticket : '') + (e.card ? ':' + (e.card.rank || '') + (e.card.suit || '') : '') + (e.forgiven ? ':FORGIVEN' : '') + (e.correct === false ? ':MISS' : '')).join(' ') };
      } catch { book = { status: r.status() }; }
    });
    const url = `https://takeovercasino.live.engine.io/ride-the-bus/${FRONT}/?replay=true&game=${G}&version=13&mode=${mode}&event=${event}&currency=${o.currency || 'USD'}&amount=${o.amount || 1000000}&lang=${o.lang || 'en'}&device=desktop&social=${o.social ? 'true' : 'false'}&rgs_url=rgsd.engine.io`;
    await tab.goto(url);
    await tab.waitForTimeout(6500);
    const details = await tab.evaluate(() => { const p = [...document.querySelectorAll('.popup, [class*=replay], [role=dialog], [class*=ss-]')].find(e => /\S/.test(e.innerText || '') && e.querySelector('button')); return p ? p.innerText.replace(/\s+/g, ' ').trim().slice(0, 400) : null; });
    const tag = o.tag || `${mode}-${event}-${o.lang || 'en'}-${o.currency || 'USD'}-${w}`;
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/rc-${tag}-0details.png` });
    await tab.getByRole('button', { name: /^(Play|Spielen|Jugar|Jouer|Pelaa|Graj|Jogar|Играть|Oyna|Chơi|Main|प्ले|プレイ|플레이|播放|تشغيل|اللعب|ابدأ).*$/i }).first().click({ timeout: 8000 }).catch(() => tab.locator('.ss-play-btn').first().click({ timeout: 4000 }).catch(() => {}));
    const climb = []; let takeoverShot = false; let tapped = false; const chipsDuring = [];
    let t0 = Date.now(); let fan = null; const stakeSeen = new Set();
    for (let i = 0; i < 160; i++) {
      await tab.waitForTimeout(150);
      const s = await tab.evaluate(() => {
        const ov = document.querySelector('.wc-overlay');
        const t = q => (document.querySelector(q)?.textContent || '').replace(/\s+/g, ' ').trim();
        return {
          ov: !!ov, title: t('.wc-title'), amount: t('.wc-amount'), mult: t('.wc-mult'), prompt: t('.wc-prompt, .wc-hint'),
          fanCards: ov ? ov.querySelectorAll('.wc-card, .wc-fan-card, [class*=fan] .card-face, [class*=fan-card]').length : 0,
          fanTicket: ov ? !!ov.querySelector('[class*=ticket]') : false,
          readout: t('.running-win-label') + ' ' + t('.running-win-amount') + ' ' + t('.running-win-mult'),
          chips: [...document.querySelectorAll('.card-mult')].map(e => (e.classList.contains('show') ? '' : '~') + e.textContent.trim()).join(' '),
          again: [...document.querySelectorAll('.cb-spin-caption')].map(e => e.textContent.trim()).join(''),
          stake: (() => { const rw = document.querySelector('.running-win'); const l = document.querySelector('.running-win-label'); const am = document.querySelector('.running-win-amount'); return rw && rw.classList.contains('is-at-stake') ? (l ? l.textContent.trim() : '') + '@' + (am ? getComputedStyle(am).color : '') : null; })(),
        };
      });
      chipsDuring.push(s.readout); if (s.stake) stakeSeen.add(s.stake);
      if (s.ov) {
        if (!fan) fan = { cards: s.fanCards, ticket: s.fanTicket };
        const last = climb[climb.length - 1];
        if (!last || last.title !== s.title) climb.push({ ms: Date.now() - t0, title: s.title, amount: s.amount, mult: s.mult }); else { last.lastAmount = s.amount; last.lastMult = s.mult; } if (s.amount && /^-/.test(s.amount)) climb.push({ NEGATIVE: s.amount });
        if (!takeoverShot && Date.now() - t0 > 2500) { await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/rc-${tag}-1takeover.png` }); takeoverShot = true; }
        if (o.tapMid && !tapped && Date.now() - t0 > 600 && climb.length >= 1) { await tab.locator('.wc-overlay').click({ force: true }).catch(() => {}); tapped = true; climb.push({ ms: Date.now() - t0, title: '<TAP>' }); }
        if (/continue|weiter|continuar|continuer|jatka|kontynuuj|продолж|devam|tiếp|lanjut|जारी|続け|계속|继续|متابعة|للمتابعة/i.test(s.prompt) && Date.now() - t0 > 1500) {
          await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/rc-${tag}-2settled.png` });
          await tab.locator('.wc-overlay').click({ force: true }).catch(() => {});
          await tab.waitForTimeout(600);
        }
      } else if (s.again) break;
    }
    await tab.waitForTimeout(800);
    const end = await tab.evaluate(() => {
      const t = q => (document.querySelector(q)?.textContent || '').replace(/\s+/g, ' ').trim();
      const tk = document.querySelector('.ticket-slot');
      return {
        readout: t('.running-win-label') + ' | ' + t('.running-win-amount') + ' | ' + t('.running-win-mult'),
        chips: [...document.querySelectorAll('.card-mult')].map(e => (e.classList.contains('show') ? '' : '~') + e.textContent.trim()),
        cards: [...document.querySelectorAll('.card-slot')].map(s => (s.querySelector('.card-inner.flipped') ? 'up' : 'down') + (s.classList.contains('is-bust') ? '/bust' : '') + (s.querySelector('.forgiven-mark') ? '/forgiven' : '') + (s.classList.contains('is-dead') ? '/dead' : '')),
        ticket: tk ? { flipped: !!tk.querySelector('.ticket-inner.flipped'), dead: tk.classList.contains('is-dead'), label: tk.getAttribute('aria-label') } : null,
        lastWin: t('.cb-lastwin'), bet: t('.cb-bet-display'), caption: t('.cb-spin-caption'),
        scroll: document.documentElement.scrollWidth > innerWidth + 1 || document.documentElement.scrollHeight > innerHeight + 1,
        dir: document.documentElement.dir, lang: document.documentElement.lang,
        chipInk: [...document.querySelectorAll('.card-mult')].map(e => (e.classList.contains('is-miss') ? 'miss' : 'win') + ':' + getComputedStyle(e).color + (e.getAttribute('aria-hidden') === 'true' ? ':hidden' : '')),
        cardNames: [...document.querySelectorAll('.card-block')].map(e => e.getAttribute('aria-label')),
        announce: t('.round-announcer'),
        labelInk: (() => { const am = document.querySelector('.running-win-amount'); return am ? getComputedStyle(am).color : null; })(),
        lastWinButton: !!document.querySelector('.cb-lastwin-btn'),
      };
    });
    await tab.screenshot({ path: `C:/Users/tcand/Desktop/Ride-The-Bus-monorepo/scripts/.shots/live/rc-${tag}-3end.png` });
    out.push({ tag, book, details, fan, climb: climb.slice(0, 40), end, walletCalls: wallet.length, stake: [...stakeSeen] });
    await tab.close();
  }
  return out;
}
