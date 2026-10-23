<script lang="ts">
	/**
	 * The two men in the back room, and the Boss's bar cart.
	 *
	 * THE FLOORMAN stands at the left of the table, arms folded; THE BOSS sits
	 * in the far right corner with his cigar, the cart below him. Behind the
	 * table and the whole board - this is drawn inside .scene, under the
	 * room's vignette (.room-shade), so the screen edge darkens them exactly as
	 * much as the wall behind them - and never catching a click.
	 *
	 * Placed in TABLE units: .cast is the table's own box (same size, same
	 * centre) and a container, so every length here is a share of the table's
	 * width and the men stay beside it at any window shape. Their outer edges
	 * stop short of the screen where the window is narrower than 16:9. Not on a
	 * portrait screen, which has no room beside the table.
	 *
	 * What moves them is cast.svelte.ts (timers) and castScript.ts (what each
	 * move is); this file only watches two things the round already publishes:
	 *
	 *   - the HELD last card (round.lastCardHeld while round.holdIndex is set):
	 *     decided from the stake, never the result. Its start is the puff and
	 *     the lean; its end - the turn, whatever the card shows - is the
	 *     exhale. Nothing here reads what a card is or what it pays.
	 *   - the takeover CLOSING: sometimes the salute, the hat tip, or both -
	 *     more often the rarer the win (reactionTo in castScript.ts).
	 *   - round.bossPuffsEarly: the one look AHEAD, the owner's call
	 *     (2026-10-23) - on half the rounds whose last card will be held, the
	 *     Boss puffs at the deal. Decided in roundReveal, not here.
	 */
	import { onMount, untrack } from 'svelte';
	import { CAST_GEOMETRY as G } from '../../game/scene/castGeometry';
	import { CAST_ART_BASE as BASE } from '../../game/scene/castAsset';
	import {
		cast,
		castAfterTakeover,
		castEarlyPuff,
		castFrameUrl,
		castOnHold,
		castOnTurn,
		castRoundOver,
		castSmokeUrl,
		startCastLife,
	} from '../../game/scene/cast.svelte';
	import { round, roundInProgress } from '../../game/round/roundState.svelte';
	import { celebration, type Celebration } from '../../game/celebration/celebrationState.svelte';

	onMount(() => startCastLife());

	// The early puff, at the deal, on the rounds roundReveal picked for it.
	$effect(() => {
		if (round.bossPuffsEarly) untrack(castEarlyPuff);
	});

	// The hold: its start and its end, each once.
	let holding = false;
	$effect(() => {
		const now = round.lastCardHeld && round.holdIndex !== null;
		if (now === holding) return;
		holding = now;
		untrack(() => (now ? castOnHold() : castOnTurn()));
	});

	// The round over with the cigar still at his lips: he breathes out.
	$effect(() => {
		if (!roundInProgress()) untrack(castRoundOver);
	});

	// The takeover: remembered while it is up, answered when it goes.
	let shown: Celebration | null = null;
	$effect(() => {
		const active = celebration.active;
		if (active) {
			shown = active;
			return;
		}
		if (shown) {
			const was = shown;
			shown = null;
			untrack(() => castAfterTakeover(was.tier));
		}
	});

	const point = (p: { x: number; y: number }, x: string, y: string) => `${x}: ${p.x}; ${y}: ${p.y}`;

	/**
	 * The Floorman's cast shadow, as one affine map of his own figure onto the
	 * floor. He stands three-quarter on, his far foot further back and so
	 * higher on screen: the line his soles stand on is TILTED, and a shadow
	 * flipped about one flat line put the far shoe's shadow well below the
	 * shoe. So every point of the figure is taken as standing at some height
	 * above that sole line, and lands on the floor from the sole point under
	 * it, pushed away from the lamp by its height times SHADOW_FALL - left and
	 * a little toward the viewer, the sconce being off to the right at about
	 * head height. With k the sole line's slope (screen y per screen x), a
	 * point (u, y) about the near sole goes to
	 *   x' = u (1 + sx k) - sx y      y' = u k (1 + sy) - sy y
	 * which is the CSS matrix below. The feet come from the art script.
	 */
	const SHADOW_FALL = { sx: -0.35, sy: 0.075 };
	const floorCast = (() => {
		const near = G.floorman.feet[0]!;
		const far = G.floorman.feet[G.floorman.feet.length - 1]!;
		const k = (far.y - near.y) / ((far.x - near.x) * G.floorman.aspect);
		const { sx, sy } = SHADOW_FALL;
		const m = [1 + sx * k, k * (1 + sy), -sx, -sy].map((v) => +v.toFixed(4));
		return `transform-origin: ${(near.x * 100).toFixed(2)}% ${(near.y * 100).toFixed(2)}%; transform: matrix(${m.join(', ')}, 0, 0)`;
	})();

	/**
	 * The strip from one foot to the other, in the figure's own box: its
	 * middle (fractions of the box), its length (a fraction of the box's
	 * WIDTH) and its angle. The box is `aspect` wide per unit tall, so a
	 * vertical fraction is a horizontal one divided by the aspect.
	 */
	function bridge(a: { x: number; y: number }, b: { x: number; y: number }, aspect: number) {
		const dx = b.x - a.x;
		const dy = (b.y - a.y) / aspect;
		return {
			x: (a.x + b.x) / 2,
			y: (a.y + b.y) / 2,
			length: Math.hypot(dx, dy),
			angle: (Math.atan2(dy, dx) * 180) / Math.PI,
		};
	}
</script>

{#snippet contacts(feet: readonly { x: number; y: number; w: number; a: number }[], aspect: number, bridged = false)}
	{#if bridged}
		<!-- THE SHADE BETWEEN HIS FEET: a strip from one sole to the other,
		     along the line joining them. His far foot stands further back, so
		     higher on screen; one pool laid under the near foot left the far one
		     over lit floor, the shoe in the air (the owner, 2026-10-23). -->
		{@const b = bridge(feet[0]!, feet[feet.length - 1]!, aspect)}
		<span class="bridge" style="--bx: {b.x}; --by: {b.y}; --bl: {b.length}; --ba: {b.angle}"></span>
	{:else}
		<span class="pool"></span>
	{/if}
	{#each feet as f, i (i)}
		<span class="contact c{i}" style="--x: {f.x}; --y: {f.y}; --w: {f.w}; --a: {f.a}"></span>
	{/each}
{/snippet}

{#if cast.ready}
	<div class="cast">
		<div class="figure floorman" class:lean={cast.lean} style="--aspect: {G.floorman.aspect}">
			<!-- His shadow on the boards: his own figure laid flat, away from the
			     lamp. The idle frame - a hat tip's arm in it would be one frame
			     the eye never looks for in a shadow. -->
			<img class="floor-cast" style={floorCast} src={castFrameUrl(BASE, 'floorman', 'idle')} alt="" draggable="false" />
			{@render contacts(G.floorman.feet, G.floorman.aspect, true)}
			<div class="body">
				{#each G.floorman.frames as pose (pose)}
					<img class="frame" class:on={cast.floorman === pose} src={castFrameUrl(BASE, 'floorman', pose)} alt="" draggable="false" />
				{/each}
			</div>
		</div>

		<div class="figure cart" style="--aspect: {G.cart.aspect}">
			{@render contacts(G.cart.feet, G.cart.aspect)}
			<div class="body">
				<img class="frame on" src={castFrameUrl(BASE, 'cart', 'idle')} alt="" draggable="false" />
			</div>
		</div>

		<div
			class="figure boss"
			class:smoking={cast.boss === 'idle' || cast.boss === 'blink'}
			style="--aspect: {G.boss.aspect}; {point(G.boss.ember, '--ex', '--ey')}; {point(G.boss.mouth, '--mx', '--my')}"
		>
			<!-- THE SCONCE: the room's lamp, on the panelling just left of his
			     hat - the one light every shadow in the scene already says is
			     up there on the right. Behind him, and it moves with him. -->
			<div class="sconce">
				<span class="sconce-wash"></span>
				<span class="sconce-plate"></span>
				<span class="sconce-arm"></span>
				<span class="sconce-cup"></span>
				<span class="sconce-shade"></span>
			</div>
			<!-- His shadow on the panelling beside him, away from the lamp. -->
			<img class="cast-shadow" src={castFrameUrl(BASE, 'boss', 'idle')} alt="" draggable="false" />
			{@render contacts(G.boss.feet, G.boss.aspect)}
			<div class="body">
				{#each G.boss.frames as pose (pose)}
					<img class="frame" class:on={cast.boss === pose} src={castFrameUrl(BASE, 'boss', pose)} alt="" draggable="false" />
				{/each}
			</div>
			<!-- The cigar's own smoke, rising off the ember while it rests. -->
			<div class="wisps">
				{#each [1, 2, 3] as n (n)}
					<img class="wisp" src={castSmokeUrl(BASE, 'wisp', n)} alt="" draggable="false" />
				{/each}
			</div>
			<!-- While he is puffing: a small breath of smoke from his lips now
			     and then, keyed so each one plays afresh. -->
			{#key cast.breath}
				{#if cast.breath > 0 && cast.puffing}
					<img class="breath" src={castSmokeUrl(BASE, 'plume', 1)} alt="" draggable="false" />
				{/if}
			{/key}
			<!-- One plume per exhale, keyed so each turn plays it afresh. -->
			{#key cast.plume}
				{#if cast.plume > 0}
					<img class="plume" src={castSmokeUrl(BASE, 'plume', 1)} alt="" draggable="false" />
				{/if}
			{/key}
		</div>
	</div>
{/if}

<style>
	@import '../../styles/scene/cast.css';
</style>
