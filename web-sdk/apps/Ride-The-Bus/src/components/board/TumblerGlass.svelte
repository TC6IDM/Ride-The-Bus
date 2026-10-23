<script lang="ts">
	/**
	 * The whiskey glass on the table: a cut-crystal tumbler with a finger and a
	 * half of whiskey, the twin of the one on the Boss's bar cart.
	 *
	 * Drawn from geometry (game/ui/tumblerGeometry.ts): a cylinder in the
	 * table's own camera, the diamond cut laid out on its surface and
	 * projected, so it wraps round, squeezes at the edges and curves with the
	 * rim. EVERY LIGHT ON IT IS PLACED ON THE CYLINDER TOO - the rim's glints
	 * on the rim, the side's highlight straight up the side from foot to lip.
	 * The first versions drew them as free shapes, and a glint floating inside
	 * the open mouth is exactly the kind of thing that reads as fake without
	 * anyone being able to say why (the owner, 2026-10-23).
	 *
	 * Crystal is mostly what is behind it, so it is drawn as LIGHT, not as a
	 * colour: a rim that is a thin clear edge with the lamp in it, not a grey
	 * ring; a cut that breaks the light into irregular pieces - a glint here,
	 * a dark facet there, gold where the whiskey is behind - not an even net of
	 * lines; edges dark where the thick glass bends the light away, with a
	 * bright line just inside. What is on the wood under it (the shadow, the
	 * whiskey's light, the reflection) stays in table.css with the other
	 * props' shadows. Static: computed once, drawn once.
	 *
	 * The whiskey's colours are sampled off the cart's own tumbler and decanter
	 * (art-masters/characters/props/barcart.png): #691601 in shadow, #a14212,
	 * #dd7e28, #f0ad4c where the light comes through.
	 */
	import {
		BASE_BODY,
		CUT_TO,
		FACETS,
		FLOOR_NEAR,
		FRONT_WALL,
		GROOVES,
		H,
		MENISCUS_FAR,
		MENISCUS_NEAR,
		MOUTH_INNER,
		MOUTH_OUTER,
		R,
		RIM_MIRROR,
		R_IN,
		SILHOUETTE,
		STAR,
		SURFACE_BOX,
		VIEW_H,
		WHISKY_BODY,
		WHISKY_SURFACE,
		arcPath,
		at,
		halfEllipse,
		inWhisky,
		upTheSide,
		type Facet,
	} from '../../game/ui/tumblerGeometry';

	/** Where the lamp sits in the whiskey: up and to the right of the
	 *  surface's middle, as the lamp is up and to the right of the table. */
	const lamp = { x: SURFACE_BOX.x + SURFACE_BOX.w * 0.7, y: SURFACE_BOX.y + SURFACE_BOX.h * 0.32 };

	const back = FACETS.filter((facet) => !facet.front);
	const front = FACETS.filter((facet) => facet.front);

	/**
	 * A facet of the near wall: what it shows is decided by how it faces the
	 * lamp (light) scattered by its own angle (n), and by what is behind it.
	 * Over the whiskey it refracts the whiskey - a few blaze gold, most carry
	 * its amber, some go deep red-brown. Elsewhere it is clear glass: a few
	 * catch the lamp white, a few go dark, most show the wood through. Toward
	 * the edges, where the eye looks through more glass, the glints fade and
	 * the darks deepen.
	 */
	function paint(facet: Facet): { fill: string; opacity: number } {
		const edge = Math.abs(facet.side) ** 3;
		if (inWhisky(facet.h)) {
			const v = facet.light * 0.6 + (facet.n - 0.5) * 1.15;
			if (v > 0.58) return { fill: '#ffe3a6', opacity: 0.55 * (1 - edge * 0.6) };
			if (v > 0.22) return { fill: '#f0ad4c', opacity: 0.28 };
			if (v > -0.22) return { fill: '#be5a1a', opacity: 0.12 };
			return { fill: '#3a0800', opacity: 0.32 + edge * 0.2 };
		}
		const v = facet.light * 0.7 + (facet.n - 0.5) * 1.05;
		if (v > 0.64) return { fill: '#fffaf0', opacity: 0.42 * (1 - edge * 0.7) };
		if (v > 0.26) return { fill: '#fffaf0', opacity: 0.12 * (1 - edge * 0.5) };
		if (v > -0.26) return { fill: '#fffaf0', opacity: 0.025 };
		return { fill: '#000000', opacity: 0.22 + edge * 0.18 };
	}

	/** The far wall's cut, seen through the glass: the same scatter, faint. */
	function paintBack(facet: Facet): { fill: string; opacity: number } {
		const v = facet.light * 0.4 + (facet.n - 0.5) * 0.9;
		if (v > 0.45) return { fill: '#fffaf0', opacity: 0.1 };
		if (v < -0.35) return { fill: '#000000', opacity: 0.08 };
		return { fill: '#fffaf0', opacity: 0.02 };
	}

	// Where the lamp catches the glass. The side's highlight is at about 35
	// degrees round to the right of the middle, the rim's brightest glint a
	// little further round on the near lip. Angles: 0 nearest the viewer,
	// positive toward the right.
	const SPEC_A = 0.62;
	const rimGlint = at(0.88, H, R - 2.6);
	const rimGlintFar = at(Math.PI + 0.62, H, R - 2.6);
	const FOOT_TOP = 1.2;
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
		<!-- The surface, far to near: a liquid surface MIRRORS what is above
		     it, and above the far side is the dark room, so it reads dark and
		     dull there; toward the near side the eye looks down INTO the
		     whiskey, to its lit depths. -->
		<linearGradient id="tumbler-surface" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#3a0e02" />
			<stop offset="0.3" stop-color="#5e2207" />
			<stop offset="0.68" stop-color="#94481a" />
			<stop offset="1" stop-color="#b0601f" />
		</linearGradient>
		<radialGradient id="tumbler-depth" cx="0.52" cy="0.72" r="0.55">
			<stop offset="0" stop-color="#e2903c" stop-opacity="0.45" />
			<stop offset="1" stop-color="#e2903c" stop-opacity="0" />
		</radialGradient>
		<linearGradient id="tumbler-whisky-glow" x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#e2903c" stop-opacity="0" />
			<stop offset="0.6" stop-color="#e2903c" stop-opacity="0.12" />
			<stop offset="1" stop-color="#f0ad4c" stop-opacity="0.34" />
		</linearGradient>
		<!-- The cylinder's own light across the near wall: dark where the light
		     leaves (left), the glass thickening toward each edge as it turns
		     away, brighter on the lamp side. -->
		<linearGradient id="tumbler-wall" x1="0" y1="0" x2="1" y2="0">
			<stop offset="0" stop-color="#000" stop-opacity="0.4" />
			<stop offset="0.06" stop-color="#000" stop-opacity="0.14" />
			<stop offset="0.16" stop-color="#fffaf0" stop-opacity="0.03" />
			<stop offset="0.5" stop-color="#fffaf0" stop-opacity="0.015" />
			<stop offset="0.72" stop-color="#fffaf0" stop-opacity="0.08" />
			<stop offset="0.9" stop-color="#fffaf0" stop-opacity="0.04" />
			<stop offset="1" stop-color="#000" stop-opacity="0.32" />
		</linearGradient>
		<filter id="tumbler-soft" x="-50%" y="-50%" width="200%" height="200%">
			<feGaussianBlur stdDeviation="0.7" />
		</filter>
		<filter id="tumbler-softer" x="-50%" y="-50%" width="200%" height="200%">
			<feGaussianBlur stdDeviation="2.2" />
		</filter>
	</defs>

	<!-- Where the foot meets the wood: a thin dark line of contact, under
	     everything, so the glass stands on the table rather than over it. -->
	<path d={halfEllipse(0, R, 'near')} fill="none" stroke="#120500" stroke-opacity="0.6" stroke-width="1.8" transform="translate(0 0.7)" filter="url(#tumbler-soft)" />

	<!-- Clear crystal: the glass itself barely tints the wood behind it. -->
	<path d={SILHOUETTE} fill="#fff6e8" fill-opacity="0.035" />

	<!-- The far wall's cut, seen through the glass. -->
	<g clip-path="url(#tumbler-silhouette)">
		{#each back as facet, i (i)}
			{@const p = paintBack(facet)}
			<polygon points={facet.points} fill={p.fill} fill-opacity={p.opacity} />
		{/each}
	</g>

	<!-- The star cut on the base's underside: under the whiskey, so it shows
	     THROUGH it, the way the cart's does. -->
	<path d={STAR} stroke="#fffaf0" stroke-opacity="0.28" stroke-width="0.55" fill="none" clip-path="url(#tumbler-silhouette)" />

	<!-- The whiskey: the body seen through the side, glowing where the light
	     gathers at the floor; the surface, mirroring the dark room far and
	     opening onto the lit depths near; the rim mirrored inside its far edge;
	     the meniscus, lit where it climbs the glass; the lamp, a stretched
	     streak with a soft spread, as a light is in a liquid. -->
	<path d={WHISKY_BODY} fill="url(#tumbler-whisky-body)" fill-opacity="0.84" />
	<path d={WHISKY_BODY} fill="url(#tumbler-whisky-glow)" />
	<path d={FLOOR_NEAR} fill="none" stroke="#ffc070" stroke-opacity="0.4" stroke-width="1.4" filter="url(#tumbler-soft)" />

	<path d={WHISKY_SURFACE} fill="url(#tumbler-surface)" fill-opacity="0.92" />
	<path d={WHISKY_SURFACE} fill="url(#tumbler-depth)" />
	<path d={RIM_MIRROR} fill="none" stroke="#1e0500" stroke-opacity="0.38" stroke-width="2.4" filter="url(#tumbler-soft)" />
	<path d={RIM_MIRROR} fill="none" stroke="#fff2d6" stroke-opacity="0.12" stroke-width="0.5" transform="translate(0 1.2)" />
	<path d={MENISCUS_FAR} fill="none" stroke="#ffd08a" stroke-opacity="0.62" stroke-width="0.7" />
	<path d={MENISCUS_NEAR} fill="none" stroke="#f0ad4c" stroke-opacity="0.3" stroke-width="0.6" />
	<ellipse cx={lamp.x} cy={lamp.y} rx="15" ry="4.5" transform={`rotate(-14 ${lamp.x} ${lamp.y})`} fill="#ffdca0" fill-opacity="0.22" filter="url(#tumbler-softer)" />
	<ellipse cx={lamp.x} cy={lamp.y} rx="8" ry="1.2" transform={`rotate(-14 ${lamp.x} ${lamp.y})`} fill="#fff4dc" fill-opacity="0.82" filter="url(#tumbler-soft)" />

	<!-- The thick base: solid crystal, a little brighter than the wall. -->
	<path d={BASE_BODY} fill="#fff6e8" fill-opacity="0.06" clip-path="url(#tumbler-silhouette)" />

	<!-- The near wall: the cylinder's own light, then every facet of the cut,
	     then the grooves - fine dark V-cuts with a lit edge, gold over the
	     whiskey - faint, because a cut is seen by its facets, not its lines. -->
	<g clip-path="url(#tumbler-front)">
		<rect x="0" y="0" width="100" height={VIEW_H} fill="url(#tumbler-wall)" />
		{#each front as facet, i (i)}
			{@const p = paint(facet)}
			<polygon points={facet.points} fill={p.fill} fill-opacity={p.opacity} />
		{/each}
		<path d={GROOVES} fill="none" stroke="#140600" stroke-opacity="0.16" stroke-width="0.32" />
		<g clip-path="url(#tumbler-whisky)">
			<!-- Seen through the near wall, the whiskey is a shade darker than
			     through the open mouth. -->
			<rect x="0" y="0" width="100" height={VIEW_H} fill="#2a0600" fill-opacity="0.14" />
			<path d={GROOVES} fill="none" stroke="#ffcf80" stroke-opacity="0.16" stroke-width="0.3" transform="translate(0.35 0)" />
		</g>

		<!-- The edges: thick glass seen edge-on bends the light away - dark -
		     with a bright line just inside where the inner wall catches it. -->
		<path d={upTheSide(-1.5, 0.5, H)} stroke="#000" stroke-opacity="0.38" stroke-width="2.4" />
		<path d={upTheSide(-1.32, 2, H - 1.5)} stroke="#fffaf0" stroke-opacity="0.2" stroke-width="0.5" />
		<path d={upTheSide(1.5, 0.5, H)} stroke="#000" stroke-opacity="0.26" stroke-width="2" />
		<path d={upTheSide(1.34, 2, H - 1.5)} stroke="#fffaf0" stroke-opacity="0.36" stroke-width="0.6" />

		<!-- The lamp, straight up the side: crisp and whole in the plain band
		     under the rim, BROKEN into pieces where it crosses the cut, with a
		     soft spread beside it. A faint echo on the far left. -->
		<path d={upTheSide(SPEC_A - 0.1, 5, H - 2)} stroke="#fffef6" stroke-opacity="0.1" stroke-width="5" stroke-linecap="round" filter="url(#tumbler-soft)" />
		<path d={upTheSide(SPEC_A, CUT_TO + 1.5, H - 2)} stroke="#fffef6" stroke-opacity="0.85" stroke-width="1.5" stroke-linecap="round" />
		<path d={upTheSide(SPEC_A, 4, CUT_TO - 1)} stroke="#fffef6" stroke-opacity="0.5" stroke-width="1.2" stroke-dasharray="2.4 3.6" stroke-linecap="round" />
		<path d={upTheSide(-0.98, CUT_TO + 2, H - 2.5)} stroke="#fffef6" stroke-opacity="0.26" stroke-width="0.8" stroke-linecap="round" />
	</g>

	<!-- The foot's curved front edge, polished, catching the light. -->
	<path d={halfEllipse(FOOT_TOP, R - 1.2, 'near')} fill="none" stroke="#fffaf0" stroke-opacity="0.5" stroke-width="1.1" />

	<!-- THE RIM: a thin clear edge, not a ring of paint. Barely tinted; its
	     inner edge dark where it turns down into the glass on the far side; a
	     hairline round the outside; and the lamp in it - a bright arc along the
	     near lip on the right, a softer one on the far left, and one hard
	     point where it is brightest, all ON the rim. -->
	<path d={`${MOUTH_OUTER} ${MOUTH_INNER}`} fill="#fffaf0" fill-opacity="0.07" fill-rule="evenodd" />
	<path d={halfEllipse(H, R_IN, 'far')} fill="none" stroke="#000" stroke-opacity="0.42" stroke-width="0.7" />
	<path d={MOUTH_OUTER} fill="none" stroke="#fffaf0" stroke-opacity="0.22" stroke-width="0.4" />
	<path d={arcPath(H, R - 2.6, 0.3, 1.3)} fill="none" stroke="#fffef6" stroke-opacity="0.3" stroke-width="2.6" stroke-linecap="round" filter="url(#tumbler-soft)" />
	<path d={arcPath(H, R - 2.6, 0.3, 1.3)} fill="none" stroke="#fffef6" stroke-opacity="0.85" stroke-width="0.9" stroke-linecap="round" />
	<path d={arcPath(H, R - 2.6, -1.25, -0.55)} fill="none" stroke="#fffef6" stroke-opacity="0.22" stroke-width="0.7" stroke-linecap="round" />
	<path d={arcPath(H, R - 2.6, Math.PI + 0.35, Math.PI + 0.95)} fill="none" stroke="#fffef6" stroke-opacity="0.38" stroke-width="0.7" stroke-linecap="round" />
	<ellipse cx={rimGlint.x} cy={rimGlint.y} rx="2.4" ry="0.95" transform={`rotate(-34 ${rimGlint.x} ${rimGlint.y})`} fill="#fff" fill-opacity="0.95" />
	<ellipse cx={rimGlintFar.x} cy={rimGlintFar.y} rx="1.4" ry="0.6" transform={`rotate(24 ${rimGlintFar.x} ${rimGlintFar.y})`} fill="#fff" fill-opacity="0.5" />
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
