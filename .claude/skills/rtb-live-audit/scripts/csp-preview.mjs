// Serve a production build/ the way Stake Engine's CDN does, BEFORE uploading it.
//
//   node .claude/skills/rtb-live-audit/scripts/csp-preview.mjs [buildDir] [port]
//   -> http://localhost:4321/ride-the-bus/v71/?replay=true&game=019f7e00-fa38-78fa-9ea7-b4933e75765b&version=13&mode=red_higher_outside_heart&event=2484&currency=USD&amount=1000000&lang=en&rgs_url=rgsd.engine.io
//
// Why it exists: on 2026-10-05 the live CDN's Content-Security-Policy refused
// every font the inline bundle carried as a data: URI (`font-src 'self'`), and
// no local server could show it, because none sends that header. This one sends
// the CDN's header verbatim (copied from the live response for front v71) and
// mounts the build under a versioned sub-path like the CDN does, so a relative
// asset path that would miss is caught here too.
//
// What to check in the page: document.fonts all `loaded` once used, no console
// error mentioning Content Security Policy, and every request same-origin or
// to the RGS. A replay URL (above) renders a round without a session.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const BUILD = resolve(process.argv[2] ?? 'web-sdk/apps/Ride-The-Bus/build');
const PORT = Number(process.argv[3] ?? 4321);
const MOUNT = '/ride-the-bus/v71/';

// Verbatim from the live CDN, 2026-10-05 (takeovercasino.live.engine.io).
const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' data: https://rgs.engine.io https://rgs2.engine.io https://rgsd.engine.io https://rgs.stake-engine.com https://rgs2.stake-engine.com https://rgsd.stake-engine.com https://rgs.twist-rgs.com https://rgs.twist-rgs-sweepstake.com; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors *;";

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

createServer(async (req, res) => {
  const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
  if (!path.startsWith(MOUNT)) {
    res.writeHead(302, { Location: MOUNT });
    return res.end();
  }
  let file = normalize(join(BUILD, path.slice(MOUNT.length) || 'index.html'));
  if (!file.startsWith(BUILD)) return res.writeHead(403).end();
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Content-Security-Policy': CSP });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Security-Policy': CSP }).end('not found');
  }
}).listen(PORT, () => console.log(`CDN-like preview of ${BUILD} at http://localhost:${PORT}${MOUNT}`));
