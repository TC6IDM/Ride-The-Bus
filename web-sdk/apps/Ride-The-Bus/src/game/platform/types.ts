/**
 * Card-game types replacing the slot-template types (SymbolName, RawSymbol,
 * GameType, SymbolState, etc.) that were inherited from the slot fork.
 *
 * None of the old slot types had live runtime consumers — the game renders
 * cards and guesses, not reels and symbols. The config stubs in config.ts
 * (symbols: { CARD }, paddingReels: { basegame }) keep the derived type
 * shapes intact for any remaining framework plumbing.
 */
import type config from './config';

export type SymbolName = keyof typeof config.symbols;
export type RawSymbol = { name: SymbolName };
export type GameType = keyof typeof config.paddingReels;
