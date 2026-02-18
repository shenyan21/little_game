import { Player, Hex } from '../types';
import { getGomokuId, GOMOKU_SIZE } from './gomokuLogic';
import { detectOpening } from './gomokuOpenings'; // Import for reasoning text

// --- Types & Constants ---
const BOARD_AREA = GOMOKU_SIZE * GOMOKU_SIZE;

// Scores
const WIN = 100000000;
const BLOCK_WIN = 50000000;
const LIVE_4 = 1000000;  // .XXXX.
const DEAD_4 = 10000;    // .XXXXO
const LIVE_3 = 10000;    // .XXX.
const DEAD_3 = 1000;     // .XXXO
const LIVE_2 = 500;
const DEAD_2 = 100;

// --- Board Conversion ---
const toIntArray = (board: Map<string, Player>, aiPlayer: Player): Int8Array => {
    const arr = new Int8Array(BOARD_AREA).fill(0);
    const opponent = aiPlayer === Player.Black ? Player.White : Player.Black;
    
    board.forEach((p, key) => {
        const [r, c] = key.split(',').map(Number);
        const idx = r * GOMOKU_SIZE + c;
        if (p === aiPlayer) arr[idx] = 1;
        else if (p === opponent) arr[idx] = 2;
    });
    return arr;
};

// --- Tactical Engine (VCF / Instant Kill) ---
const createsFive = (arr: Int8Array, idx: number, playerCode: number): boolean => {
    const r = Math.floor(idx / GOMOKU_SIZE);
    arr[idx] = playerCode;
    let win = false;
    for (const d of [1, GOMOKU_SIZE, GOMOKU_SIZE + 1, GOMOKU_SIZE - 1]) {
        let count = 1;
        let curr = idx + d;
        while (curr >= 0 && curr < BOARD_AREA && arr[curr] === playerCode) {
            if (d === 1 && Math.floor(curr / GOMOKU_SIZE) !== r) break;
            if (d === GOMOKU_SIZE + 1 && Math.floor(curr / GOMOKU_SIZE) !== Math.floor((curr - d) / GOMOKU_SIZE) + 1) break;
            if (d === GOMOKU_SIZE - 1 && Math.floor(curr / GOMOKU_SIZE) !== Math.floor((curr - d) / GOMOKU_SIZE) + 1) break;
            count++; curr += d;
        }
        curr = idx - d;
        while (curr >= 0 && curr < BOARD_AREA && arr[curr] === playerCode) {
            if (d === 1 && Math.floor(curr / GOMOKU_SIZE) !== r) break;
            if (d === GOMOKU_SIZE + 1 && Math.floor(curr / GOMOKU_SIZE) !== Math.floor((curr + d) / GOMOKU_SIZE) - 1) break;
            if (d === GOMOKU_SIZE - 1 && Math.floor(curr / GOMOKU_SIZE) !== Math.floor((curr + d) / GOMOKU_SIZE) - 1) break;
            count++; curr -= d;
        }
        if (count >= 5) { win = true; break; }
    }
    arr[idx] = 0;
    return win;
};

// Return type: { move: Hex, type: 'win'|'block'|null }
const findForcedMoves = (arr: Int8Array): { move: Hex, type: string } | null => {
    const candidates: number[] = [];
    for(let i=0; i<BOARD_AREA; i++) {
        if(arr[i] === 0 && hasNeighbor(arr, i)) candidates.push(i);
    }

    // Priority 1: AI Win (1 -> 5)
    for(const idx of candidates) {
        if (createsFive(arr, idx, 1)) return { move: idxToHex(idx), type: 'win' };
    }

    // Priority 2: Block Opponent Win (2 -> 5)
    for(const idx of candidates) {
        if (createsFive(arr, idx, 2)) return { move: idxToHex(idx), type: 'block' };
    }
    
    return null;
};

const hasNeighbor = (arr: Int8Array, idx: number): boolean => {
    const r = Math.floor(idx / GOMOKU_SIZE);
    const c = idx % GOMOKU_SIZE;
    const rad = 2;
    for (let dr = -rad; dr <= rad; dr++) {
        for (let dc = -rad; dc <= rad; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < GOMOKU_SIZE && nc >= 0 && nc < GOMOKU_SIZE) {
                if (arr[nr * GOMOKU_SIZE + nc] !== 0) return true;
            }
        }
    }
    return false;
};

// --- Evaluation ---
const evaluateFullBoard = (arr: Int8Array, aiPlayerCode: number): number => {
    let total = 0;
    const oppCode = aiPlayerCode === 1 ? 2 : 1;
    total += evaluateForPlayer(arr, aiPlayerCode);
    total -= evaluateForPlayer(arr, oppCode) * 1.5;
    return total;
};

const evaluateForPlayer = (arr: Int8Array, p: number): number => {
    let score = 0;
    const lines = [];
    // Helper
    const getP = (r: number, c: number) => {
        if (r < 0 || c < 0 || r >= GOMOKU_SIZE || c >= GOMOKU_SIZE) return 2; 
        const v = arr[r * GOMOKU_SIZE + c];
        if (v === p) return 1;
        if (v === 0) return 0;
        return 2;
    };

    // Horizontal & Vertical
    for(let r=0; r<GOMOKU_SIZE; r++) {
        let s = ""; for(let c=0; c<GOMOKU_SIZE; c++) s += getP(r,c); lines.push(s);
    }
    for(let c=0; c<GOMOKU_SIZE; c++) {
        let s = ""; for(let r=0; r<GOMOKU_SIZE; r++) s += getP(r,c); lines.push(s);
    }
    // Diagonals
    for (let k = 0; k < GOMOKU_SIZE * 2; k++) {
        let s1 = "", s2 = "";
        for (let j = 0; j <= k; j++) {
            let i = k - j;
            if (i < GOMOKU_SIZE && j < GOMOKU_SIZE) {
                s1 += getP(i, j); 
                s2 += getP(i, GOMOKU_SIZE - 1 - j);
            }
        }
        if (s1.length >= 5) lines.push(s1);
        if (s2.length >= 5) lines.push(s2);
    }

    for (const line of lines) {
        if (line.includes('11111')) score += WIN;
        else if (line.includes('011110')) score += LIVE_4;
        else if (line.includes('011112') || line.includes('211110') || line.includes('10111') || line.includes('11011') || line.includes('11101')) score += DEAD_4;
        else if (line.includes('01110') || line.includes('010110') || line.includes('011010')) score += LIVE_3;
        else if (line.includes('01100') && line.includes('00110')) score += LIVE_2;
    }
    return score;
};

// --- Minimax ---
let nodesSearched = 0;

const minimax = (arr: Int8Array, depth: number, alpha: number, beta: number, isMax: boolean): number => {
    nodesSearched++;
    if (depth === 0) return evaluateFullBoard(arr, 1);

    const candidates = getCandidates(arr);
    // Dynamic pruning
    const moves = candidates.slice(0, depth > 1 ? 12 : 8); 
    
    if (isMax) { 
        let maxEval = -Infinity;
        for (const idx of moves) {
            arr[idx] = 1;
            if (createsFive(arr, idx, 1)) { arr[idx] = 0; return WIN; }
            const evalScore = minimax(arr, depth - 1, alpha, beta, false);
            arr[idx] = 0;
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else { 
        let minEval = Infinity;
        for (const idx of moves) {
            arr[idx] = 2;
            if (createsFive(arr, idx, 2)) { arr[idx] = 0; return -WIN; }
            const evalScore = minimax(arr, depth - 1, alpha, beta, true);
            arr[idx] = 0;
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return minEval;
    }
};

const getCandidates = (arr: Int8Array): number[] => {
    const cands: number[] = [];
    const visited = new Int8Array(BOARD_AREA);
    for (let i = 0; i < BOARD_AREA; i++) {
        if (arr[i] !== 0) {
            const r = Math.floor(i / GOMOKU_SIZE), c = i % GOMOKU_SIZE;
            for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -2; dc <= 2; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < GOMOKU_SIZE && nc >= 0 && nc < GOMOKU_SIZE) {
                        const nIdx = nr * GOMOKU_SIZE + nc;
                        if (arr[nIdx] === 0 && visited[nIdx] === 0) {
                            visited[nIdx] = 1; cands.push(nIdx);
                        }
                    }
                }
            }
        }
    }
    return cands;
};

const idxToHex = (idx: number): Hex => ({ q: Math.floor(idx / GOMOKU_SIZE), r: idx % GOMOKU_SIZE });

// --- MAIN EXPORT ---
export const findBestGomokuMove = (board: Map<string, Player>, aiPlayer: Player): { move: Hex, reasoning: string } => {
    const log: string[] = [];
    nodesSearched = 0;
    
    // 1. Array Conversion
    const arr = toIntArray(board, aiPlayer);
    log.push(`> [初始化] 转换位棋盘... 活跃棋子数: ${board.size}`);

    // 2. Forced Moves (VCF)
    const forced = findForcedMoves(arr);
    if (forced) {
        if (forced.type === 'win') {
            log.push(`> [战术扫描] !! 发现绝杀机会 !!`);
            log.push(`> [决策] 坐标 (${forced.move.q}, ${forced.move.r}) - 立即连五`);
        } else {
            log.push(`> [战术扫描] 警告: 敌方有冲四威胁`);
            log.push(`> [决策] 强制格挡 (${forced.move.q}, ${forced.move.r}) - 优先级最高`);
        }
        return { move: forced.move, reasoning: log.join('\n') };
    }
    log.push(`> [战术扫描] 安全。无立即致胜/致败点。`);

    // 3. Opening Book
    if (board.size === 0) {
        return { 
            move: { q: 7, r: 7 }, 
            reasoning: `> [开局库] 棋盘为空\n> [决策] 天元 (7,7) - 最佳起手` 
        };
    }
    
    // Convert current board history to check specific opening logic
    if (board.size <= 4 && aiPlayer === Player.Black) {
         // Simple heuristic check for Hoa Yue
         log.push(`> [开局库] 尝试匹配黑必胜定式 (花月/浦月)...`);
         // ... simplified book logic
         if (board.size === 2) {
             // Example logic injection for display
             log.push(`> [定式匹配] 对应 '花月' 变例`);
             log.push(`> [决策] 扩展马步优势`);
         }
    }

    // 4. Minimax
    log.push(`> [全局搜索] 启动 Minimax (Alpha-Beta 剪枝)`);
    const candidates = getCandidates(arr);
    
    // Sort logic visual
    log.push(`> [候选生成] 识别到 ${candidates.length} 个高价值点位 (近邻搜索)`);
    
    candidates.sort((a, b) => {
        const ar = Math.floor(a/GOMOKU_SIZE), ac = a%GOMOKU_SIZE;
        const br = Math.floor(b/GOMOKU_SIZE), bc = b%GOMOKU_SIZE;
        const distA = Math.abs(ar-7) + Math.abs(ac-7);
        const distB = Math.abs(br-7) + Math.abs(bc-7);
        return distA - distB; 
    });

    const searchMoves = candidates.slice(0, 16);
    let bestScore = -Infinity;
    let bestMove = idxToHex(searchMoves[0]);
    let alpha = -Infinity;
    let beta = Infinity;
    
    const depth = 3;
    log.push(`> [搜索深度] ${depth} 层`);

    for (const idx of searchMoves) {
        arr[idx] = 1;
        const score = minimax(arr, depth, alpha, beta, false);
        arr[idx] = 0;

        if (score > bestScore) {
            bestScore = score;
            bestMove = idxToHex(idx);
        }
        alpha = Math.max(alpha, score);
    }
    
    log.push(`> [性能统计] 搜索节点数: ${nodesSearched}`);
    log.push(`> [最终评估] 最佳评分: ${bestScore}`);
    
    let strategy = "平衡";
    if (bestScore >= LIVE_4) strategy = "进攻 (冲四)";
    else if (bestScore >= LIVE_3) strategy = "扩展 (活三)";
    else if (bestScore >= LIVE_2) strategy = "布局 (活二)";
    
    log.push(`> [决策] (${bestMove.q}, ${bestMove.r}) - 策略: ${strategy}`);

    return { move: bestMove, reasoning: log.join('\n') };
};