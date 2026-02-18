import { Hex, Player, BOARD_SIZE } from '../types';
import { getHexId, getNeighbors, isValidHex, parseHexId } from './logic';

// Infinity for pathfinding
const INF = 999999;
const WIN_SCORE = 1000000;

// Dijkstra to find shortest path for a player to connect their sides
// Returns the distance (number of empty cells needed)
const getShortestPath = (
  board: Map<string, Player>,
  player: Player,
  size: number
): number => {
  const dist = new Map<string, number>();
  const priorityQueue: { id: string; d: number }[] = [];

  const addToQueue = (id: string, d: number) => {
    if (d < (dist.get(id) ?? INF)) {
      dist.set(id, d);
      priorityQueue.push({ id, d });
      priorityQueue.sort((a, b) => a.d - b.d); 
    }
  };

  // Initialize with start edge nodes
  for (let i = 0; i < size; i++) {
    const startHex = player === Player.Black ? { q: 0, r: i } : { q: i, r: 0 };
    const id = getHexId(startHex.q, startHex.r);
    const cellOwner = board.get(id) ?? Player.None;

    if (cellOwner === player) {
      addToQueue(id, 0);
    } else if (cellOwner === Player.None) {
      addToQueue(id, 1);
    }
  }

  let minDistance = INF;

  while (priorityQueue.length > 0) {
    const { id, d } = priorityQueue.shift()!;
    if (d > (dist.get(id) ?? INF)) continue;

    const current = parseHexId(id);

    // Check if reached target edge
    if (player === Player.Black && current.q === size - 1) minDistance = Math.min(minDistance, d);
    if (player === Player.White && current.r === size - 1) minDistance = Math.min(minDistance, d);

    if (minDistance === 0) return 0; 

    const neighbors = getNeighbors(current);
    for (const neighbor of neighbors) {
      if (isValidHex(neighbor, size)) {
        const nId = getHexId(neighbor.q, neighbor.r);
        const cellOwner = board.get(nId) ?? Player.None;
        
        // Weight: 0 if owned, 1 if empty, INF if opponent
        let weight = INF;
        if (cellOwner === player) weight = 0;
        else if (cellOwner === Player.None) weight = 1;
        
        if (weight !== INF) {
          addToQueue(nId, d + weight);
        }
      }
    }
  }

  return minDistance;
};

// Heuristic Evaluation
const evaluateBoard = (board: Map<string, Player>, player: Player, size: number): number => {
  const opponent = player === Player.Black ? Player.White : Player.Black;
  
  const myDist = getShortestPath(board, player, size);
  const oppDist = getShortestPath(board, opponent, size);

  if (myDist === 0) return WIN_SCORE;
  if (oppDist === 0) return -WIN_SCORE;
  if (myDist >= INF) return -WIN_SCORE + 100; 
  if (oppDist >= INF) return WIN_SCORE - 100; 

  // Core Heuristic: (OpponentDistance - MyDistance)
  // But we use inverse distance to emphasize "close to winning"
  const myScore = 1000 / Math.pow(myDist, 1.4);
  const oppScore = 1000 / Math.pow(oppDist, 1.4);

  // DEFENSIVE TWEAK:
  // If AI is White (usually Player 2), it is naturally at a disadvantage.
  // We must value "blocking" (reducing oppScore) significantly more.
  // Increased multiplier from 1.2 to 1.8 to make AI extremely aggressive in blocking.
  const defensiveMultiplier = player === Player.White ? 1.8 : 1.1;

  // CENTRALITY BONUS:
  // In Hex, the center is valuable.
  // We add a small bonus for occupying central cells to guide the AI when distances are equal.
  let centrality = 0;
  const center = (size - 1) / 2;
  board.forEach((p, id) => {
    if (p === player) {
      const {q, r} = parseHexId(id);
      const distToCenter = Math.abs(q - center) + Math.abs(r - center);
      centrality += (15 - distToCenter); // Increased centrality weight
    }
  });

  return (myScore - (oppScore * defensiveMultiplier)) * 100 + centrality;
};

const getCandidateMoves = (board: Map<string, Player>, size: number): Hex[] => {
  if (board.size === 0) {
    const center = Math.floor(size / 2);
    return [{ q: center, r: center }];
  }

  const candidates = new Set<string>();
  const taken = new Set(board.keys());

  const addNeighbors = (h: Hex) => {
    const neighbors = getNeighbors(h);
    for (const n of neighbors) {
      if (isValidHex(n, size)) {
        const id = getHexId(n.q, n.r);
        if (!taken.has(id)) {
          candidates.add(id);
        }
      }
    }
  };

  // Add neighbors of all occupied cells (both mine and opponent's)
  for (const id of taken) {
    addNeighbors(parseHexId(id));
  }
  
  return Array.from(candidates).map(parseHexId);
};

const minimax = (
  board: Map<string, Player>,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  aiPlayer: Player,
  size: number
): { score: number, move: Hex | null } => {
  
  if (depth === 0) {
    return { score: evaluateBoard(board, aiPlayer, size), move: null };
  }

  const opponent = aiPlayer === Player.Black ? Player.White : Player.Black;
  const currentPlayer = isMaximizing ? aiPlayer : opponent;

  // Fast win check
  const evalScore = evaluateBoard(board, aiPlayer, size);
  if (Math.abs(evalScore) > WIN_SCORE - 1000) {
     return { score: evalScore, move: null };
  }

  let moves = getCandidateMoves(board, size);
  
  // Sorting candidates (Optimization)
  if (moves.length > 0) {
     const center = (size - 1) / 2;
     moves.sort((a, b) => {
        const distA = Math.abs(a.q - center) + Math.abs(a.r - center);
        const distB = Math.abs(b.q - center) + Math.abs(b.r - center);
        return distA - distB; // Ascending distance (closer to center first)
     });
     
     // Beam search limitation: Keep top 25
     if (depth >= 2 && moves.length > 25) {
        moves = moves.slice(0, 25);
     }
  }

  let bestMove: Hex | null = null;

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const id = getHexId(move.q, move.r);
      board.set(id, aiPlayer);
      const result = minimax(board, depth - 1, alpha, beta, false, aiPlayer, size);
      board.delete(id);

      if (result.score > maxEval) {
        maxEval = result.score;
        bestMove = move;
      }
      alpha = Math.max(alpha, result.score);
      if (beta <= alpha) break;
    }
    return { score: maxEval, move: bestMove || moves[0] };
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const id = getHexId(move.q, move.r);
      board.set(id, opponent);
      const result = minimax(board, depth - 1, alpha, beta, true, aiPlayer, size);
      board.delete(id);

      if (result.score < minEval) {
        minEval = result.score;
        bestMove = move;
      }
      beta = Math.min(beta, result.score);
      if (beta <= alpha) break;
    }
    return { score: minEval, move: bestMove || moves[0] };
  }
};

export const findBestMove = (
  board: Map<string, Player>,
  aiPlayer: Player,
  size: number
): Hex => {
  // Opening Book: 
  if (board.size === 0) {
     const c = Math.floor(size / 2);
     return { q: c, r: c };
  }
  
  // Stronger defense against center start
  if (board.size === 1 && aiPlayer === Player.White) {
      const occupied = board.keys().next().value!;
      const {q, r} = parseHexId(occupied);
      // If Black took center, take an adjacent cell that blocks towards the short diagonal
      if (q === 5 && r === 5) return { q: 6, r: 4 }; 
  }

  // Run Minimax
  // Increased depth or beam width implicitly via defensive heuristics
  const result = minimax(board, 2, -Infinity, Infinity, true, aiPlayer, size);
  
  if (result.move) return result.move;

  const moves = getCandidateMoves(board, size);
  return moves[0];
};
