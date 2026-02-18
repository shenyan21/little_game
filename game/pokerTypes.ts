export enum Suit {
  HEARTS = '♥',
  DIAMONDS = '♦',
  CLUBS = '♣',
  SPADES = '♠',
}

export enum Rank {
  TWO = '2',
  THREE = '3',
  FOUR = '4',
  FIVE = '5',
  SIX = '6',
  SEVEN = '7',
  EIGHT = '8',
  NINE = '9',
  TEN = '10',
  JACK = 'J',
  QUEEN = 'Q',
  KING = 'K',
  ACE = 'A',
}

export interface Card {
  rank: Rank;
  suit: Suit;
  id: string; // Unique identifier for React keys
}

export enum GamePhase {
  SETUP = 'SETUP',
  PRE_FLOP = 'PRE_FLOP',
  FLOP = 'FLOP',
  TURN = 'TURN',
  RIVER = 'RIVER',
  SHOWDOWN = 'SHOWDOWN',
}

export enum PlayerActionType {
  FOLD = 'FOLD',
  CHECK = 'CHECK',
  CALL = 'CALL',
  RAISE = 'RAISE',
  ALL_IN = 'ALL_IN',
}

export interface PlayerAction {
  playerId: number;
  type: PlayerActionType;
  amount?: number; // The amount put in this turn (delta)
  totalBet?: number; // Total bet for the round after this action
  phase: GamePhase;
}

export interface PokerPlayer {
  id: number;
  positionName: string; // e.g., 'UTG', 'BTN', 'SB', 'BB'
  isUser: boolean;
  isActive: boolean; // False if folded
  isDealer: boolean;
  chips: number;      // Total stack remaining
  roundBet: number;   // Chips put in pot during the CURRENT betting round (resets per phase)
}

export interface PokerGameState {
  playerCount: number;
  userPosition: number; // 0-indexed relative to Dealer (0 = Dealer/BTN)
  players: PokerPlayer[];
  userCards: Card[];
  communityCards: Card[];
  phase: GamePhase;
  actionLog: PlayerAction[];
  currentTurnIndex: number; // Index in players array
  dealerIndex: number;
  pot: number;            // Chips collected from previous rounds
  currentHighBet: number; // The amount needed to match in current round
  minRaise: number;       // Minimum raise amount
}