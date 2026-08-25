/**
 * PreToolUse guard for Ride The Bus.
 *
 * WHY THIS EXISTS. CLAUDE.md carries two absolute standing rules — never commit
 * or push without asking every single time, and never run math or production
 * builds — and until this file existed both were enforced only by the model
 * reading prose and choosing to obey. That is not enforcement. A hook is.
 *
 * Reads the PreToolUse payload on stdin, prints a decision on stdout, exits 0.
 * No jq: this shell does not have it. Node is already a hard dependency here.
 *
 * Decisions:
 *   deny — a 40-minute math build or a 10-minute production build. The user
 *          runs these and pastes the output back; nothing in a session should
 *          start one.
 *   ask  — commit and push. NOT deny: the user does want to commit, they want
 *          to be asked first, every time, with approval never carrying over.
 *          "ask" is exactly that, and it cannot be allowlisted away.
 *
 * The bare-push case is its own rule because it is silent: local `main` tracks
 * `origin/monorepo-restructure`, so `git push` from main lands somewhere the
 * name does not suggest. Push `main:main` explicitly or re-point the upstream.
 */

const read = async () => {
	const chunks = [];
	for await (const c of process.stdin) chunks.push(c);
	return Buffer.concat(chunks).toString('utf8');
};

const decide = (decision, reason) => {
	process.stdout.write(
		JSON.stringify({
			hookSpecificOutput: {
				hookEventName: 'PreToolUse',
				permissionDecision: decision,
				permissionDecisionReason: reason,
			},
		}),
	);
	process.exit(0);
};

const payload = await read().catch(() => '');
let cmd = '';
try {
	cmd = JSON.parse(payload)?.tool_input?.command ?? '';
} catch {
	process.exit(0); // Unparseable payload is not this hook's business.
}
if (typeof cmd !== 'string' || !cmd.trim()) process.exit(0);

// --- Builds: hard deny -----------------------------------------------------

// The math build. run.py regenerates 192 modes and takes 40+ minutes.
if (/\b(?:python3?|py)\b[^|;&]*\brun\.py\b/.test(cmd)) {
	decide(
		'deny',
		'Math build blocked (CLAUDE.md standing rule 2). run.py regenerates all ' +
			'192 modes and takes 40+ minutes. The user runs this and pastes the ' +
			'output back — ask them rather than starting it.',
	);
}

// Production/web builds. 10+ minutes, and `bundleStrategy: "inline"` makes them
// expensive. `npm run check` / `check:svelte` are cheap and deliberately allowed.
if (/\b(?:npm|pnpm|yarn)\s+(?:run\s+)?build\b/.test(cmd) || /\bvite\s+build\b/.test(cmd)) {
	decide(
		'deny',
		'Production build blocked (CLAUDE.md standing rule 2) — 10+ minutes. ' +
			'For cheap verification use: npm run test, npm run check, ' +
			'npm run check:svelte, npm run lint.',
	);
}

// --- Git: ask, every single time -------------------------------------------

const isCommit = /\bgit\b[^|;&]*\bcommit\b/.test(cmd);
const isPush = /\bgit\b[^|;&]*\bpush\b/.test(cmd);

if (isPush) {
	// A push with no refspec inherits the branch's upstream, which on this repo
	// is not what the branch name implies.
	const hasRefspec = /\bpush\b\s+\S+\s+\S+/.test(cmd) || /\bpush\b[^|;&]*(--set-upstream|-u)\b/.test(cmd);
	if (!hasRefspec) {
		let branch = '';
		try {
			branch = (await import('node:child_process'))
				.execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
				.trim();
		} catch {
			/* not a repo, or git unavailable — fall through to the generic ask */
		}
		if (branch === 'main') {
			decide(
				'deny',
				'Bare `git push` from main is blocked. Local main tracks ' +
					'origin/monorepo-restructure, not origin/main, so this would push ' +
					'somewhere the branch name does not suggest. Use `git push origin ' +
					'main:main` explicitly, or re-point the upstream first.',
			);
		}
	}
}

if (isCommit || isPush) {
	decide(
		'ask',
		'CLAUDE.md standing rule 1: never commit or push without asking first, ' +
			'every single time — approval for one batch never carries to the next.',
	);
}

process.exit(0);
