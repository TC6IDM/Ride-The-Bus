// Checks no script can close, and why. A check listed here can still have a
// task that gathers SIMULATED evidence for it (recorded, never ticked); the
// box stays the owner's.
export const MANUAL = {
  'SES-03': 'needs a session that has genuinely lapsed (ERR_IS); the forged-token half runs as SIMULATED',
  'CMP-12': 'a real phone: double-tap must not zoom, pinch must; the viewport and touch-action half runs as SIMULATED',
  'CMP-14': 'search Stake\'s own catalogue for the title (needs the owner\'s sign-in and judgement)',
  'CMP-18': 'listen with NVDA or VoiceOver; the accessibility-tree half runs as SIMULATED',
  'DEV-04': 'compare the suits and the sound icon on iOS, Android, Windows and macOS',
  'DEV-05': 'play on a real cellular connection; a throttled-network round runs as SIMULATED',
  'PRF-03': 'a performance trace on a mid-range Android; a CPU-throttled trace runs as SIMULATED',
};
