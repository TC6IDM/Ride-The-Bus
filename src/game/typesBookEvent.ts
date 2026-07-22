import type { BetType } from 'rgs-requests';

export type Card = { rank: string; suit: '♥' | '♦' | '♣' | '♠' };

type BookEventRevealStage1 = {
	index: number;
	type: 'reveal';
	stage: 1;
	card: Card;
	payouts: { red: number; black: number };
};

type BookEventRevealStage2 = {
	index: number;
	type: 'reveal';
	stage: 2;
	card: Card;
	payouts: { higher: number; lower: number; equal: number };
};

type BookEventRevealStage3 = {
	index: number;
	type: 'reveal';
	stage: 3;
	card: Card;
	payouts: { inside: number; outside: number; equal: number };
};

type BookEventRevealStage4 = {
	index: number;
	type: 'reveal';
	stage: 4;
	card: Card;
	payouts: { heart: number; diamond: number; club: number; spade: number };
};

type BookEventFinalWin = {
	index: number;
	type: 'finalWin';
	amount: number;
};

export type BookEvent =
	| BookEventRevealStage1
	| BookEventRevealStage2
	| BookEventRevealStage3
	| BookEventRevealStage4
	| BookEventFinalWin;

export type Bet = BetType<BookEvent>;
export type BookEventOfType<T> = Extract<BookEvent, { type: T }>;
export type BookEventContext = { bookEvents: BookEvent[] };
