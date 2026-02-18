import { Player } from '../types';

export const getTTTId = (r: number, c: number) => `${r},${c}`;

export const checkTTTWin = (board: Map<string, Player>): { winner: Player | null, line: string[] | null } => {
  const lines = [
    // Rows
    [[0,0], [0,1], [0,2]],
    [[1,0], [1,1], [1,2]],
    [[2,0], [2,1], [2,2]],
    // Cols
    [[0,0], [1,0], [2,0]],
    [[0,1], [1,1], [2,1]],
    [[0,2], [1,2], [2,2]],
    // Diagonals
    [[0,0], [1,1], [2,2]],
    [[0,2], [1,1], [2,0]]
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    const idA = getTTTId(a[0], a[1]);
    const idB = getTTTId(b[0], b[1]);
    const idC = getTTTId(c[0], c[1]);

    const pA = board.get(idA);
    const pB = board.get(idB);
    const pC = board.get(idC);

    if (pA && pA === pB && pA === pC) {
      return { winner: pA, line: [idA, idB, idC] };
    }
  }
  return { winner: null, line: null };
};

export const isTTTFull = (board: Map<string, Player>): boolean => {
    return board.size === 9;
};