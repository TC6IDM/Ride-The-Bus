// gameLogic.ts

/**
 * This file serves as the central location for all game logic functions.
 * You can move your game logic functions here and export them for use in other components.
 */

// Types and Interfaces
export type State = 'start' | 'playing' | 'won' | 'lost';

export interface Card {
  suit: '♥' | '♦' | '♣' | '♠';
  rank: 'A'|'2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K';
}

// Constants
export const suits: Card['suit'][] = ['♥', '♦', '♣', '♠'];
export const ranks: Card['rank'][] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const rankValue: Record<Card['rank'], number> = {
  'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13
};

// Functions
/**
 * Create a new deck of cards.
 */
export function createDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({ suit, rank });
    }
  }
  return deck;
}

/**
 * Shuffle a deck of cards.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Calculate payouts based on game rules.
 */
export function calculatePayoutsColor(deck: Card[], currentIndex: number, houseEdge = 0.02) {
  const remainingCards = deck.slice(currentIndex);
  const totalRemaining = remainingCards.length;

  const redProb = remainingCards.filter(card => card.suit === '♥' || card.suit === '♦').length / totalRemaining;
  const blackProb = remainingCards.filter(card => card.suit === '♠' || card.suit === '♣').length / totalRemaining;

  return {
    red: (1 - houseEdge) / redProb,
    black: (1 - houseEdge) / blackProb
  };
}

export function calculatePayoutsHigherLower(deck: Card[], currentIndex: number, firstCard: Card, houseEdge = 0.02) {
  const remainingCards = deck.slice(currentIndex);
  const totalRemaining = remainingCards.length;

  const firstCardValue = rankValue[firstCard.rank];
  const higherProb = remainingCards.filter(card => rankValue[card.rank] > firstCardValue).length / totalRemaining;
  const lowerProb = remainingCards.filter(card => rankValue[card.rank] < firstCardValue).length / totalRemaining;
  const equalProb = remainingCards.filter(card => rankValue[card.rank] === firstCardValue).length / totalRemaining;

  return {
    higher: (1 - houseEdge) / higherProb,
    lower: (1 - houseEdge) / lowerProb,
    equal: (1 - houseEdge) / equalProb
  };
}

export function calculatePayoutsInsideOutside(deck: Card[], currentIndex: number, firstCard: Card, secondCard: Card, houseEdge = 0.02) {
  const remainingCards = deck.slice(currentIndex);
  const totalRemaining = remainingCards.length;

  const firstCardValue = rankValue[firstCard.rank];
  const secondCardValue = rankValue[secondCard.rank];
  const minVal = Math.min(firstCardValue, secondCardValue);
  const maxVal = Math.max(firstCardValue, secondCardValue);

  const insideProb = remainingCards.filter(card => rankValue[card.rank] > minVal && rankValue[card.rank] < maxVal).length / totalRemaining;
  const outsideProb = remainingCards.filter(card => rankValue[card.rank] < minVal || rankValue[card.rank] > maxVal).length / totalRemaining;
  const equalProb = remainingCards.filter(card => rankValue[card.rank] === minVal || rankValue[card.rank] === maxVal).length / totalRemaining;

  return {
    inside: (1 - houseEdge) / insideProb,
    outside: (1 - houseEdge) / outsideProb,
    equal: (1 - houseEdge) / equalProb
  };
}

export function calculatePayoutsSuit(deck: Card[], currentIndex: number, houseEdge = 0.02) {
  const remainingCards = deck.slice(currentIndex);
  const totalRemaining = remainingCards.length;

  const heartProb = remainingCards.filter(card => card.suit === '♥').length / totalRemaining;
  const diamondProb = remainingCards.filter(card => card.suit === '♦').length / totalRemaining;
  const spadeProb = remainingCards.filter(card => card.suit === '♠').length / totalRemaining;
  const clubProb = remainingCards.filter(card => card.suit === '♣').length / totalRemaining;

  return {
    heart: (1 - houseEdge) / heartProb,
    diamond: (1 - houseEdge) / diamondProb,
    spade: (1 - houseEdge) / spadeProb,
    club: (1 - houseEdge) / clubProb
  };
}