
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  COLS, ROWS, TETROMINOS, getRandomTetromino, 
  rotateMatrix, checkCollision, Tetromino, getBestMove 
} from '../game/tetrisLogic';
import { Play, RotateCcw, BrainCircuit, Joystick, ToggleLeft, ToggleRight, Ghost, Pause, PlayCircle } from 'lucide-react';

const TetrisBoard: React.FC = () => {
  const [grid, setGrid] = useState<(string | null)[][]>(
    Array.from({ length: ROWS }, () => Array(COLS).fill(null))
  );
  
  // Game State
  const [activePiece, setActivePiece] = useState<{
    pos: { x: number; y: number };
    tetromino: Tetromino;
    shape: number[][];
  } | null>(null);

  const [nextPiece, setNextPiece] = useState<Tetromino | null>(null);
  
  const [aiGhost, setAiGhost] = useState<{ x: number, y: number, shape: number[][] } | null>(null);
  const [enableAI, setEnableAI] = useState(true);
  const [showShadow, setShowShadow] = useState(true);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [clearingRows, setClearingRows] = useState<number[]>([]); // Rows currently animating out
  
  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  const dropInterval = 800; // ms

  // Init
  const startGame = () => {
    // Synchronously create the empty grid to ensure first piece logic is correct
    const emptyGrid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    setGrid(emptyGrid);
    setScore(0);
    setGameOver(false);
    setIsPlaying(true);
    setIsPaused(false);
    setClearingRows([]);
    
    // Initialize pieces
    const firstNext = getRandomTetromino();
    setNextPiece(firstNext);
    
    const initial = getRandomTetromino();
    // Directly set active piece for the start to avoid async state issues with spawnPiece checking collision against old grid
    setActivePiece({
      pos: { x: Math.floor(COLS / 2) - 1, y: 0 },
      tetromino: initial,
      shape: initial.shape
    });
  };

  const togglePause = useCallback(() => {
      if (!isPlaying || gameOver) return;
      setIsPaused(prev => !prev);
  }, [isPlaying, gameOver]);

  const spawnPiece = useCallback(() => {
    if (!nextPiece) return;

    const pieceToSpawn = nextPiece;
    const nextToSet = getRandomTetromino();
    setNextPiece(nextToSet);

    const newPiece = {
      pos: { x: Math.floor(COLS / 2) - 1, y: 0 },
      tetromino: pieceToSpawn,
      shape: pieceToSpawn.shape
    };

    // Check collision against CURRENT grid state
    if (checkCollision(grid, newPiece.shape, newPiece.pos)) {
      setGameOver(true);
      setIsPlaying(false);
    } else {
      setActivePiece(newPiece);
    }
  }, [grid, nextPiece]);

  // AI Suggestion Calculation
  useEffect(() => {
      if (!activePiece || gameOver || !enableAI || isPaused) {
          setAiGhost(null);
          return;
      }
      
      const timer = setTimeout(() => {
          const suggestion = getBestMove(grid, { ...activePiece.tetromino, shape: activePiece.shape });
          setAiGhost(suggestion);
      }, 0);
      return () => clearTimeout(timer);
  }, [activePiece?.tetromino.type, activePiece?.shape, activePiece?.pos.x, activePiece?.pos.y, grid, gameOver, enableAI, isPaused]);


  const lockPiece = useCallback((finalPos?: {x: number, y: number}) => {
    // If finalPos provided (Hard Drop), use it. Otherwise use activePiece.pos
    if (!activePiece && !finalPos) return;
    
    const posToLock = finalPos || activePiece!.pos;
    const shapeToLock = activePiece!.shape;
    const colorToLock = activePiece!.tetromino.color;

    // 1. Create temporary grid with locked piece
    const tempGrid = grid.map(row => [...row]);
    
    for (let y = 0; y < shapeToLock.length; y++) {
      for (let x = 0; x < shapeToLock[y].length; x++) {
        if (shapeToLock[y][x] !== 0) {
          const boardY = posToLock.y + y;
          const boardX = posToLock.x + x;
          if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
            tempGrid[boardY][boardX] = colorToLock;
          }
        }
      }
    }

    // 2. Identify full lines
    const fullRows: number[] = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      if (tempGrid[y].every(cell => cell !== null)) {
        fullRows.push(y);
      }
    }

    // 3. Handle Animation & Clearing
    if (fullRows.length > 0) {
        // Show locked state + animation
        setGrid(tempGrid);
        setActivePiece(null); // Hide active piece immediately
        setClearingRows(fullRows);

        // Wait for animation
        setTimeout(() => {
            const finalGrid = tempGrid.filter((_, index) => !fullRows.includes(index));
            // Add new empty rows at top
            while (finalGrid.length < ROWS) {
                finalGrid.unshift(Array(COLS).fill(null));
            }
            
            const lines = fullRows.length;
            setScore(prev => prev + (lines * 100 * lines)); // Exponential score
            setGrid(finalGrid);
            setClearingRows([]);
            spawnPiece();
        }, 300); // 300ms animation
    } else {
        // No lines cleared, just lock and next
        setGrid(tempGrid);
        spawnPiece();
    }
  }, [activePiece, grid, spawnPiece]);

  const move = useCallback((dir: { x: number; y: number }) => {
    if (!activePiece || gameOver || !isPlaying || isPaused || clearingRows.length > 0) return;

    const newPos = { x: activePiece.pos.x + dir.x, y: activePiece.pos.y + dir.y };
    if (!checkCollision(grid, activePiece.shape, newPos)) {
      setActivePiece(prev => prev ? ({ ...prev, pos: newPos }) : null);
      return true;
    } else if (dir.y > 0) {
      // Hit bottom (Soft drop hit)
      lockPiece();
      return false;
    }
    return false;
  }, [activePiece, grid, gameOver, isPlaying, isPaused, lockPiece, clearingRows]);

  const hardDrop = useCallback(() => {
    if (!activePiece || gameOver || !isPlaying || isPaused || clearingRows.length > 0) return;
    
    let landY = activePiece.pos.y;
    // Calculate lowest valid Y
    while (!checkCollision(grid, activePiece.shape, { x: activePiece.pos.x, y: landY + 1 })) {
      landY++;
    }
    
    const finalPos = { x: activePiece.pos.x, y: landY };
    // We pass the final position directly to lock to ensure sync
    lockPiece(finalPos);
  }, [activePiece, grid, gameOver, isPlaying, isPaused, lockPiece, clearingRows]);

  const rotate = useCallback(() => {
    if (!activePiece || gameOver || !isPlaying || isPaused || clearingRows.length > 0) return;
    const newShape = rotateMatrix(activePiece.shape);
    if (!checkCollision(grid, newShape, activePiece.pos)) {
      setActivePiece(prev => prev ? ({ ...prev, shape: newShape }) : null);
    } else {
        // Wall kick try: left 1, right 1
        if (!checkCollision(grid, newShape, { ...activePiece.pos, x: activePiece.pos.x - 1})) {
            setActivePiece(prev => prev ? ({ ...prev, pos: { ...prev.pos, x: prev.pos.x - 1 }, shape: newShape }) : null);
        } else if (!checkCollision(grid, newShape, { ...activePiece.pos, x: activePiece.pos.x + 1})) {
            setActivePiece(prev => prev ? ({ ...prev, pos: { ...prev.pos, x: prev.pos.x + 1 }, shape: newShape }) : null);
        }
    }
  }, [activePiece, grid, gameOver, isPlaying, isPaused, clearingRows]);

  // Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space toggles pause even if playing
      if (e.code === 'Space') {
          togglePause();
          return;
      }

      if (!isPlaying || gameOver || isPaused) return;
      
      switch(e.key.toLowerCase()) {
        case 'a': // Left
          move({ x: -1, y: 0 });
          break;
        case 'd': // Right
          move({ x: 1, y: 0 });
          break;
        case 's': // Hard Drop (Changed from Soft Drop)
          hardDrop();
          break;
        case 'w': // Rotate
          rotate();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, gameOver, isPaused, move, rotate, hardDrop, togglePause]);

  // Game Loop
  const update = useCallback((time: number) => {
    if (!isPlaying || gameOver || isPaused || clearingRows.length > 0) return;
    
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    
    dropCounterRef.current += deltaTime;
    if (dropCounterRef.current > dropInterval) {
      move({ x: 0, y: 1 });
      dropCounterRef.current = 0;
    }
    
    requestRef.current = requestAnimationFrame(update);
  }, [isPlaying, gameOver, isPaused, move, clearingRows]);

  useEffect(() => {
    if (isPlaying && !gameOver && !isPaused && clearingRows.length === 0) {
      // Reset timer ref to avoid jump after pause
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, gameOver, isPaused, update, clearingRows]);


  // Rendering Helpers
  const renderCell = (x: number, y: number, color: string | null, type: 'normal' | 'ghost' | 'shadow' = 'normal') => {
    if (!color) return null;
    
    const isClearing = clearingRows.includes(y);

    // Base Style
    const style: React.CSSProperties = {
        borderRadius: '2px',
        transform: isClearing ? 'scale(0)' : 'scale(1)',
        transition: isClearing ? 'all 0.3s ease-out' : 'none',
        zIndex: type === 'normal' ? 2 : 1, // Normal blocks above ghosts/shadows
    };

    if (type === 'normal') {
        style.backgroundColor = color;
        style.boxShadow = `inset 2px 2px 4px rgba(255,255,255,0.4), inset -2px -2px 4px rgba(0,0,0,0.4), 2px 2px 4px rgba(0,0,0,0.3)`;
        style.opacity = isClearing ? 0 : 1;
    } else if (type === 'ghost') {
        // AI Hint: White Dotted
        style.backgroundColor = 'transparent';
        style.border = '2px dotted rgba(255, 255, 255, 0.8)';
        style.opacity = 0.7;
    } else if (type === 'shadow') {
        // Landing Hint: Piece Color, Faded, Solid Border
        style.backgroundColor = color;
        style.opacity = 0.25;
        style.border = `1px solid ${color}`;
        style.boxShadow = 'none';
    }
    
    // Flash effect for clearing
    if (isClearing) {
        style.backgroundColor = '#fff';
        style.boxShadow = '0 0 10px #fff';
        style.opacity = 1;
        style.zIndex = 10;
    }

    return (
        <div 
            key={`${x}-${y}-${type}`} 
            className="absolute w-full h-full"
            style={{
                left: `${x * 100 / COLS}%`,
                top: `${y * 100 / ROWS}%`,
                width: `${100 / COLS}%`,
                height: `${100 / ROWS}%`,
                padding: '1px', // Gap
                zIndex: style.zIndex,
            }}
        >
            <div className="w-full h-full" style={style}></div>
        </div>
    );
  };

  const renderPreviewPiece = () => {
      if (!nextPiece) return null;
      const shape = nextPiece.shape;
      // Center in a 4x4 grid
      return (
          <div className="relative w-24 h-24 grid grid-cols-4 grid-rows-4 bg-slate-900/50 rounded p-1">
              {shape.map((row, r) => row.map((cell, c) => {
                  if (!cell) return null;
                  // Center offsets based on piece type
                  let offX = 0, offY = 1; 
                  if (nextPiece.type === 'I') { offX = 0; offY = 0.5; }
                  else if (nextPiece.type === 'O') { offX = 1; offY = 1; }
                  else { offX = 0.5; offY = 1; }

                  const style: React.CSSProperties = {
                    backgroundColor: nextPiece.color,
                    boxShadow: `inset 2px 2px 4px rgba(255,255,255,0.4), inset -2px -2px 4px rgba(0,0,0,0.4)`,
                    gridColumnStart: c + 1 + Math.floor(offX),
                    gridRowStart: r + 1 + Math.floor(offY),
                    width: '100%',
                    height: '100%',
                    borderRadius: '2px'
                  };
                  return <div key={`${r}-${c}`} style={style} />
              }))}
          </div>
      )
  };

  // Calculate shadow Y position
  let shadowY: number | null = null;
  if (isPlaying && !gameOver && !isPaused && activePiece && showShadow) {
      shadowY = activePiece.pos.y;
      while (!checkCollision(grid, activePiece.shape, { x: activePiece.pos.x, y: shadowY + 1 })) {
          shadowY++;
      }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-slate-900 p-4 font-sans">
        
        <div className="flex flex-col md:flex-row gap-8 items-start">
            
            {/* Game Board */}
            <div className="relative bg-slate-800 border-8 border-slate-700 rounded-lg shadow-2xl overflow-hidden" 
                 style={{ width: '300px', height: '600px' }}>
                
                {/* Pause Button (Top Right) */}
                {isPlaying && !gameOver && (
                    <button 
                        onClick={togglePause}
                        className="absolute top-2 right-2 z-40 p-2 bg-slate-900/50 text-white rounded hover:bg-slate-700 hover:text-emerald-400 transition-colors"
                        title="暂停 (Space)"
                    >
                        {isPaused ? <PlayCircle size={24} /> : <Pause size={24} />}
                    </button>
                )}
                
                {/* Grid Background */}
                <div className="absolute inset-0 grid grid-cols-10 grid-rows-20 pointer-events-none opacity-10">
                    {Array.from({ length: ROWS * COLS }).map((_, i) => (
                        <div key={i} className="border border-slate-500"></div>
                    ))}
                </div>

                {/* Static Blocks */}
                {grid.map((row, y) => row.map((color, x) => renderCell(x, y, color, 'normal')))}
                
                {/* Shadow Piece (Landing Hint) */}
                {shadowY !== null && activePiece && activePiece.shape.map((row, r) => 
                   row.map((cell, c) => {
                       if (cell) {
                           return renderCell(activePiece.pos.x + c, shadowY! + r, activePiece.tetromino.color, 'shadow');
                       }
                       return null;
                   })
                )}

                {/* AI Ghost Piece */}
                {isPlaying && !gameOver && !isPaused && enableAI && aiGhost && aiGhost.shape.map((row, r) => 
                   row.map((cell, c) => {
                       if (cell) {
                           return renderCell(aiGhost.x + c, aiGhost.y + r, '#ffffff', 'ghost');
                       }
                       return null;
                   })
                )}

                {/* Active Piece */}
                {isPlaying && !gameOver && !isPaused && activePiece && activePiece.shape.map((row, r) => 
                   row.map((cell, c) => {
                       if (cell) {
                           return renderCell(activePiece.pos.x + c, activePiece.pos.y + r, activePiece.tetromino.color, 'normal');
                       }
                       return null;
                   })
                )}

                {/* Start Overlay */}
                {!isPlaying && !gameOver && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
                        <h2 className="text-4xl font-bold text-white mb-4 shadow-text">TETRIS 3D</h2>
                        <button 
                            onClick={startGame}
                            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-lg flex items-center gap-2 transform transition hover:scale-105"
                        >
                            <Play /> 开始游戏
                        </button>
                    </div>
                )}
                
                {/* Pause Overlay */}
                {isPlaying && isPaused && !gameOver && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-50 animate-in fade-in">
                        <h2 className="text-3xl font-bold text-amber-400 mb-6 tracking-widest">PAUSED</h2>
                        <div className="flex flex-col gap-4">
                            <button 
                                onClick={togglePause}
                                className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded shadow-lg flex items-center justify-center gap-2 w-40"
                            >
                                <Play size={18} /> 继续
                            </button>
                            <button 
                                onClick={startGame}
                                className="px-8 py-3 bg-slate-600 hover:bg-slate-500 text-white font-bold rounded shadow-lg flex items-center justify-center gap-2 w-40"
                            >
                                <RotateCcw size={18} /> 重开
                            </button>
                        </div>
                    </div>
                )}

                {/* Game Over Overlay */}
                {gameOver && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50 animate-in fade-in">
                        <h2 className="text-3xl font-bold text-red-500 mb-2">GAME OVER</h2>
                        <p className="text-white mb-6">最终得分: {score}</p>
                        <button 
                            onClick={startGame}
                            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded shadow-lg flex items-center gap-2"
                        >
                            <RotateCcw /> 再来一局
                        </button>
                    </div>
                )}
            </div>

            {/* Side Panel */}
            <div className="flex flex-col gap-4 w-64">
                
                {/* Score & Preview */}
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg flex flex-col gap-4">
                    <div>
                        <h3 className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-1">当前得分</h3>
                        <div className="text-3xl font-mono text-emerald-400 font-bold">{score}</div>
                    </div>
                    
                    <div className="border-t border-slate-700 pt-4">
                        <h3 className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-2">下一个 (Next)</h3>
                        <div className="flex justify-center">
                            {renderPreviewPiece()}
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                    <h3 className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-4 flex items-center gap-2">
                        <Joystick size={14} /> 操作指南
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                        <div className="flex flex-col bg-slate-700/50 p-2 rounded items-center">
                            <span className="text-[10px] text-slate-400 mb-1">左移</span>
                            <kbd className="bg-slate-900 px-2 py-1 rounded font-mono border border-slate-600 font-bold">A</kbd>
                        </div>
                        <div className="flex flex-col bg-slate-700/50 p-2 rounded items-center">
                            <span className="text-[10px] text-slate-400 mb-1">右移</span>
                            <kbd className="bg-slate-900 px-2 py-1 rounded font-mono border border-slate-600 font-bold">D</kbd>
                        </div>
                        <div className="flex flex-col bg-slate-700/50 p-2 rounded items-center">
                            <span className="text-[10px] text-slate-400 mb-1">旋转</span>
                            <kbd className="bg-slate-900 px-2 py-1 rounded font-mono border border-slate-600 font-bold">W</kbd>
                        </div>
                        <div className="flex flex-col bg-slate-700/50 p-2 rounded items-center">
                            <span className="text-[10px] text-slate-400 mb-1">硬下落</span>
                            <kbd className="bg-slate-900 px-2 py-1 rounded font-mono border border-slate-600 font-bold">S</kbd>
                        </div>
                        <div className="flex flex-col bg-slate-700/50 p-2 rounded items-center col-span-2">
                            <span className="text-[10px] text-slate-400 mb-1">暂停 / 继续</span>
                            <kbd className="bg-slate-900 px-2 py-1 rounded font-mono border border-slate-600 font-bold">Space</kbd>
                        </div>
                    </div>
                </div>

                {/* Auxiliary Toggles */}
                <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg space-y-4">
                    <h3 className="text-slate-400 text-xs uppercase tracking-wider font-bold mb-2">游戏辅助</h3>
                    
                    {/* AI Toggle */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
                            <BrainCircuit size={16} /> AI 建议
                        </div>
                        <button 
                            onClick={() => setEnableAI(!enableAI)}
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            {enableAI ? <ToggleRight className="text-emerald-500 w-8 h-8" /> : <ToggleLeft className="text-slate-500 w-8 h-8" />}
                        </button>
                    </div>

                    {/* Shadow Toggle */}
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 text-orange-400 font-bold text-sm">
                            <Ghost size={16} /> 落点提示
                        </div>
                        <button 
                            onClick={() => setShowShadow(!showShadow)}
                            className="text-slate-300 hover:text-white transition-colors"
                        >
                            {showShadow ? <ToggleRight className="text-emerald-500 w-8 h-8" /> : <ToggleLeft className="text-slate-500 w-8 h-8" />}
                        </button>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed pt-2 border-t border-slate-700">
                        <span className="text-white">白色虚线</span>为 AI 推荐位，
                        <span className="text-white opacity-50">半透明色块</span>为当前落点。
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
};

export default TetrisBoard;
