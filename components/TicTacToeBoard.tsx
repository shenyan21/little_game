import React from 'react';
import { Player, Hex } from '../types';
import { getTTTId, checkTTTWin } from '../game/tictactoeLogic';
import { X, Circle } from 'lucide-react';

interface TicTacToeBoardProps {
  board: Map<string, Player>;
  onCellClick: (row: number, col: number) => void;
  lastMove: Hex | null;
  interactive: boolean;
}

export const TicTacToeBoard: React.FC<TicTacToeBoardProps> = ({ board, onCellClick, lastMove, interactive }) => {
  const winInfo = checkTTTWin(board);
  const winLine = winInfo.line || [];

  const renderCell = (r: number, c: number) => {
    const id = getTTTId(r, c);
    const owner = board.get(id);
    const isWinCell = winLine.includes(id);
    const isLast = lastMove?.q === r && lastMove?.r === c;

    return (
      <button
        key={id}
        onClick={() => onCellClick(r, c)}
        disabled={!interactive || owner !== undefined}
        className={`
          w-24 h-24 sm:w-32 sm:h-32 bg-[#2a2a2a] rounded-xl flex items-center justify-center
          transition-all duration-200 border-2
          ${owner === undefined && interactive ? 'hover:bg-[#333] hover:border-gray-600 cursor-pointer' : ''}
          ${isWinCell ? 'border-amber-500 bg-amber-900/20 shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'border-gray-700'}
          ${!isWinCell && isLast ? 'border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.3)]' : ''}
        `}
      >
        {owner === Player.Black && (
          <X 
            className={`w-12 h-12 sm:w-16 sm:h-16 text-blue-400 ${isLast || isWinCell ? 'animate-pulse' : ''}`} 
            strokeWidth={2.5}
          />
        )}
        {owner === Player.White && (
          <Circle 
            className={`w-10 h-10 sm:w-14 sm:h-14 text-rose-400 ${isLast || isWinCell ? 'animate-pulse' : ''}`} 
            strokeWidth={2.5}
          />
        )}
      </button>
    );
  };

  return (
    <div className="p-8 bg-[#1e1e1e] rounded-2xl shadow-2xl border border-gray-800">
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[0, 1, 2].map(r => 
          [0, 1, 2].map(c => renderCell(r, c))
        )}
      </div>
    </div>
  );
};