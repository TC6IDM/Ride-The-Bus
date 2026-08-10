"""Handles the state and output for a single simulation round of Ride The Bus."""

import random

from game_override import GameStateOverride
from game_calculations import MODE_FAMILIES, build_deck, rank_value, parse_mode_name
from src.events.events import *


class GameState(GameStateOverride):
    """Handle all game-logic and event updates for a given simulation number."""

    def run_spin(self, sim, simulation_seed=None):
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()

            # The bet mode name IS the player's full pre-selected 4-stage
            # choice combination (see game_calculations.mode_name) - chosen
            # before this round was ever played, so the outcome below is a
            # single, independent, stateless resolution against a choice
            # that's already fixed, not something discovered mid-round.
            family, color_choice, hl_choice, io_choice, suit_choice = parse_mode_name(
                self.betmode
            )
            choices = [color_choice, hl_choice, io_choice, suit_choice]

            # What a miss keeps, and whether the first one is forgiven, is the
            # only thing that separates the three families - see MODE_FAMILIES.
            family_config = MODE_FAMILIES[family]
            retention_table = family_config["retention"]
            forgive = family_config["forgive"]
            forgive_from = family_config["forgive_from"]
            cost = family_config["cost"]

            deck = build_deck()
            random.shuffle(deck)
            drawn = deck[:4]
            drawn_ranks = [rank_value(rank) for rank, _ in drawn]

            # Partial credit: a miss doesn't zero the round - it keeps
            # STAGE_RETENTION[stage] of whatever was already banked (see
            # game_calculations.GameCalculations for the full derivation).
            # Reveals still stop at the first miss (busted), matching the
            # UI's bust animation, but the stages that never get played
            # would each have contributed an expected `decay` factor to the
            # running multiplier - skipping them silently would under-credit
            # the round relative to what the martingale formula assumes, so
            # their expected contribution is applied analytically instead of
            # simulated (decay**remaining_stages). This is only valid
            # because decay is a FIXED constant, not derived from this
            # round's own probabilities - substituting it for stages that
            # weren't actually drawn preserves the exact same expectation.
            running_multiplier = 1.0
            busted = False
            forgiveness_spent = False
            decay = self.target_rtp_decay()
            for stage_index in range(4):
                rank, suit = drawn[stage_index]
                choice = choices[stage_index]

                # The retention a miss at THIS stage would actually bank. While
                # a Second Chance round still holds its forgiveness that is the
                # forgiveness value, not the bust table - and the stage has to
                # be PRICED against the same number, or the martingale breaks
                # and the mode's RTP drifts off target.
                forgiveness_available = (
                    forgive is not None
                    and not forgiveness_spent
                    and stage_index >= forgive_from
                )
                if forgiveness_available:
                    stage_retention = forgive
                else:
                    stage_retention = retention_table[stage_index]

                payouts = self._stage_payouts(stage_index, deck, drawn_ranks, stage_retention)
                correct = (
                    not busted
                    and self._is_correct_guess(stage_index, choice, rank, suit, drawn_ranks)
                )
                if not busted and correct:
                    running_multiplier *= payouts[choice]
                elif not busted:
                    if forgiveness_available:
                        # Forgiven: bank the fraction and PLAY ON. No decay
                        # term here - that exists to stand in for stages a bust
                        # skips, and this round is going to play them for real.
                        running_multiplier *= forgive
                        forgiveness_spent = True
                    else:
                        running_multiplier *= stage_retention
                        running_multiplier *= decay ** (3 - stage_index)
                        busted = True

                event = {
                    "index": len(self.book.events),
                    "type": EventConstants.REVEAL.value,
                    "stage": stage_index + 1,
                    "card": {"rank": rank, "suit": suit},
                    "choice": choice,
                    "correct": correct,
                    "payout": payouts[choice],
                }
                self.book.add_event(event)

            # Quantize the FINAL compounded multiplier only (once) - see
            # game_calculations.quantize_multiplier. No special-casing for a
            # total loss needed: a stage-1 miss multiplies by
            # STAGE_RETENTION[0] == 0.0, which already zeroes it out.
            #
            # Scaled by the mode's cost FIRST. payoutMultiplier is expressed
            # against the base bet, so a 2x-cost mode has to pay twice as much
            # to return the same RTP - and reweight_luts.py cannot supply that
            # itself: it only adjusts loss weight, and refuses outright once
            # the target rises above a mode's win-conditional mean (~1.49x).
            # Without this a 2x mode would silently settle at half the RTP.
            win_amount = self.quantize_multiplier(running_multiplier * cost)
            self.win_manager.update_spinwin(win_amount)
            self.win_manager.update_gametype_wins(self.gametype)

            self.evaluate_finalwin()

        self.imprint_wins()

    def run_freespin(self):
        pass

    def _stage_payouts(self, stage_index, deck, drawn_ranks, retention) -> dict:
        """
        The payout table for one stage, priced against `retention`.

        Computed per stage rather than all four upfront, because with
        forgiveness in play the retention a stage is priced against depends on
        whether an earlier stage has already missed - which is not known until
        the loop reaches it.

        The slices are the deck STILL TO COME including the card being turned:
        stage 0 prices against all 52, stage 1 against the 51 left after card 1,
        and so on.
        """
        if stage_index == 0:
            return self.color_payouts(deck[0:], retention)
        if stage_index == 1:
            return self.higher_lower_payouts(deck[1:], drawn_ranks[0], retention)
        if stage_index == 2:
            return self.inside_outside_payouts(
                deck[2:], drawn_ranks[0], drawn_ranks[1], retention
            )
        return self.suit_payouts(deck[3:], retention)

    @staticmethod
    def _is_correct_guess(stage_index, guess, rank, suit, drawn_ranks) -> bool:
        value = rank_value(rank)
        if stage_index == 0:
            color = "red" if suit in ("♥", "♦") else "black"
            return guess == color
        if stage_index == 1:
            ref = drawn_ranks[0]
            if value == ref:
                return guess == "equal"
            return guess == ("higher" if value > ref else "lower")
        if stage_index == 2:
            min_val, max_val = min(drawn_ranks[0], drawn_ranks[1]), max(drawn_ranks[0], drawn_ranks[1])
            if value == min_val or value == max_val:
                return guess == "equal"
            return guess == ("inside" if min_val < value < max_val else "outside")
        suit_name = {"♥": "heart", "♦": "diamond", "♣": "club", "♠": "spade"}[suit]
        return guess == suit_name
