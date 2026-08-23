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
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP = path.join(ROOT, 'web-sdk/apps/Ride-The-Bus');

const GAME_PORT = process.env.GAME_PORT || '3001';
const REPLAY_PORT = process.env.REPLAY_PORT || '3010';

const children = [];
let shuttingDown = false;

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
start('game', '32', `npm run dev -- --port ${GAME_PORT}`, APP, {});
