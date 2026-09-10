/**
 * What the player has set: two buses, their levels, their mutes, and storage.
 *
 * No Web Audio scheduling happens here. The bus objects each hold the GainNode
 * that audioContext.ts builds for them, and applyGain writes through to it when
 * there is one - so this module is meaningful before a context exists, which is
 * exactly what a mute restored from localStorage at load needs.
 *
 * That direction matters and is the whole reason the split works: context
 * reaches IN to set `buses.<name>.gain`, and nothing here reaches back out.
 *
 * ONE OF FIVE. audioGraph.ts was 1,197 lines; it is now audioMixer.ts (what the
 * player has set), audioContext.ts (the one graph, and when it may open),
 * audioVariation.ts (the randomness every cue borrows), audioVoices.ts (tone,
 * noise, thud) and audioLoop.ts (the produced bed's overlapping passes). The
 * whole-graph argument - why ONE context, one limiter, one room - is at the top
 * of audioContext.ts.
 */

/**
 * Two buses, because a player who wants the music off usually still wants to
 * hear the cards. `volume` and `muted` are kept as SEPARATE fields rather than
 * collapsed into "volume 0 means muted", and that is what lets the two controls
 * in the panel agree with each other:
 *
 *   - the speaker button toggles `muted` and leaves `volume` where it was, so
 *     unmuting returns to the level the player had chosen rather than to a
 *     default;
 *   - dragging a slider to zero also mutes, so the speaker glyph never claims
 *     sound is on while the bus is silent;
 *   - unmuting a bus whose slider is parked at zero lifts it back to the last
 *     audible level, because a speaker button that visibly does nothing reads
 *     as broken.
 *
 * 0-100 rather than 0-1, and defaulting to 75, to match the convention the
 * platform already sets in state-shared/src/stateSound.svelte.ts.
 */
export type AudioBusName = 'music' | 'sfx';

const DEFAULT_VOLUME = 75;

/**
 * Level 75 lands the SFX path on 0.42 - the exact gain the single bus used
 * before it was split, so the default mix is unchanged for anyone upgrading.
 * The remaining headroom above 75 is real rather than clipped: the limiter is
 * still the last thing before the speakers.
 */
export const MASTER_HEADROOM = 0.56;

const STORAGE_PREFIX = 'ride-the-bus:';
/** What the single global mute was stored under before the split. */
const LEGACY_MUTE_KEY = `${STORAGE_PREFIX}muted`;

function readStored(key: string): string | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStored(key: string, value: string) {
	try {
		localStorage?.setItem(key, value);
	} catch {
		/* storage unavailable (private mode) - the setting still applies this session */
	}
}

type BusState = {
	volume: number;
	muted: boolean;
	/** Where an unmute returns to when the slider is sitting at zero. */
	lastAudible: number;
	gain: GainNode | null;
};

function loadBus(name: AudioBusName): BusState {
	// The null check has to come FIRST. Number(null) is 0, not NaN, and 0 passes
	// a finite-and-in-range test perfectly well - so folding the two together
	// silently gave every player with no stored setting a volume of zero, which
	// is to say it opened the game in silence for everyone installing it. Found
	// in the browser, not here: the unit test asked for the default and got 75,
	// because un-muting had already lifted it off the floor before the assert.
	const raw = readStored(`${STORAGE_PREFIX}vol:${name}`);
	const storedVolume = raw === null ? Number.NaN : Number(raw);
	const volume =
		Number.isFinite(storedVolume) && storedVolume >= 0 && storedVolume <= 100
			? storedVolume
			: DEFAULT_VOLUME;

	const storedMute = readStored(`${STORAGE_PREFIX}mute:${name}`);
	// Migration, not a fallback. A player who muted the game before the split
	// stored a single `ride-the-bus:muted`, and silently un-muting them on
	// upgrade is the one outcome that is definitely wrong.
	const muted = storedMute === null ? readStored(LEGACY_MUTE_KEY) === 'true' : storedMute === 'true';

	return { volume, muted, lastAudible: volume || DEFAULT_VOLUME, gain: null };
}

export const buses: Record<AudioBusName, BusState> = {
	music: loadBus('music'),
	sfx: loadBus('sfx'),
};

/** True when this bus would produce nothing - muted, or turned all the way down. */
export function silent(name: AudioBusName): boolean {
	const bus = buses[name];
	return bus.muted || bus.volume <= 0;
}

export function applyGain(name: AudioBusName) {
	const bus = buses[name];
	if (bus.gain) bus.gain.gain.value = silent(name) ? 0 : bus.volume / 100;
}

function persist(name: AudioBusName) {
	const bus = buses[name];
	writeStored(`${STORAGE_PREFIX}vol:${name}`, String(bus.volume));
	writeStored(`${STORAGE_PREFIX}mute:${name}`, String(bus.muted));
}

/**
 * Anything that needs to know the mix moved. music.ts subscribes so it can
 * release the looping track the moment its bus goes silent, and start it again
 * when the bus comes back - the same "off costs nothing" property the cues get
 * from returning before they build a node.
 */
const mixerListeners = new Set<() => void>();

export function onMixerChange(listener: () => void): () => void {
	mixerListeners.add(listener);
	return () => mixerListeners.delete(listener);
}

export function announce() {
	for (const listener of mixerListeners) listener();
}

export function busVolume(name: AudioBusName): number {
	return buses[name].volume;
}

export function isBusMuted(name: AudioBusName): boolean {
	return buses[name].muted;
}

/** True when the bus is producing nothing, whether by mute or by level. */
export function isBusSilent(name: AudioBusName): boolean {
	return silent(name);
}

export function setBusVolume(name: AudioBusName, next: number) {
	const bus = buses[name];
	bus.volume = Math.min(100, Math.max(0, Math.round(next)));
	// The slider and the speaker are two views of one state: dragging to the
	// bottom mutes, and dragging back up un-mutes. Without this the panel can
	// show a lit speaker over a silent bus.
	bus.muted = bus.volume <= 0;
	if (bus.volume > 0) bus.lastAudible = bus.volume;
	applyGain(name);
	persist(name);
	announce();
}

export function setBusMuted(name: AudioBusName, next: boolean) {
	const bus = buses[name];
	bus.muted = next;
	// Un-muting a bus parked at zero has to move the slider too, or the button
	// appears to do nothing at all.
	if (!next && bus.volume <= 0) bus.volume = bus.lastAudible;
	applyGain(name);
	persist(name);
	announce();
}

export function toggleBusMuted(name: AudioBusName): boolean {
	setBusMuted(name, !buses[name].muted);
	return buses[name].muted;
}

/**
 * The whole-game switch, kept because Game.svelte's bar button and Stake's
 * CMP-09 both talk about "sound" rather than about buses. Reading it as "both
 * buses are silent" rather than tracking a third flag is what stops the bar
 * icon disagreeing with the panel behind it.
 */
export function isMuted(): boolean {
	return silent('music') && silent('sfx');
}

export function setMuted(next: boolean) {
	setBusMuted('music', next);
	setBusMuted('sfx', next);
}

export function toggleMuted(): boolean {
	const next = !isMuted();
	setMuted(next);
	return next;
}
