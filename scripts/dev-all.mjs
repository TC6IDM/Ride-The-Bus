/**
 * Start the game and the local replay RGS together.
 *
 *   npm run dev:replay        (from web-sdk/apps/Ride-The-Bus)
 *   node scripts/dev-all.mjs  (from the repo root)
 *
 * Deliberately dependency-free rather than reaching for `concurrently`. This
 * repo has no such dependency, the bundle is inlined into index.html and bundle
 * size is a rated criterion, so adding a package to run two commands is a bad
 * trade for one dev convenience.
 *
 * `shell: true` on both spawns, because on Windows `npm` is `npm.cmd` and is not
 * directly executable - this is the one flag that makes the same script work in
 * PowerShell, cmd and Git Bash.
 *
 * Both children share this process's lifetime: Ctrl-C, or either child exiting,
 * takes the other down too. A replay server left orphaned holding port 3010 is
 * exactly the kind of thing that makes the next run fail confusingly.
 */
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'web-sdk/apps/Ride-The-Bus');

const GAME_PORT = process.env.GAME_PORT || '3001';
const REPLAY_PORT = process.env.REPLAY_PORT || '3010';

// The link builder opens on its own, because it is the reason this script
// exists. --no-open for the times that is wrong: a second terminal alongside a
// tab you already have, or a scripted run that should not seize the desktop.
const OPEN_BUILDER = !process.argv.includes('--no-open');

/**
 * Run the inner script with whatever package manager started THIS one.
 *
 * `npm run dev:game` hardcoded works under pnpm too, but it makes the child a
 * different tool from the parent, and under pnpm that means npm reading a
 * node_modules tree pnpm laid out. Both agents populate .bin so it happens to
 * work; relying on that is the kind of thing that breaks on a version bump for
 * no reason anyone can find.
 *
 * npm_config_user_agent is set by npm, pnpm, yarn and bun alike and starts with
 * the name - "pnpm/10.5.0 npm/? node/v24...". Falls back to npm.
 */
const PM = (() => {
  const agent = process.env.npm_config_user_agent || '';
  const name = agent.split('/')[0];
  return ['npm', 'pnpm', 'yarn', 'bun'].includes(name) ? name : 'npm';
})();

const children = [];
let shuttingDown = false;

/* ---- Restart, not "start a second one" -----------------------------------
   Running this twice used to leave the first pair up: the replay server died on
   EADDRINUSE, and vite quietly moved to the next free port - so the browser tab
   still said 3001 and was showing a build from an hour ago, while the new one
   ran on 3002 where nothing was pointed at it. That is a genuinely nasty class
   of bug to debug, because everything LOOKS like it is working.

   So this reclaims its own ports first. Only the two ports it is about to bind;
   it does not go hunting for node processes by name, which would take out an
   unrelated editor or test run. */
function pidsOnPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        // "  TCP    0.0.0.0:3001   0.0.0.0:0   LISTENING   12345"
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5 || parts[3] !== 'LISTENING') continue;
        if (!parts[1].endsWith(`:${port}`)) continue;
        const pid = Number(parts[4]);
        if (Number.isInteger(pid) && pid > 0) pids.add(pid);
      }
      return [...pids];
    }
    const out = execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], {
      encoding: 'utf8',
    });
    return out.split(/\s+/).filter(Boolean).map(Number);
  } catch {
    // Nothing listening, or the tool is absent. Either way there is nothing to
    // reclaim and binding will tell us soon enough.
    return [];
  }
}

function reclaim(port, label) {
  const pids = pidsOnPort(port).filter((pid) => pid !== process.pid);
  for (const pid of pids) {
    try {
      if (process.platform === 'win32') {
        execFileSync('taskkill', ['/pid', String(pid), '/f', '/t'], { stdio: 'ignore' });
      } else {
        process.kill(pid, 'SIGTERM');
      }
      console.log(`  reclaimed port ${port} (${label}) from pid ${pid}`);
    } catch {
      console.log(`  could not free port ${port} (${label}, pid ${pid}) - it may not be yours`);
    }
  }
  return pids.length;
}

/**
 * Open a URL in the default browser. Best-effort: a failure here must never
 * stop the servers, which are the actual job.
 */
function openInBrowser(url) {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    spawn(command, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* headless box, or no handler registered - the URL is printed above anyway */
  }
}

function start(name, colour, command, cwd, env) {
  // One command STRING, no args array. With `shell: true` Node deprecates the
  // args form (DEP0190) because it concatenates rather than escapes - so the
  // quoting is done here, deliberately, instead.
  const child = spawn(command, {
    cwd,
    shell: true,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const tag = `\x1b[${colour}m${name.padEnd(6)}\x1b[0m │ `;
  const pipe = (stream, out) => {
    let buffer = '';
    stream.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) out.write(tag + line + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.log(`\n${name} exited (${code}). Stopping the other.\n`);
    stopAll();
  });

  children.push(child);
  return child;
}

function stopAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode !== null) continue;
    // Windows has no POSIX signals for a shell-spawned tree; taskkill /T is what
    // actually reaps vite's grandchildren.
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], { stdio: 'ignore' });
    } else {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => process.exit(0), 400);
}

process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);

const freed = reclaim(GAME_PORT, 'game') + reclaim(REPLAY_PORT, 'replay');
if (freed) {
  // Windows returns from taskkill before the socket is actually released.
  const until = Date.now() + 600;
  while (Date.now() < until) { /* spin briefly so the bind below succeeds */ }
}

console.log('');
console.log(`  game    http://localhost:${GAME_PORT}`);
console.log(`  replay  http://localhost:${REPLAY_PORT}   <- build replay links here`);
console.log('');
console.log('  Ctrl-C stops both.');
console.log('');

start('replay', '36', `node "${path.join(ROOT, 'scripts/replay-server.mjs')}"`, ROOT, {
  REPLAY_PORT,
  GAME_PORT,
});
// The port goes through the ENVIRONMENT, not the command line. vite.config.js
// reads GAME_PORT and sets server.port + strictPort from it; see the note there
// for why the `-- --port N` form could not survive being run under pnpm.
start('game', '32', `${PM} run dev:game`, APP, { GAME_PORT });

// After a beat, so the server is listening and the first paint is the page
// rather than a connection refused.
if (OPEN_BUILDER) {
  setTimeout(() => openInBrowser(`http://localhost:${REPLAY_PORT}`), 1200);
}
