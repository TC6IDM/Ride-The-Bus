"""Card-odds helper functions for Ride The Bus."""

import math

from src.executables.executables import Executables

RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]
SUITS = ["♥", "♦", "♣", "♠"]
RED_SUITS = ("♥", "♦")
BLACK_SUITS = ("♠", "♣")

# Stake Engine requires each bet to be a single, independent, stateless
# outcome - no continuation, no early cashout (see Key Restrictions in
# Stake's approval docs). So the player picks all 4 guesses up front, and
# the whole round is ONE bet mode encoding that exact combination - the book
# resolves the full outcome deterministically against those fixed choices.
COLOR_CHOICES = ["red", "black"]
HIGHER_LOWER_CHOICES = ["higher", "lower", "equal"]
INSIDE_OUTSIDE_CHOICES = ["inside", "outside", "equal"]
SUIT_CHOICES = ["heart", "diamond", "club", "spade"]

SUIT_NAME_TO_SYMBOL = {"heart": "♥", "diamond": "♦", "club": "♣", "spade": "♠"}


def all_mode_combinations():
    """Every (color, higher_lower, inside_outside, suit) choice combination."""
    for color in COLOR_CHOICES:
        for higher_lower in HIGHER_LOWER_CHOICES:
            for inside_outside in INSIDE_OUTSIDE_CHOICES:
                for suit in SUIT_CHOICES:
                    yield (color, higher_lower, inside_outside, suit)


def mode_name(color: str, higher_lower: str, inside_outside: str, suit: str) -> str:
    """Bet mode name encoding one full pre-selected 4-stage choice combination."""
    return f"{color}_{higher_lower}_{inside_outside}_{suit}"


def parse_mode_name(name: str) -> tuple:
    """Inverse of mode_name(): '<color>_<higher_lower>_<inside_outside>_<suit>' -> tuple."""
    color, higher_lower, inside_outside, suit = name.split("_")
    return color, higher_lower, inside_outside, suit


def rank_value(rank: str) -> int:
    """Ace-low rank value, matching the frontend's rankValue map."""
    return RANKS.index(rank) + 1


def build_deck() -> list:
    """Return an unshuffled standard 52-card deck as (rank, suit) tuples."""
    return [(rank, suit) for suit in SUITS for rank in RANKS]


class GameCalculations(Executables):
    """Fair-odds table calculations, shared with the frontend's local formulas."""

    def fair_multiplier(self, probability: float) -> float:
        """
        (1 - house_edge) / true probability, quantized DOWN to the nearest
        0.1x. Stake's RGS only accepts non-zero payout multipliers in 0.1x
        increments (payoutMultiplier, stored as integer cents x100, must be
        a multiple of 10) - see utils/rgs_verification.py:verify_lookup_format.
        Must floor (never round up/nearest): e.g. a fair 50/50 payout is
        1.96x - rounding to nearest would give 2.0x, wiping out the house
        edge entirely. Floor keeps the edge intact. 0 if impossible.
        """
        if probability <= 0:
            return 0.0
        raw = (1 - self.config.house_edge) / probability
        quantized = math.floor(raw * 10) / 10
        return quantized if quantized > 0 else 0.1

    def color_payouts(self, remaining: list) -> dict:
        total = len(remaining)
        red = sum(1 for _, suit in remaining if suit in RED_SUITS)
        black = total - red
        return {
            "red": self.fair_multiplier(red / total),
            "black": self.fair_multiplier(black / total),
        }

    def higher_lower_payouts(self, remaining: list, ref_value: int) -> dict:
        total = len(remaining)
        higher = sum(1 for rank, _ in remaining if rank_value(rank) > ref_value)
        lower = sum(1 for rank, _ in remaining if rank_value(rank) < ref_value)
        equal = total - higher - lower
        return {
            "higher": self.fair_multiplier(higher / total),
            "lower": self.fair_multiplier(lower / total),
            "equal": self.fair_multiplier(equal / total),
        }

    def inside_outside_payouts(self, remaining: list, val_a: int, val_b: int) -> dict:
        total = len(remaining)
        min_val, max_val = min(val_a, val_b), max(val_a, val_b)
        inside = sum(1 for rank, _ in remaining if min_val < rank_value(rank) < max_val)
        outside = sum(
            1 for rank, _ in remaining if rank_value(rank) < min_val or rank_value(rank) > max_val
        )
        equal = total - inside - outside
        return {
            "inside": self.fair_multiplier(inside / total),
            "outside": self.fair_multiplier(outside / total),
            "equal": self.fair_multiplier(equal / total),
        }

    def suit_payouts(self, remaining: list) -> dict:
        total = len(remaining)
        counts = {suit: 0 for suit in SUITS}
        for _, suit in remaining:
            counts[suit] += 1
        return {
            "heart": self.fair_multiplier(counts["♥"] / total),
            "diamond": self.fair_multiplier(counts["♦"] / total),
            "club": self.fair_multiplier(counts["♣"] / total),
            "spade": self.fair_multiplier(counts["♠"] / total),
        }
