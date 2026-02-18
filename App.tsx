import React, { useState, useEffect, useCallback } from 'react';
import { HexBoard } from './components/HexBoard';
import { TicTacToeBoard } from './components/TicTacToeBoard';
import { GomokuBoard } from './components/GomokuBoard';
import PokerGame from './components/PokerGame';
import TetrisBoard from './components/TetrisBoard';
import { GameState, Player, BOARD_SIZE, Hex } from './types';
import { checkWin, getHexId } from './game/logic';
import { findBestMove } from './game/ai';
import { checkTTTWin, getTTTId, isTTTFull } from './game/tictactoeLogic';
import { findBestTTTMove } from './game/tictactoeAi';
import { checkGomokuWin, getGomokuId, GOMOKU_SIZE } from './game/gomokuLogic';
import { findBestGomokuMove } from './game/gomokuAi';
import { Crown, RefreshCw, User, Bot, BrainCircuit, Hexagon, Grid3x3, LayoutGrid, CircleDot, Club, Cuboid } from 'lucide-react';

const INITIAL_STATE: GameState = {
  board: new Map(),
  currentPlayer: Player.Black, // Black always starts
  winner: null,
  boardSize: BOARD_SIZE,
  history: [],
  gameMode: 'PvAI',
  aiPlayer: Player.Black, // Default to AI playing Black (First)
};

export default function App() {
  const [gameState, setGameState] = useState<GameState>(INITIAL_STATE);
  const [isThinking, setIsThinking] = useState(false);
  const [aiFirst, setAiFirst] = useState(true);
  const [selectedGame, setSelectedGame] = useState<'tictactoe' | 'hex' | 'gomoku' | 'poker' | 'tetris'>('tictactoe');
  const [aiReasoning, setAiReasoning] = useState<string>("");

  // Sound effects
  const playSound = (type: 'place' | 'win' | 'draw') => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'place') {
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else if (type === 'win') {
        osc.frequency.setValueAtTime(300, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else {
        // Draw sound
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      // Ignore audio errors
    }
  };

  const resetGame = (mode: 'PvP' | 'PvAI', aiStarts: boolean, game: 'tictactoe' | 'hex' | 'gomoku' | 'poker' | 'tetris' = selectedGame) => {
    if (game === 'poker' || game === 'tetris') {
      // Poker and Tetris handle their own reset logic internally
      return;
    }

    setGameState({
      ...INITIAL_STATE,
      board: new Map(),
      gameMode: mode,
      aiPlayer: mode === 'PvAI' ? (aiStarts ? Player.Black : Player.White) : null,
      currentPlayer: Player.Black,
      boardSize: game === 'hex' ? BOARD_SIZE : (game === 'gomoku' ? GOMOKU_SIZE : 3), 
    });
    setAiFirst(aiStarts);
    setIsThinking(false);
    setAiReasoning(""); // Clear log
  };

  // Handle Game Switch
  useEffect(() => {
    if (selectedGame !== 'poker' && selectedGame !== 'tetris') {
      resetGame(gameState.gameMode, aiFirst, selectedGame);
    }
  }, [selectedGame]);

  const handleCellClick = useCallback((q: number, r: number) => {
    if (gameState.winner || isThinking) return;

    // Check if valid turn for human
    if (gameState.gameMode === 'PvAI' && gameState.currentPlayer === gameState.aiPlayer) return;

    // Validation depends on game
    let id;
    if (selectedGame === 'hex') id = getHexId(q, r);
    else if (selectedGame === 'tictactoe') id = getTTTId(q, r);
    else if (selectedGame === 'gomoku') id = getGomokuId(q, r);
    else return; // Poker/Tetris handled elsewhere

    if (gameState.board.has(id)) return;

    makeMove({ q, r });
  }, [gameState, isThinking, selectedGame]);

  const makeMove = (hex: Hex) => {
    const newBoard = new Map(gameState.board);
    let id;
    if (selectedGame === 'hex') id = getHexId(hex.q, hex.r);
    else if (selectedGame === 'tictactoe') id = getTTTId(hex.q, hex.r);
    else id = getGomokuId(hex.q, hex.r);

    newBoard.set(id, gameState.currentPlayer);

    let hasWon = null;
    let isDraw = false;

    if (selectedGame === 'hex') {
      if (checkWin(newBoard, gameState.currentPlayer)) hasWon = gameState.currentPlayer;
    } else if (selectedGame === 'tictactoe') {
      const result = checkTTTWin(newBoard);
      hasWon = result.winner;
      isDraw = !hasWon && isTTTFull(newBoard);
    } else if (selectedGame === 'gomoku') {
      hasWon = checkGomokuWin(newBoard, {r: hex.q, c: hex.r}); // In Gomoku logic r is row(q), c is col(r)
      if (!hasWon && newBoard.size === GOMOKU_SIZE * GOMOKU_SIZE) isDraw = true;
    }
    
    if (hasWon) playSound('win');
    else if (isDraw) playSound('draw');
    else playSound('place');

    setGameState(prev => ({
      ...prev,
      board: newBoard,
      history: [...prev.history, hex],
      winner: hasWon ? prev.currentPlayer : (isDraw ? Player.None : null), 
      currentPlayer: (hasWon || isDraw) ? prev.currentPlayer : (prev.currentPlayer === Player.Black ? Player.White : Player.Black),
    }));
  };

  // AI Turn Effect
  useEffect(() => {
    if (selectedGame === 'poker' || selectedGame === 'tetris') return;

    const isDraw = (selectedGame === 'tictactoe' && !gameState.winner && isTTTFull(gameState.board)) ||
                   (selectedGame === 'gomoku' && !gameState.winner && gameState.board.size === GOMOKU_SIZE*GOMOKU_SIZE);

    if (
      gameState.gameMode === 'PvAI' &&
      !gameState.winner &&
      !isDraw &&
      gameState.currentPlayer === gameState.aiPlayer
    ) {
      setIsThinking(true);
      const timer = setTimeout(() => {
        let bestMove: Hex | null = null;
        
        if (selectedGame === 'hex') {
           bestMove = findBestMove(gameState.board, gameState.aiPlayer!, gameState.boardSize);
        } else if (selectedGame === 'tictactoe') {
           bestMove = findBestTTTMove(gameState.board, gameState.aiPlayer!);
        } else if (selectedGame === 'gomoku') {
           const result = findBestGomokuMove(gameState.board, gameState.aiPlayer!);
           bestMove = result.move;
           setAiReasoning(result.reasoning);
        }

        if (bestMove) {
          makeMove(bestMove);
        }
        setIsThinking(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gameState.currentPlayer, gameState.gameMode, gameState.winner, gameState.aiPlayer, gameState.board, selectedGame]);

  const lastMove = gameState.history.length > 0 ? gameState.history[gameState.history.length - 1] : null;

  const isDraw = gameState.winner === Player.None;
  const gameEnded = !!gameState.winner || isDraw;

  return (
    <div className="flex min-h-screen bg-[#1a1a1a] text-gray-200 font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 bg-[#252525] border-r border-gray-800 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-bold text-amber-500 flex items-center gap-2">
            <LayoutGrid className="w-6 h-6" />
            游戏大厅
          </h2>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {/* Order: TicTacToe -> Hex -> Gomoku -> Poker -> Tetris */}
          <button 
            onClick={() => setSelectedGame('tictactoe')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${selectedGame === 'tictactoe' ? 'bg-amber-600/20 text-amber-500 border border-amber-600/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
          >
            <Grid3x3 className="w-5 h-5" />
            <span className="font-medium">井字棋 (Tic-Tac-Toe)</span>
          </button>
          <button 
            onClick={() => setSelectedGame('hex')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${selectedGame === 'hex' ? 'bg-amber-600/20 text-amber-500 border border-amber-600/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
          >
            <Hexagon className="w-5 h-5" />
            <span className="font-medium">六贯棋 (Hex)</span>
          </button>
          <button 
            onClick={() => setSelectedGame('gomoku')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${selectedGame === 'gomoku' ? 'bg-amber-600/20 text-amber-500 border border-amber-600/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
          >
            <CircleDot className="w-5 h-5" />
            <span className="font-medium">五子棋 (Gomoku)</span>
          </button>
          <button 
            onClick={() => setSelectedGame('poker')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${selectedGame === 'poker' ? 'bg-amber-600/20 text-amber-500 border border-amber-600/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
          >
            <Club className="w-5 h-5" />
            <span className="font-medium">德州扑克 (Poker)</span>
          </button>
          <button 
            onClick={() => setSelectedGame('tetris')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${selectedGame === 'tetris' ? 'bg-amber-600/20 text-amber-500 border border-amber-600/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
          >
            <Cuboid className="w-5 h-5" />
            <span className="font-medium">俄罗斯方块 (Tetris)</span>
          </button>
        </nav>
        
        <div className="p-4 text-xs text-center text-gray-600 border-t border-gray-800">
          v1.4.0 Beta
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Header */}
        <header className="py-4 border-b border-gray-800 bg-[#1e1e1e] flex-shrink-0">
          <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BrainCircuit className="w-8 h-8 text-amber-500" />
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-white">
                  {selectedGame === 'hex' ? '六贯棋 (Master Hex)' : 
                   (selectedGame === 'tictactoe' ? '井字棋 (Tic-Tac-Toe)' : 
                   (selectedGame === 'gomoku' ? '五子棋 (Renju/Gomoku)' : 
                   (selectedGame === 'tetris' ? '俄罗斯方块 (Tetris 3D)' : 'PokerMind AI 教练')))}
                </h1>
                <p className="text-gray-400 text-xs hidden sm:block">
                  {selectedGame === 'hex' ? '黑方连接左右，白方连接上下。' : 
                   (selectedGame === 'tictactoe' ? '三个连成一线即可获胜。' : 
                   (selectedGame === 'gomoku' ? '五子连珠，AI执黑必胜定式。' : 
                   (selectedGame === 'tetris' ? 'WASD 控制。A/D移动，W旋转，S加速。' : 'GTO 策略辅助与实战模拟。')))}
                </p>
              </div>
            </div>
            
            {/* Status Badge (Hide for Poker/Tetris as they have internal status) */}
            {selectedGame !== 'poker' && selectedGame !== 'tetris' && (
              gameEnded ? (
                <div className={`px-4 py-1.5 border rounded-full flex items-center gap-2 ${gameState.winner ? 'bg-yellow-900/30 border-yellow-600/50' : 'bg-gray-700 border-gray-500'}`}>
                  {gameState.winner ? <Crown className="w-4 h-4 text-yellow-500" /> : <div className="w-4 h-4 bg-gray-400 rounded-full" />}
                  <span className={`${gameState.winner ? 'text-yellow-500' : 'text-gray-300'} font-bold text-sm`}>
                    {gameState.winner ? '游戏结束' : '平局'}
                  </span>
                </div>
              ) : (
                <div className="px-4 py-1.5 bg-gray-800 rounded-full border border-gray-700 flex items-center gap-2">
                  {selectedGame === 'hex' ? (
                    <div className={`w-2.5 h-2.5 rounded-full ${gameState.currentPlayer === Player.Black ? 'bg-black ring-1 ring-gray-500' : 'bg-white'}`} />
                  ) : (
                    <span className={`text-xs font-bold ${gameState.currentPlayer === Player.Black ? 'text-blue-400' : (selectedGame === 'gomoku' ? 'text-white' : 'text-rose-400')}`}>
                        {gameState.currentPlayer === Player.Black ? (selectedGame === 'gomoku' ? '●' : 'X') : (selectedGame === 'gomoku' ? '○' : 'O')}
                    </span>
                  )}
                  <span className="text-xs text-gray-300">
                    当前: {gameState.currentPlayer === Player.Black ? (selectedGame === 'hex' ? '黑方' : (selectedGame === 'gomoku' ? '黑方 (先)' : '先手 (X)')) : (selectedGame === 'hex' ? '白方' : (selectedGame === 'gomoku' ? '白方 (后)' : '后手 (O)'))}
                  </span>
                </div>
              )
            )}
          </div>
        </header>

        {/* Scrollable Game Area */}
        {selectedGame === 'poker' ? (
           <PokerGame />
        ) : selectedGame === 'tetris' ? (
           <TetrisBoard />
        ) : (
          <div className="flex-1 overflow-auto bg-[#1a1a1a]">
            <div className="min-h-full flex flex-col xl:flex-row items-center xl:items-start justify-center p-6 gap-8">
              
              {/* Game Board */}
              <div className="flex-1 flex justify-center items-center w-full min-h-[400px]">
                {selectedGame === 'hex' && (
                  <HexBoard 
                    board={gameState.board} 
                    onCellClick={handleCellClick} 
                    lastMove={lastMove}
                    interactive={!gameEnded}
                  />
                )}
                {selectedGame === 'tictactoe' && (
                  <TicTacToeBoard
                    board={gameState.board}
                    onCellClick={handleCellClick}
                    lastMove={lastMove}
                    interactive={!gameEnded}
                  />
                )}
                {selectedGame === 'gomoku' && (
                  <GomokuBoard
                    board={gameState.board}
                    onCellClick={handleCellClick}
                    lastMove={lastMove}
                    interactive={!gameEnded}
                    history={gameState.history}
                    aiReasoning={aiReasoning}
                  />
                )}
              </div>

              {/* Controls Panel */}
              <div className="bg-[#2a2a2a] p-6 rounded-xl shadow-2xl border border-gray-700 w-full max-w-xs space-y-6 flex-shrink-0 xl:sticky xl:top-6">
                
                {/* Status Display */}
                <div className="text-center p-4 bg-[#1e1e1e] rounded-lg border border-gray-800">
                  {gameEnded ? (
                    <div className="flex flex-col items-center animate-bounce">
                      {gameState.winner ? <Crown className="w-12 h-12 text-yellow-500 mb-2" /> : <div className="text-4xl mb-2">🤝</div>}
                      <span className="text-xl font-bold text-white">
                        {gameState.winner 
                          ? (gameState.winner === Player.Black ? (selectedGame === 'hex' ? '黑方获胜！' : (selectedGame === 'gomoku' ? '黑方获胜！' : 'X 方获胜！')) : (selectedGame === 'hex' ? '白方获胜！' : (selectedGame === 'gomoku' ? '白方获胜！' : 'O 方获胜！')))
                          : '平局！'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <span className="text-gray-400 text-xs uppercase tracking-widest mb-1">当前回合</span>
                      <div className="flex items-center gap-3">
                        {selectedGame === 'hex' ? (
                          <div className={`w-4 h-4 rounded-full ${gameState.currentPlayer === Player.Black ? 'bg-black ring-2 ring-gray-500' : 'bg-white'}`} />
                        ) : (
                          <span className={`text-2xl font-black ${gameState.currentPlayer === Player.Black ? 'text-blue-400' : (selectedGame === 'gomoku' ? 'text-white' : 'text-rose-400')}`}>
                            {gameState.currentPlayer === Player.Black ? (selectedGame === 'gomoku' ? '●' : 'X') : (selectedGame === 'gomoku' ? '○' : 'O')}
                          </span>
                        )}
                        <span className="text-2xl font-bold">
                          {gameState.currentPlayer === Player.Black ? (selectedGame === 'hex' ? '黑方' : (selectedGame === 'gomoku' ? '黑方' : 'Player X')) : (selectedGame === 'hex' ? '白方' : (selectedGame === 'gomoku' ? '白方' : 'Player O'))}
                        </span>
                      </div>
                      {isThinking && <span className="text-amber-500 text-sm mt-2 animate-pulse">AI 正在思考...</span>}
                    </div>
                  )}
                </div>

                {/* Game Mode Selection */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">新游戏设置</h3>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => resetGame('PvP', false, selectedGame)}
                      className={`p-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm ${gameState.gameMode === 'PvP' ? 'bg-amber-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                      <User className="w-4 h-4" /> 双人对战
                    </button>
                    <button
                      onClick={() => resetGame('PvAI', aiFirst, selectedGame)}
                      className={`p-3 rounded-lg flex items-center justify-center gap-2 font-medium transition-colors text-sm ${gameState.gameMode === 'PvAI' ? 'bg-amber-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                    >
                      <Bot className="w-4 h-4" /> 人机对战
                    </button>
                  </div>

                  {gameState.gameMode === 'PvAI' && (
                    <div className="bg-gray-800/50 p-3 rounded-lg mt-2">
                      <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-300">AI 顺序</span>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button 
                          onClick={() => resetGame('PvAI', true, selectedGame)}
                          className={`w-full text-left text-xs py-2 px-3 rounded border flex items-center justify-between ${aiFirst ? 'bg-amber-900/40 border-amber-500 text-amber-200' : 'border-gray-600 text-gray-400 hover:bg-gray-700'}`}
                        >
                          <span>AI 先手 (执{selectedGame === 'hex' ? '黑' : (selectedGame === 'gomoku' ? '黑' : 'X')})</span>
                          <span className="text-[10px] opacity-70 bg-black/30 px-1 rounded">必胜策略</span>
                        </button>
                        <button 
                          onClick={() => resetGame('PvAI', false, selectedGame)}
                          className={`w-full text-left text-xs py-2 px-3 rounded border flex items-center justify-between ${!aiFirst ? 'bg-amber-900/40 border-amber-500 text-amber-200' : 'border-gray-600 text-gray-400 hover:bg-gray-700'}`}
                        >
                          <span>AI 后手 (执{selectedGame === 'hex' ? '白' : (selectedGame === 'gomoku' ? '白' : 'O')})</span>
                          <span className="text-[10px] opacity-70 bg-black/30 px-1 rounded">挑战模式</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => resetGame(gameState.gameMode, gameState.gameMode === 'PvAI' ? aiFirst : false, selectedGame)}
                  className="w-full py-4 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all"
                >
                  <RefreshCw className="w-5 h-5" />
                  重新开始
                </button>
              </div>
              
            </div>
          </div>
        )}
      </main>
    </div>
  );
}