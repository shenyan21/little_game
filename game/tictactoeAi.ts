import { Player, Hex } from '../types';
import { getTTTId, checkTTTWin } from './tictactoeLogic';

const SCORES = {
  WIN: 10,
  LOSS: -10,
  DRAW: 0
};

// Returns {q, r} where q=row, r=col to match Hex interface
export const findBestTTTMove = (board: Map<string, Player>, aiPlayer: Player): Hex | null => {
  let bestScore = -Infinity;
  let bestMove: Hex | null = null;
  
  // Optimization: If empty board, take center
  if (board.size === 0) return { q: 1, r: 1 };
  
  // If only one move made and it's corner, take center. If center taken, take corner.
  if (board.size === 1) {
      if (!board.has(getTTTId(1,1))) return { q: 1, r: 1 };
      return { q: 0, r: 0 };
  }

  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const id = getTTTId(r, c);
      if (!board.has(id)) {
        board.set(id, aiPlayer);
        const score = minimax(board, 0, false, aiPlayer);
        board.delete(id);
        
        if (score > bestScore) {
          bestScore = score;
          bestMove = { q: r, r: c };
        }
      }
    }
  }
  return bestMove;
};

const minimax = (board: Map<string, Player>, depth: number, isMaximizing: boolean, aiPlayer: Player): number => {
  const result = checkTTTWin(board);
  const opponent = aiPlayer === Player.Black ? Player.White : Player.Black;

  if (result.winner === aiPlayer) return SCORES.WIN - depth;
  if (result.winner === opponent) return SCORES.LOSS + depth;
  if (board.size === 9) return SCORES.DRAW;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const id = getTTTId(r, c);
        if (!board.has(id)) {
          board.set(id, aiPlayer);
          const score = minimax(board, depth + 1, false, aiPlayer);
          board.delete(id);
          bestScore = Math.max(score, bestScore);
        }
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const id = getTTTId(r, c);
        if (!board.has(id)) {
          board.set(id, opponent);
          const score = minimax(board, depth + 1, true, aiPlayer);
          board.delete(id);
          bestScore = Math.min(score, bestScore);
        }
      }
    }
    return bestScore;
  }
};