<!-- A figure whose digits do not move as they change.

     THE PROBLEM IT SOLVES. Poppins ships no tabular figures - measured off the
     shipped subset with fontTools: no GSUB features at all, and digit widths at
     weight 800 running from 0.387em for a "1" to 0.691em for a "4". Every
     `font-variant-numeric: tabular-nums` in this app is therefore inert, and a
     figure that changes in place shifts by the difference each time a digit
     turns over. Two figures change while the player is looking straight at
     them: the win takeover's count-up, which turns its cents over every frame
     under a CENTRED headline that re-centred on each one, and the session
     clock, which ticks once a second on a plate pinned to the right edge, so
     every "1" that came or went moved the plate's left edge.

     WHAT IT DOES. Each ASCII digit is set in its own inline box, one "0" wide,
     centred. The box is what the layout sees, so the string is the same width
     whatever the digits are; the glyph itself is unchanged. Everything that is
     not a digit - the currency symbol, separators, a code - stays as plain
     text at its natural width, so a "$" or a "," is not padded into a slot.

     WHERE IT IS USED, AND WHERE IT IS NOT. Only those two. Every other figure
     in the game - the bar's readouts, the card multipliers, the running win -
     is width-reserved by its container and changes once per round, not per
     frame, so evenness would buy nothing there and cost the natural fit of a
     "1" beside a "0". A "1" in a "0"-wide box carries a little air either side,
     which is exactly the look of a real tabular figure and the price of a
     figure that holds still.

     THE WIDTH. 0.66em is Poppins' "0" at weight 800 (0.657 measured); the "4"
     at 0.691 overruns the box by a hundredth of an em a side, which no screen
     can draw. --digit-w lets a caller set it for a different weight; typeFit's
     evenDigitEms() has to agree with it, and its test pins the two together.

     One markup line, deliberately: an {#each} broken across lines would put
     whitespace text nodes between the boxes, and a figure with spaces in it is
     a different figure. -->
<script lang="ts">
	type Props = {
		/** The whole figure, already formatted for the locale. */
		text: string;
	};

	const props: Props = $props();

	/**
	 * The figure as alternating runs: single digits, and everything between
	 * them. A capturing split keeps the digits; the filter drops the empty runs
	 * that split() yields where two digits are adjacent.
	 */
	const parts = $derived(props.text.split(/([0-9])/).filter((part) => part !== ''));
	const isDigit = (part: string) => part.length === 1 && part >= '0' && part <= '9';
</script>

{#each parts as part, index (index)}{#if isDigit(part)}<span class="dg">{part}</span>{:else}{part}{/if}{/each}

<style>
	.dg {
		display: inline-block;
		width: var(--digit-w, 0.66em);
		text-align: center;
	}
</style>
