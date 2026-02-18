
export const COLS = 10;
export const ROWS = 20;

export type TetrominoType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface Tetromino {
  shape: number[][];
  type: TetrominoType;
  color: string; // CSS color for base
  borderLight: string;
  borderDark: string;
}

export const TETROMINOS: Record<TetrominoType, Tetromino> = {
  I: { 
    shape: [[1, 1, 1, 1]], 
    type: 'I', 
    color: '#06b6d4', // Cyan
    borderLight: '#67e8f9',
    borderDark: '#0e7490'
  }, 
  J: { 
    shape: [[1, 0, 0], [1, 1, 1]], 
    type: 'J', 
    color: '#3b82f6', // Blue
    borderLight: '#93c5fd',
    borderDark: '#1d4ed8'
  },
  L: { 
    shape: [[0, 0, 1], [1, 1, 1]], 
    type: 'L', 
    color: '#f97316', // Orange
    borderLight: '#fdba74',
    borderDark: '#c2410c'
  },
  O: { 
    shape: [[1, 1], [1, 1]], 
    type: 'O', 
    color: '#eab308', // Yellow
    borderLight: '#fde047',
    borderDark: '#a16207'
  },
  S: { 
    shape: [[0, 1, 1], [1, 1, 0]], 
    type: 'S', 
    color: '#22c55e', // Green
    borderLight: '#86efac',
    borderDark: '#15803d'
  },
  T: { 
    shape: [[0, 1, 0], [1, 1, 1]], 
    type: 'T', 
    color: '#a855f7', // Purple
    borderLight: '#d8b4fe',
    borderDark: '#7e22ce'
  },
  Z: { 
    shape: [[1, 1, 0], [0, 1, 1]], 
    type: 'Z', 
    color: '#ef4444', // Red
    borderLight: '#fca5a5',
    borderDark: '#b91c1c'
  }
};

export const getRandomTetromino = (): Tetromino => {
  const types: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  const rand = types[Math.floor(Math.random() * types.length)];
  return TETROMINOS[rand];
};

export const rotateMatrix = (matrix: number[][]): number[][] => {
  return matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());
};

export const checkCollision = (
  board: (string | null)[][],
  shape: number[][],
  pos: { x: number; y: number }
): boolean => {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x] !== 0) {
        const boardX = pos.x + x;
        const boardY = pos.y + y;

        // Check bounds
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
          return true;
        }

        // Check existing blocks
        if (boardY >= 0 && board[boardY][boardX] !== null) {
          return true;
        }
      }
    }
  }
  return false;
};

// --- AI Logic ---

interface MoveScore {
  x: number;
  rotation: number; // 0, 1, 2, 3
  score: number;
  simulatedBoard: (string | null)[][];
}

const getLandingHeight = (board: (string | null)[][], shape: number[][], x: number): { y: number, isValid: boolean } => {
    let y = -2; // Start above board
    while (!checkCollision(board, shape, { x, y: y + 1 })) {
        y++;
    }
    // Check if valid placement (not stuck at top)
    if (y < 0 && checkCollision(board, shape, {x, y})) return { y, isValid: false };
    return { y, isValid: true };
};

const evaluateBoard = (board: (string | null)[][]): number => {
    let aggregateHeight = 0;
    let completeLines = 0;
    let holes = 0;
    let bumpiness = 0;
    
    // Get column heights
    const colHeights = new Array(COLS).fill(0);
    for(let c=0; c<COLS; c++) {
        for(let r=0; r<ROWS; r++) {
            if(board[r][c] !== null) {
                colHeights[c] = ROWS - r;
                break;
            }
        }
    }

    // Aggregate Height
    aggregateHeight = colHeights.reduce((a, b) => a + b, 0);

    // Complete Lines
    for(let r=0; r<ROWS; r++) {
        if(board[r].every(cell => cell !== null)) completeLines++;
    }

    // Holes
    for(let c=0; c<COLS; c++) {
        let blockFound = false;
        for(let r=0; r<ROWS; r++) {
            if(board[r][c] !== null) blockFound = true;
            else if(blockFound && board[r][c] === null) holes++;
        }
    }

    // Bumpiness
    for(let c=0; c<COLS-1; c++) {
        bumpiness += Math.abs(colHeights[c] - colHeights[c+1]);
    }

    // Heuristic Weights
    const wHeight = -0.51;
    const wLines = 0.76;
    const wHoles = -0.36; // Holes are very bad
    const wBumpiness = -0.18;

    return (aggregateHeight * wHeight) + (completeLines * wLines) + (holes * wHoles) + (bumpiness * wBumpiness);
};

export const getBestMove = (board: (string | null)[][], piece: Tetromino): { x: number, y: number, shape: number[][] } | null => {
    let bestScore = -Infinity;
    let bestMove = null;

    let currentShape = piece.shape;

    // Iterate Rotations (0 to 3)
    for (let r = 0; r < 4; r++) {
        // Optimization: some shapes have duplicate states
        // O: 1 state, S/Z/I: 2 states, J/L/T: 4 states. 
        // For simplicity we check all 4, collision checks are cheap.
        
        // Iterate Columns
        for (let x = -2; x < COLS; x++) {
            const landing = getLandingHeight(board, currentShape, x);
            
            if (landing.isValid && !checkCollision(board, currentShape, {x, y: landing.y})) {
                // Simulate placement
                // We don't clone the whole board for performance if we can avoid it, 
                // but for React/safety let's do a shallow copy of rows + modified rows
                const simBoard = board.map(row => [...row]);
                
                // Place piece
                for(let py=0; py<currentShape.length; py++) {
                    for(let px=0; px<currentShape[py].length; px++) {
                        if(currentShape[py][px] !== 0) {
                            const by = landing.y + py;
                            const bx = x + px;
                            if(by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
                                simBoard[by][bx] = 'sim';
                            }
                        }
                    }
                }
                
                const score = evaluateBoard(simBoard);
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { x, y: landing.y, shape: currentShape };
                }
            }
        }
        currentShape = rotateMatrix(currentShape);
    }

    return bestMove;
};
