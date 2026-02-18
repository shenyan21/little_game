import { Hex, Player, BOARD_SIZE } from '../types';

export const getHexId = (q: number, r: number) => `${q},${r}`;
export const parseHexId = (id: string): Hex => {
  const [q, r] = id.split(',').map(Number);
  return { q, r };
};

// Neighbors for a hex at (q, r)
const DIRECTIONS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
];

export const getNeighbors = (hex: Hex): Hex[] => {
  return DIRECTIONS.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
};

export const isValidHex = (hex: Hex, size: number = BOARD_SIZE): boolean => {
  return hex.q >= 0 && hex.q < size && hex.r >= 0 && hex.r < size;
};

// Check if a player has won using BFS
// Black connects Left (q=0) to Right (q=size-1)
// White connects Top (r=0) to Bottom (r=size-1)
export const checkWin = (board: Map<string, Player>, player: Player, size: number = BOARD_SIZE): boolean => {
  if (player === Player.None) return false;

  const visited = new Set<string>();
  const queue: Hex[] = [];

  // Initialize queue with starting edge
  for (let i = 0; i < size; i++) {
    const startHex = player === Player.Black ? { q: 0, r: i } : { q: i, r: 0 };
    const id = getHexId(startHex.q, startHex.r);
    if (board.get(id) === player) {
      queue.push(startHex);
      visited.add(id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Check win condition
    if (player === Player.Black && current.q === size - 1) return true;
    if (player === Player.White && current.r === size - 1) return true;

    for (const d of DIRECTIONS) {
      const neighbor = { q: current.q + d.q, r: current.r + d.r };
      if (isValidHex(neighbor, size)) {
        const nId = getHexId(neighbor.q, neighbor.r);
        if (!visited.has(nId) && board.get(nId) === player) {
          visited.add(nId);
          queue.push(neighbor);
        }
      }
    }
  }

  return false;
};
