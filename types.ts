export enum Player {
  None = 0,
  Black = 1, // Left-Right
  White = 2, // Top-Bottom
}

export interface Hex {
  q: number;
  r: number;
}

export interface GameState {
  board: Map<string, Player>;
  currentPlayer: Player;
  winner: Player | null;
  boardSize: number;
  history: Hex[];
  gameMode: 'PvP' | 'PvAI';
  aiPlayer: Player | null; // If null, it's PvP or AI hasn't been assigned yet
}

export const BOARD_SIZE = 11;
