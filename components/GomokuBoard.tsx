import React from 'react';
import { Player, Hex } from '../types';
import { getGomokuId, GOMOKU_SIZE } from '../game/gomokuLogic';
import { detectOpening } from '../game/gomokuOpenings';
import { Terminal, Cpu } from 'lucide-react';

interface GomokuBoardProps {
  board: Map<string, Player>;
  onCellClick: (r: number, c: number) => void;
  lastMove: Hex | null;
  interactive: boolean;
  history: Hex[];
  aiReasoning?: string;
}

export const GomokuBoard: React.FC<GomokuBoardProps> = ({ board, onCellClick, lastMove, interactive, history, aiReasoning }) => {
  const cellSize = 30; // Mobile friendly
  const width = (GOMOKU_SIZE + 1) * cellSize;
  const height = (GOMOKU_SIZE + 1) * cellSize;
  
  // Detect Opening
  const detection = detectOpening(history);
  const openingInfo = detection?.info;

  // Star points
  const stars = [
      {r: 3, c: 3}, {r: 3, c: 11}, 
      {r: 7, c: 7}, 
      {r: 11, c: 3}, {r: 11, c: 11}
  ];

  const renderGrid = () => {
    const lines = [];
    // Horizontals
    for (let i = 0; i < GOMOKU_SIZE; i++) {
      lines.push(
        <line
          key={`h${i}`}
          x1={cellSize}
          y1={(i + 1) * cellSize}
          x2={GOMOKU_SIZE * cellSize}
          y2={(i + 1) * cellSize}
          className="stroke-black stroke-[1]"
        />
      );
    }
    // Verticals
    for (let i = 0; i < GOMOKU_SIZE; i++) {
      lines.push(
        <line
          key={`v${i}`}
          x1={(i + 1) * cellSize}
          y1={cellSize}
          x2={(i + 1) * cellSize}
          y2={GOMOKU_SIZE * cellSize}
          className="stroke-black stroke-[1]"
        />
      );
    }
    return lines;
  };

  const renderStars = () => {
      return stars.map((s, i) => (
          <circle 
            key={i}
            cx={(s.c + 1) * cellSize}
            cy={(s.r + 1) * cellSize}
            r={3}
            className="fill-black"
          />
      ));
  };

  const renderStones = () => {
    const stones = [];
    board.forEach((player, key) => {
      const [r, c] = key.split(',').map(Number);
      const isLast = lastMove?.q === r && lastMove?.r === c; 
      
      stones.push(
        <g key={key}>
            <circle
            cx={(c + 1) * cellSize}
            cy={(r + 1) * cellSize}
            r={cellSize * 0.42}
            className={`${player === Player.Black ? 'fill-black' : 'fill-white'} shadow-lg drop-shadow-md`}
            />
            <circle
            cx={(c + 1) * cellSize - cellSize*0.1}
            cy={(r + 1) * cellSize - cellSize*0.1}
            r={cellSize * 0.15}
            className="fill-white opacity-20"
            />
            {isLast && (
                 <circle
                    cx={(c + 1) * cellSize}
                    cy={(r + 1) * cellSize}
                    r={cellSize * 0.1}
                    className="fill-red-500 animate-pulse"
                />
            )}
        </g>
      );
    });
    return stones;
  };

  const renderInteractions = () => {
      const hits = [];
      for(let r=0; r<GOMOKU_SIZE; r++){
          for(let c=0; c<GOMOKU_SIZE; c++){
             hits.push(
                 <rect
                    key={`${r},${c}`}
                    x={(c + 0.5) * cellSize}
                    y={(r + 0.5) * cellSize}
                    width={cellSize}
                    height={cellSize}
                    fill="transparent"
                    className="cursor-pointer hover:bg-black/10 rounded-full"
                    onClick={() => interactive && !board.has(getGomokuId(r,c)) && onCellClick(r,c)}
                 />
             ); 
          }
      }
      return hits;
  };

  return (
    <div className="flex flex-col items-center gap-6">
        <div className="relative bg-[#e3c188] shadow-2xl rounded p-4 border-4 border-[#8b5a2b]">
        <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width + cellSize} ${height + cellSize}`}
            className="select-none"
        >
            <filter id="wood" x="0" y="0" width="100%" height="100%">
               <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" result="noise" />
               <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.4 0" />
               <feBlend in="SourceGraphic" mode="multiply" />
            </filter>
            
            <rect x={cellSize/2} y={cellSize/2} width={width} height={height} fill="transparent" />
            
            {renderGrid()}
            {renderStars()}
            {renderStones()}
            {renderInteractions()}
            
            {/* Labels */}
            {Array.from({length: GOMOKU_SIZE}).map((_, i) => (
                <text key={`l${i}`} x={cellSize/2} y={(i+1)*cellSize} className="text-[10px] fill-black/60" dominantBaseline="middle" textAnchor="end">{i+1}</text>
            ))}
            {Array.from({length: GOMOKU_SIZE}).map((_, i) => (
                <text key={`b${i}`} x={(i+1)*cellSize} y={height + cellSize/2} className="text-[10px] fill-black/60" dominantBaseline="hanging" textAnchor="middle">{String.fromCharCode(65+i)}</text>
            ))}
        </svg>
        </div>

        {/* AI Logic Terminal Panel */}
        <div className="w-full max-w-md bg-[#0f172a] border border-gray-700 rounded-xl p-0 shadow-lg min-h-[160px] overflow-hidden flex flex-col">
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#1e293b] border-b border-gray-700">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-green-400" />
                    <span className="text-xs font-mono font-bold text-gray-300">AI_LOGIC_CORE.EXE</span>
                </div>
                {openingInfo && (
                    <span className="text-[10px] bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                        {openingInfo.name}
                    </span>
                )}
            </div>
            
            {/* Terminal Body */}
            <div className="p-4 font-mono text-xs leading-relaxed text-gray-300 overflow-y-auto flex-1">
                {aiReasoning ? (
                    <div className="space-y-1 animate-fadeIn">
                        {aiReasoning.split('\n').map((line, i) => (
                            <div key={i} className={`${line.startsWith('>') ? 'text-green-400/90' : 'text-gray-400 pl-4'}`}>
                                {line}
                            </div>
                        ))}
                         <div className="mt-2 flex items-center gap-2 text-gray-500">
                             <span className="animate-pulse">_</span>
                         </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2 opacity-50">
                        <Cpu className="w-8 h-8" />
                        <p>等待系统初始化...</p>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};