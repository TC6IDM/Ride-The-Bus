<script lang="ts">
	/**
	 * The whiskey glass on the table: a cut-crystal tumbler with a finger of
	 * whiskey, the twin of the one on the Boss's bar cart.
	 *
	 * Drawn from geometry (game/ui/tumblerGeometry.ts): a cylinder in the
	 * table's own camera, the diamond cut laid out on its surface and
	 * projected, so it wraps round, squeezes at the edges and curves with the
	 * rim - the way the cut on the cart's tumbler does. What is on the wood
	 * under it (the shadow, the whiskey's light, the reflection) stays in
	 * table.css with the other props' shadows.
	 *
	 * Back to front: the far wall's cut, seen through the glass; the whiskey
	 * and its lit surface; the thick base and its star cut; the near wall's
	 * facets, gold where the whiskey is behind them; the grooves; the edges and
	 * speculars; the rim and where the lamp sits in it. Static - computed once,
	 * drawn once.
	 *
	 * The whiskey's colours are sampled off the cart's own tumbler and decanter
	 * (art-masters/characters/props/barcart.png): #691601 in shadow, #a14212,
	 * #dd7e28, #f0ad4c where the light comes through.
	 */
	import {
		BASE_BODY,
		FACETS,
		FRONT_WALL,
		GROOVES,
		MOUTH_INNER,
		MOUTH_OUTER,
		SILHOUETTE,
		STAR,
		VIEW_H,
		WHISKY_BODY,
		WHISKY_SURFACE,
		inWhisky,
	} from '../../game/ui/tumblerGeometry';

	const back = FACETS.filter((facet) => !facet.front);
	const front = FACETS.filter((facet) => facet.front);

	/** A facet's paint: on the near side, white where it catches the lamp and
	 *  black where it faces away; through the whiskey, gold and deep amber. */
	function paint(light: number, h: number) {
		const amber = inWhisky(h);
		if (light >= 0) return { fill: amber ? '#f0ad4c' : '#fffaf0', opacity: (amber ? 0.2 : 0.16) * light + 0.02 };
		return { fill: amber ? '#4a0f00' : '#000000', opacity: (amber ? 0.26 : 0.2) * -light };
	}
</script>

<svg class="tumbler-art" viewBox={`0 0 100 ${VIEW_H}`} aria-hidden="true">
	<defs>
		<clipPath id="tumbler-silhouette"><path d={SILHOUETTE} /></clipPath>
		<clipPath id="tumbler-front"><path d={FRONT_WALL} /></clipPath>
		<clipPath id="tumbler-whisky"><path d={WHISKY_BODY} /></clipPath>
		<linearGradient id="tumbler-whisky-body" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0" stop-color="#3e0900" />
			<stop offset="0.2" stop-color="#691601" />
			<stop offset="0.5" stop-color="#7f2d0c" />
			<stop offset="0.74" stop-color="#a14212" />
			<stop offset="0.86" stop-color="#be5a1a" />
			<stop offset="1" stop-color="#4a0d00" />
		</linearGradient>
		<radialGradient id="tumbler-whisky-top" cx="0.6" cy="0.45" r="0.6">
			<stop offset="0" stop-color="#be5a1a" />
			<stop offset="0.5" stop-color="#a14212" />
			<stop offset="1" stop-color="#691601" />
		</radialGradient>
		<radialGradient id="tumbler-surface-light" cx="0.68" cy="0.34" r="0.3">
			<stop offset="0" stop-color="#ffe6b0" stop-opacity="0.85" />
			<stop offset="1" stop-color="#f0ad4c" stop-opacity="0" />
		</radialGradient>
		<linearGradient id="tumbler-wall" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0" stop-color="#000" stop-opacity="0.42" />
			<stop offset="0.07" stop-color="#000" stop-opacity="0.12" />
			<stop offset="0.16" stop-color="#fffaf0" stop-opacity="0.05" />
			<stop offset="0.5" stop-color="#fffaf0" stop-opacity="0.02" />
			<stop offset="0.72" stop-color="#fffaf0" stop-opacity="0.12" />
			<stop offset="0.9" stop-color="#fffaf0" stop-opacity="0.06" />
			<stop offset="1" stop-color="#000" stop-opacity="0.34" />
		</linearGradient>
		<linearGradient id="tumbler-spec" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#fffef8" stop-opacity="0" />
			<stop offset="0.2" stop-color="#fffef8" stop-opacity="0.9" />
			<stop offset="0.7" stop-color="#fffef8" stop-opacity="0.55" />
			<stop offset="1" stop-color="#fffef8" stop-opacity="0" />
		</linearGradient>
		<radialGradient id="tumbler-rim" cx="0.5" cy="0.5" r="0.5">
			<stop offset="0.86" stop-color="#000" stop-opacity="0.35" />
			<stop offset="0.9" stop-color="#fffaf0" stop-opacity="0.5" />
			<stop offset="0.95" stop-color="#fffaf0" stop-opacity="0.75" />
			<stop offset="0.985" stop-color="#fffaf0" stop-opacity="0.3" />
			<stop offset="1" stop-color="#000" stop-opacity="0.3" />
		</radialGradient>
	</defs>

	<!-- Clear crystal: the glass itself barely tints the wood behind it. -->
	<path d={SILHOUETTE} fill="#fff6e8" fill-opacity="0.04" />

	<!-- The far wall's cut, seen through the glass: faint, and darker. -->
	<g clip-path="url(#tumbler-silhouette)" opacity="0.5">
		{#each back as facet, i (i)}
			{@const p = paint(facet.light * 0.6, 99)}
			<polygon points={facet.points} fill={p.fill} fill-opacity={p.opacity} />
		{/each}
	</g>

	<!-- The star cut on the base's underside: under the whiskey, so it shows
	     THROUGH it, the way the cart's does. -->
	<path d={STAR} stroke="#fffaf0" stroke-opacity="0.3" stroke-width="0.6" fill="none" clip-path="url(#tumbler-silhouette)" />

	<!-- One finger of whiskey. Translucent - a whiskey is - so the wood and the
	     star cut show through it, deeper where there is more of it to see
	     through; its surface lit from the upper right, the lamp in it, a thin
	     bright meniscus where it meets the glass. -->
	<path d={WHISKY_BODY} fill="url(#tumbler-whisky-body)" fill-opacity="0.86" />
	<path d={WHISKY_SURFACE} fill="url(#tumbler-whisky-top)" fill-opacity="0.8" />
	<path d={WHISKY_SURFACE} fill="url(#tumbler-surface-light)" />
	<path d={WHISKY_SURFACE} fill="none" stroke="#4a0f00" stroke-opacity="0.45" stroke-width="1.6" />
	<path d={WHISKY_SURFACE} fill="none" stroke="#f6c070" stroke-opacity="0.5" stroke-width="0.6" />

	<!-- The thick base: solid crystal, a little brighter than the wall. -->
	<path d={BASE_BODY} fill="#fff6e8" fill-opacity="0.07" clip-path="url(#tumbler-silhouette)" />

	<!-- The near wall: the cylinder's own light, then every facet of the cut. -->
	<g clip-path="url(#tumbler-front)">
		<rect x="0" y="0" width="100" height={VIEW_H} fill="url(#tumbler-wall)" />
		{#each front as facet, i (i)}
			{@const p = paint(facet.light, facet.h)}
			<polygon points={facet.points} fill={p.fill} fill-opacity={p.opacity} />
		{/each}
		<!-- The grooves: fine light lines, and gold where the whiskey is behind. -->
		<path d={GROOVES} fill="none" stroke="#fffaf0" stroke-opacity="0.2" stroke-width="0.5" />
		<g clip-path="url(#tumbler-whisky)">
			<!-- Seen through the near wall, the whiskey is a shade darker than
			     through the open mouth. -->
			<rect x="0" y="0" width="100" height={VIEW_H} fill="#2a0600" fill-opacity="0.16" />
			<path d={GROOVES} fill="none" stroke="#f0ad4c" stroke-opacity="0.38" stroke-width="0.5" />
		</g>
		<!-- The lamp down the right of the glass, a fainter echo on the left. -->
		<rect x="73" y={VIEW_H * 0.22} width="4.2" height={VIEW_H * 0.62} rx="2" fill="url(#tumbler-spec)" />
		<rect x="14" y={VIEW_H * 0.3} width="2" height={VIEW_H * 0.4} rx="1" fill="url(#tumbler-spec)" opacity="0.35" />
	</g>

	<!-- The foot's curved front edge, polished and catching the light. -->
	<path
		d={`M 2 ${VIEW_H - 50 * 0.676 + 4} A 48 ${(48 * 0.676).toFixed(2)} 0 0 0 98 ${VIEW_H - 50 * 0.676 + 4}`}
		fill="none"
		stroke="#fffaf0"
		stroke-opacity="0.55"
		stroke-width="1.3"
	/>

	<!-- The rim: thick and rounded, dark where it turns into the glass, its
	     polished top brightest where the lamp catches it. -->
	<path d={`${MOUTH_OUTER} ${MOUTH_INNER}`} fill="url(#tumbler-rim)" fill-rule="evenodd" />
	<path d={MOUTH_OUTER} fill="none" stroke="#fffaf0" stroke-opacity="0.35" stroke-width="0.7" />
	<path d={MOUTH_INNER} fill="none" stroke="#000" stroke-opacity="0.3" stroke-width="0.6" />
	<ellipse cx="82" cy={VIEW_H * 0.31} rx="6" ry="1.6" transform={`rotate(-22 82 ${VIEW_H * 0.31})`} fill="#fff" fill-opacity="0.9" />
	<ellipse cx="17" cy={VIEW_H * 0.1} rx="3" ry="1" transform={`rotate(-30 17 ${VIEW_H * 0.1})`} fill="#fff" fill-opacity="0.45" />
</svg>

<style>
	.tumbler-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
	}
</style>
