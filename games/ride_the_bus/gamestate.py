"""Handles the state and output for a single simulation round of Ride The Bus."""

import math
import random

from game_override import GameStateOverride
from game_calculations import build_deck, rank_value, parse_mode_name
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
            color_choice, hl_choice, io_choice, suit_choice = parse_mode_name(self.betmode)
            choices = [color_choice, hl_choice, io_choice, suit_choice]

            deck = build_deck()
            random.shuffle(deck)
            drawn = deck[:4]
            drawn_ranks = [rank_value(rank) for rank, _ in drawn]

            stage_payouts = [
                self.color_payouts(deck[0:]),
                self.higher_lower_payouts(deck[1:], drawn_ranks[0]),
                self.inside_outside_payouts(deck[2:], drawn_ranks[0], drawn_ranks[1]),
                self.suit_payouts(deck[3:]),
            ]

            running_multiplier = 1.0
            busted = False
            for stage_index in range(4):
                rank, suit = drawn[stage_index]
                payouts = stage_payouts[stage_index]
                choice = choices[stage_index]
                correct = (
                    not busted
                    and self._is_correct_guess(stage_index, choice, rank, suit, drawn_ranks)
                )
                if not busted and correct:
                    running_multiplier *= payouts[choice]
                elif not busted:
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

            # Quantize down to the nearest 0.1x (never up - see
            # fair_multiplier): the product of several 0.1x-quantized
            # per-stage payouts isn't itself guaranteed to land on a 0.1x
            # step, but the RGS requires the book's payoutMultiplier to be one.
            win_amount = math.floor(running_multiplier * 10) / 10 if not busted else 0.0
            self.win_manager.update_spinwin(win_amount)
            self.win_manager.update_gametype_wins(self.gametype)

            self.evaluate_finalwin()

        self.imprint_wins()

    def run_freespin(self):
        pass

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
