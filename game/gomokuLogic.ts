import { Player } from '../types';

export const GOMOKU_SIZE = 15;
export const getGomokuId = (r: number, c: number) => `${r},${c}`;

export const checkGomokuWin = (board: Map<string, Player>, lastMove: {r: number, c: number} | null): Player | null => {
  if (!lastMove) return null;
  const { r, c } = lastMove;
  const player = board.get(getGomokuId(r, c));
  if (!player) return null;

  const directions = [
    [1, 0], [0, 1], [1, 1], [1, -1]
  ];

  for (const [dr, dc] of directions) {
    let count = 1;
    // Check positive direction
    for (let i = 1; i < 5; i++) {
      if (board.get(getGomokuId(r + dr * i, c + dc * i)) === player) count++;
      else break;
    }
    // Check negative direction
    for (let i = 1; i < 5; i++) {
      if (board.get(getGomokuId(r - dr * i, c - dc * i)) === player) count++;
      else break;
    }
    if (count >= 5) return player;
  }
  return null;
};
