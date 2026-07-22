"""Handles the state and output for a single simulation round of Ride The Bus."""

import random

from game_override import GameStateOverride
from game_calculations import build_deck, rank_value
from src.events.events import *


class GameState(GameStateOverride):
    """Handle all game-logic and event updates for a given simulation number."""

    def run_spin(self, sim, simulation_seed=None):
        self.reset_seed(sim)
        self.repeat = True
        while self.repeat:
            self.reset_book()

            deck = build_deck()
            random.shuffle(deck)
            drawn = deck[:4]
            drawn_ranks = [rank_value(rank) for rank, _ in drawn]

            # Stage 1: color, guessed against the full remaining deck.
            stage_payouts = [
                self.color_payouts(deck[0:]),
                self.higher_lower_payouts(deck[1:], drawn_ranks[0]),
                self.inside_outside_payouts(deck[2:], drawn_ranks[0], drawn_ranks[1]),
                self.suit_payouts(deck[3:]),
            ]
            stage_choice_keys = [
                ("red", "black"),
                ("higher", "lower", "equal"),
                ("inside", "outside", "equal"),
                ("heart", "diamond", "club", "spade"),
            ]

            for stage_index in range(4):
                rank, suit = drawn[stage_index]
                event = {
                    "index": len(self.book.events),
                    "type": EventConstants.REVEAL.value,
                    "stage": stage_index + 1,
                    "card": {"rank": rank, "suit": suit},
                    "payouts": stage_payouts[stage_index],
                }
                self.book.add_event(event)

            # Simulate a representative playthrough (uniform-random guesses,
            # excluding guesses that are impossible given cards already
            # revealed, e.g. "lower" when the reference card is an Ace) purely
            # to produce a payoutMultiplier / RTP figure for this book. Actual
            # gameplay payout is resolved live client-side from the payouts/card
            # data above, not from this simulated path.
            running_multiplier = 1.0
            for stage_index in range(4):
                rank, suit = drawn[stage_index]
                payouts = stage_payouts[stage_index]
                choice_keys = stage_choice_keys[stage_index]
                viable_keys = [key for key in choice_keys if payouts[key] > 0]
                guess = random.choice(viable_keys)
                correct = self._is_correct_guess(stage_index, guess, rank, suit, drawn_ranks)
                if not correct:
                    running_multiplier = 0.0
                    break
                running_multiplier *= payouts[guess]

            win_amount = round(running_multiplier, 2)
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
