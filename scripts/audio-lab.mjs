/**
 * Hear the game by looking at it.
 *
 * Captures the REAL audio graph's output from a running page - not a
 * re-implementation - then renders it as numbers and as pictures, because
 * pictures are the part I can actually judge.
 *
 *   node audio-lab.mjs --scene table --seconds 18 --out bed-table
 *
 * HOW THE CAPTURE WORKS
 * AudioNode.prototype.connect is patched before any page script runs, so
 * anything that connects to ctx.destination is also connected to a
 * ScriptProcessorNode that copies raw samples. That gets the real limiter, the
 * real generated room, the real scheduler jitter - everything a player hears.
 *
 * WHY NOT FFMPEG
 * Playwright's bundled ffmpeg muxes only image2 and webm and has no
 * showspectrumpic / showwavespic filters, so it can neither write a WAV nor
 * draw a spectrogram. Everything below is therefore hand-rolled against Node's
 * built-in zlib. No new dependency, which matters in a repo whose bundle is
 * inlined and whose size is a rating criterion.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import zlib from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// From this file's own location, never from pwd. An ad-hoc capture script run
// from inside the app once wrote 18 PNGs where .gitignore could not reach them.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'scripts/.shots/audio');
const CHROME =
  process.env.CHROME_PATH ||
  path.join(process.env.LOCALAPPDATA || '', 'ms-playwright/chromium-1234/chrome-win64/chrome.exe');
const GAME_PORT = Number(process.env.GAME_PORT || 3001);

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const SCENE = val('scene', 'table');
const SECONDS = Number(val('seconds', 18));
const NAME = val('out', `bed-${SCENE}`);
// --play captures a REAL round on top of the bed: card flips, the stage cues
// and the win fanfare, all through the shared limiter. That is the only way to
// see whether the cues duck the room into nothing.
const PLAY = argv.includes('--play');
const MODE = val('mode', 'red_equal_equal_heart');
const EVENT = val('event', '975');
const REPLAY_PORT = Number(process.env.REPLAY_PORT || 3010);
// Extra query parameters, appended to whichever URL is built below. The bed's
// dev overrides are the reason: ?dev_music= auditions a candidate and ?dev_loop=
// shortens its region, and a five-minute loop cannot otherwise be made to wrap
// inside a capture at all.
//
//   npm run audio -- --params "dev_loop=40,70,4" --seconds 40
//   npm run audio -- --params "dev_music=<id>" --play
const PARAMS = val("params", "");
// Simulate an embedder that grants autoplay - Stake serves the game in an
// iframe and may set allow="autoplay". With it, primeAudio opens the graph on
// mount and the bed plays UNDER the loading screen with nothing ever pressed;
// without it, the first gesture is what starts the music. Both are real, and
// only this flag can reach the first.
const AUTOPLAY = argv.includes("--autoplay");
const SR = 48000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- in-page tap --------------------------------------------------------- */
const TAP = `
(() => {
  const origConnect = AudioNode.prototype.connect;
  window.__rtb = { chunks: [], installing: false, ready: false, frames: 0 };
  AudioNode.prototype.connect = function (dest, ...rest) {
    const out = origConnect.call(this, dest, ...rest);
    const R = window.__rtb;
    if (R.installing) return out;
    try {
      if (dest && this.context && dest === this.context.destination) {
        const ctx = this.context;
        if (!R.proc) {
          R.installing = true;
          window.__rtbCtx = ctx;
          const proc = ctx.createScriptProcessor(4096, 2, 2);
          proc.onaudioprocess = (e) => {
            if (!R.recording) return;
            const L = e.inputBuffer.getChannelData(0);
            const Rc = e.inputBuffer.getChannelData(1);
            const n = L.length;
            const mono = new Int16Array(n);
            for (let i = 0; i < n; i++) {
              let v = (L[i] + Rc[i]) * 0.5;
              v = Math.max(-1, Math.min(1, v));
              mono[i] = (v * 32767) | 0;
            }
            R.chunks.push(mono);
            R.frames += n;
          };
          const sink = ctx.createGain();
          sink.gain.value = 0;
          origConnect.call(proc, sink);
          origConnect.call(sink, ctx.destination);
          R.proc = proc;
          R.installing = false;
          R.ready = true;
        }
        origConnect.call(this, R.proc);
      }
    } catch (err) { R.err = String(err); R.installing = false; }
    return out;
  };
})();
`;

/* ---- WAV ----------------------------------------------------------------- */
function writeWav(file, int16, sampleRate) {
  const data = Buffer.from(int16.buffer, int16.byteOffset, int16.length * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([h, data]));
}

/* ---- PNG (zlib is built in, so this is a real deflated PNG) -------------- */
const CRC = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return (buf) => { let c = -1;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0; };
})();
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(CRC(td));
  return Buffer.concat([len, td, crc]);
}
/** rgb: (x,y) => [r,g,b] */
function writePng(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let o = 0;
  for (let y = 0; y < h; y++) {
    raw[o++] = 0;
    for (let x = 0; x < w; x++) { const [r, g, b] = rgb(x, y); raw[o++] = r; raw[o++] = g; raw[o++] = b; }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]));
}

/* ---- DSP ----------------------------------------------------------------- */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k];
        const vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi;
        re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

const FFT = 2048;
function spectrogram(samples) {
  const hop = Math.floor(FFT / 2);
  const cols = Math.max(1, Math.floor((samples.length - FFT) / hop));
  const win = new Float64Array(FFT);
  for (let i = 0; i < FFT; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (FFT - 1));
  const out = [];
  for (let c = 0; c < cols; c++) {
    const re = new Float64Array(FFT), im = new Float64Array(FFT);
    for (let i = 0; i < FFT; i++) re[i] = (samples[c * hop + i] / 32768) * win[i];
    fft(re, im);
    const mags = new Float64Array(FFT / 2);
    for (let i = 0; i < FFT / 2; i++) mags[i] = Math.hypot(re[i], im[i]) / (FFT / 2);
    out.push(mags);
  }
  return out;
}

function metrics(samples, spec) {
  const n = samples.length;
  let peak = 0, sum = 0;
  for (let i = 0; i < n; i++) { const v = Math.abs(samples[i] / 32768); if (v > peak) peak = v; sum += v * v; }
  const rms = Math.sqrt(sum / n);
  const db = (x) => (x > 0 ? 20 * Math.log10(x) : -Infinity);

  // short-term RMS, for how much the level actually moves
  const win = SR * 0.4, st = [];
  for (let i = 0; i + win < n; i += win) {
    let s = 0; for (let k = 0; k < win; k++) { const v = samples[i + k] / 32768; s += v * v; }
    st.push(Math.sqrt(s / win));
  }
  st.sort((a, b) => a - b);
  const pct = (p) => st.length ? st[Math.min(st.length - 1, Math.floor(p * st.length))] : 0;

  // spectral centroid + flatness, averaged
  let cent = 0, flat = 0, frames = 0;
  const bandE = new Array(8).fill(0);
  const EDGES = [0, 60, 120, 250, 500, 1000, 2000, 4000, 24000];
  for (const mags of spec) {
    let num = 0, den = 0, logSum = 0, linSum = 0, cnt = 0;
    for (let i = 1; i < mags.length; i++) {
      const f = (i * SR) / FFT, m = mags[i];
      num += f * m; den += m;
      if (m > 0) { logSum += Math.log(m); linSum += m; cnt++; }
      for (let b = 0; b < 8; b++) if (f >= EDGES[b] && f < EDGES[b + 1]) { bandE[b] += m * m; break; }
    }
    if (den > 0) { cent += num / den; frames++; }
    if (cnt > 0) flat += Math.exp(logSum / cnt) / (linSum / cnt);
  }
  const bandTotal = bandE.reduce((a, b) => a + b, 0) || 1;
  return {
    seconds: +(n / SR).toFixed(2),
    peakDb: +db(peak).toFixed(2),
    rmsDb: +db(rms).toFixed(2),
    crestDb: +(db(peak) - db(rms)).toFixed(2),
    quietDb: +db(pct(0.1)).toFixed(2),
    loudDb: +db(pct(0.9)).toFixed(2),
    movementDb: +(db(pct(0.9)) - db(pct(0.1))).toFixed(2),
    clipped: samples.reduce((a, v) => a + (Math.abs(v) >= 32767 ? 1 : 0), 0),
    centroidHz: frames ? Math.round(cent / frames) : 0,
    flatness: frames ? +(flat / spec.length).toFixed(4) : 0,
    bands: EDGES.slice(0, 8).map((lo, i) => ({
      band: `${lo}-${EDGES[i + 1]}Hz`, pct: +((100 * bandE[i]) / bandTotal).toFixed(1),
    })),
  };
}

/* ---- pictures ------------------------------------------------------------ */
function drawSpectrogram(file, spec) {
  const W = Math.min(1100, spec.length), H = 420;
  const maxBin = Math.floor((12000 / SR) * FFT);       // 0-12 kHz is where this game lives
  const ramp = (v) => {                                 // dark green -> gold -> cream
    const t = Math.max(0, Math.min(1, v));
    if (t < 0.5) { const u = t / 0.5; return [Math.round(8 + u * 60), Math.round(24 + u * 90), Math.round(16 + u * 40)]; }
    const u = (t - 0.5) / 0.5;
    return [Math.round(68 + u * 187), Math.round(114 + u * 141), Math.round(56 + u * 189)];
  };
  writePng(file, W, H, (x, y) => {
    const col = spec[Math.floor((x / W) * spec.length)];
    if (!col) return [8, 24, 16];
    const frac = 1 - y / H;                             // log frequency axis
    const bin = Math.max(1, Math.round(Math.pow(maxBin, frac)));
    const m = col[Math.min(col.length - 1, bin)] || 0;
    const dbv = 20 * Math.log10(m + 1e-9);
    return ramp((dbv + 90) / 90);
  });
}
function drawWaveform(file, samples) {
  const W = 1100, H = 240, per = Math.floor(samples.length / W);
  const peaks = [];
  for (let x = 0; x < W; x++) {
    let mn = 0, mx = 0;
    for (let i = 0; i < per; i++) { const v = samples[x * per + i] / 32768; if (v < mn) mn = v; if (v > mx) mx = v; }
    peaks.push([mn, mx]);
  }
  writePng(file, W, H, (x, y) => {
    const t = 1 - (2 * y) / H;
    const [mn, mx] = peaks[x];
    if (Math.abs(t) < 0.002) return [70, 90, 76];
    return t >= mn && t <= mx ? [47, 154, 94] : [12, 26, 18];
  });
}

/* ---- run ----------------------------------------------------------------- */
async function main() {
  mkdirSync(OUT, { recursive: true });
  const port = 9350 + Math.floor(Math.random() * 200);
  const userDir = mkdtempSync(path.join(tmpdir(), 'rtb-audio-'));
  const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDir}`, '--no-first-run', '--disable-gpu', '--hide-scrollbars',
    ...(AUTOPLAY ? ['--autoplay-policy=no-user-gesture-required'] : []),
    // NO --autoplay-policy override BY DEFAULT. The context is meant to start suspended;
    // audioGraph's `ctx.resume().then(announce)` is what wakes music.ts's
    // scheduler, and forcing 'running' skips that branch entirely - which is
    // what made an early run of this tool report the lobby bed as dead. --autoplay
    // opts into the other case on purpose, and is the only way to capture the
    // loading screen, which has nothing to press.
    'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 150; i++) { await sleep(120); try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch {} }
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = new Map();
  ws.onmessage = (m) => { const g = JSON.parse(m.data); if (!g.id || !pending.has(g.id)) return;
    const { res, rej } = pending.get(g.id); pending.delete(g.id);
    g.error ? rej(new Error(JSON.stringify(g.error))) : res(g.result); };
  const send = (mth, p = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, { res, rej }); ws.send(JSON.stringify({ id: n, method: mth, params: p })); });
  const ev = async (b) => {
    const r = await send('Runtime.evaluate', { expression: `(async () => { ${b} })()`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: TAP });
  const url = PLAY
    ? `http://localhost:${GAME_PORT}/?replay=true&game=ride_the_bus&version=1` +
      `&mode=${MODE}&event=${EVENT}&rgs_url=localhost%3A${REPLAY_PORT}` +
      `&currency=USD&amount=1000000&lang=en`
    : `http://localhost:${GAME_PORT}/`;
  const full = PARAMS ? url + (url.includes('?') ? '&' : '?') + PARAMS : url;
  if (PARAMS) console.log('params:', PARAMS);
  await send('Page.navigate', { url: full });
  // 'loading' is the one scene that must NOT be waited for or clicked into: it
  // is the loader, it lasts 1.4-8s, and the whole question about it is whether
  // the bed plays with nothing pressed. Waiting for .ss-continue would miss it
  // and a gesture would answer a different question - so pair it with --autoplay.
  if (SCENE === 'loading') {
    // Poll for the graph rather than sleeping a guess: on a cold dev server the
    // page can take seconds to boot, and the loader itself only lives 1.4-8s, so
    // a fixed wait either misses the graph or misses the loader. Report which of
    // the two was true when the capture began - a bed under a loader that has
    // already gone would be a different measurement entirely.
    for (let i = 0; i < 100; i++) {
      if (await ev(`return !!window.__rtb.ready;`)) break;
      await sleep(100);
    }
    const up = await ev(`return !!document.querySelector('.game-loader');`);
    console.log(`loader on screen at capture: ${up}`);
  } else {
    await sleep(10000);
    for (let i = 0; i < 80; i++) { if (await ev(`return !!document.querySelector('.ss-continue');`)) break; await sleep(200); }
  }
  // The scene is reached by PLAYING to it rather than by poking music.setScene,
  // so what is captured is the bed the game actually puts there. 'lobby' is the
  // start screen; 'table' is the board.
  //
  // Either way a REAL gesture has to land first. Browsers refuse to start an
  // AudioContext until the user has interacted, and audioGraph builds its
  // context lazily on the first cue - so before any click there is no graph at
  // all, nothing is connected to a destination, and the tap has nothing to
  // attach to. For 'table' the continue button is that gesture. For 'lobby'
  // there is nothing to press that keeps you on the screen, so a CDP mouse
  // click is dispatched at a corner instead: it is a trusted gesture, it
  // unlocks audio, and it leaves the start screen up.
  if (SCENE === 'loading') {
    // Nothing to press, deliberately.
  } else if (SCENE === 'lobby') {
    // A real control on the start screen, because the CUE BOOK is what opens
    // the context - music deliberately never does (see contextTime). A help
    // badge or a demo pick is exactly the first press a player makes here.
    // A TRUSTED gesture, dispatched through CDP at the control's real
    // coordinates. el.click() from script is not one: the context still gets
    // built (the cue book calls ensureContext regardless) but ctx.resume() is
    // refused and its promise never settles, so the context sits suspended and
    // the music scheduler - which requires state 'running' - never starts.
    const box = await ev(`
      const el = document.querySelector('.ss-help') || document.querySelector('.half-btn');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), cls: el.className };`);
    if (box) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
    console.log('lobby gesture:', box ? `${box.cls} @ ${box.x},${box.y}` : 'NONE FOUND');
  } else {
    // Trusted, for the same reason as the lobby branch above: el.click() from
    // script does not unlock an AudioContext, so a synthetic press here left
    // the context suspended and captured zero frames.
    const box = await ev(`
      const el = document.querySelector('.ss-continue');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };`);
    if (box) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
  }
  await sleep(SCENE === 'loading' ? 300 : 3000);

  const st = await ev(`return { ready: window.__rtb.ready, err: window.__rtb.err||null, state: window.__rtbCtx?window.__rtbCtx.state:null, sr: window.__rtbCtx?window.__rtbCtx.sampleRate:null };`);
  console.log('tap:', JSON.stringify(st));
  if (!st.ready) {
    console.error(
      [
        'NO TAP - nothing has connected to ctx.destination, so no audio graph exists yet.',
        'Usually means no cue has fired: the context is built lazily on the first one,',
        'and browsers block it until a real user gesture. Not a tool failure - it means',
        'the game is genuinely silent at this point.',
      ].join('\n'),
    );
    proc.kill();
    return;
  }
  // Never await resume() unguarded: without a trusted gesture it is refused and
  // the promise simply never settles, which hangs the whole run.
  if (st.state !== 'running') {
    const resumed = await ev(`
      const r = await Promise.race([
        window.__rtbCtx.resume().then(() => 'resumed').catch((e) => 'refused: ' + e),
        new Promise((res) => setTimeout(() => res('timed out'), 3000)),
      ]);
      return r + ' (state ' + window.__rtbCtx.state + ')';`);
    console.log('resume:', resumed);
  }

  await ev(`window.__rtb.chunks.length = 0; window.__rtb.frames = 0; window.__rtb.recording = true; return true;`);

  // Deal, once recording is live, so the round lands inside the capture.
  if (PLAY) {
    const box = await ev(`
      const el = document.querySelector('.ss-play-btn') || document.querySelector('.cb-spin');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), cls: el.className };`);
    if (box) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    }
    console.log('dealt:', box ? box.cls : 'NO PLAY BUTTON FOUND');
  }
  console.log(`recording ${SECONDS}s...`);
  await sleep(SECONDS * 1000);
  const frames = await ev(`window.__rtb.recording = false; return window.__rtb.frames;`);
  console.log('frames:', frames);

  // pull in slices so one evaluate never returns a huge string
  const all = new Int16Array(frames);
  let got = 0, ci = 0;
  while (got < frames) {
    const b64 = await ev(`
      const R = window.__rtb; let take = [], n = 0;
      while (R.chunks.length && n < 400000) { const c = R.chunks.shift(); take.push(c); n += c.length; }
      if (!take.length) return null;
      const merged = new Int16Array(n); let o = 0;
      for (const c of take) { merged.set(c, o); o += c.length; }
      const b = new Uint8Array(merged.buffer); let s = '';
      const CH = 8192;
      for (let i = 0; i < b.length; i += CH) s += String.fromCharCode.apply(null, b.subarray(i, i + CH));
      return btoa(s);`);
    if (!b64) break;
    const buf = Buffer.from(b64, 'base64');
    const part = new Int16Array(buf.buffer, buf.byteOffset, buf.length / 2);
    all.set(part.subarray(0, Math.min(part.length, frames - got)), got);
    got += part.length; ci++;
  }
  console.log('pulled:', got, 'samples in', ci, 'slices');
  try { ws.close(); } catch {}
  proc.kill();
  try { rmSync(userDir, { recursive: true, force: true }); } catch {}

  const samples = all.subarray(0, got);
  writeWav(path.join(OUT, `${NAME}.wav`), samples, SR);
  const spec = spectrogram(samples);
  const m = metrics(samples, spec);
  drawSpectrogram(path.join(OUT, `${NAME}-spectrogram.png`), spec);
  drawWaveform(path.join(OUT, `${NAME}-waveform.png`), samples);
  writeFileSync(path.join(OUT, `${NAME}-metrics.json`), JSON.stringify(m, null, 1));
  console.log('\n' + JSON.stringify(m, null, 1));
}

main().catch((e) => { console.error('FAILED', e); process.exit(1); });
