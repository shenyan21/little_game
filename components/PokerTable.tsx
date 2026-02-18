import React from 'react';
import { PokerPlayer, Card, GamePhase } from '../game/pokerTypes';
import CardDisplay from './CardDisplay';
import { User, Bot, Coins } from 'lucide-react';

interface PokerTableProps {
  players: PokerPlayer[];
  userCards: Card[];
  communityCards: Card[];
  currentTurnIndex: number;
  phase: GamePhase;
  pot: number;
}

const PokerTable: React.FC<PokerTableProps> = ({ 
  players, 
  userCards, 
  communityCards, 
  currentTurnIndex,
  phase,
  pot
}) => {
  
  const activeCommunityCards = Array(5).fill(null).map((_, i) => communityCards[i] || null);

  const getPhaseNameCN = (p: GamePhase) => {
    switch(p) {
        case GamePhase.PRE_FLOP: return '翻牌前 (Pre-Flop)';
        case GamePhase.FLOP: return '翻牌圈 (Flop)';
        case GamePhase.TURN: return '转牌圈 (Turn)';
        case GamePhase.RIVER: return '河牌圈 (River)';
        case GamePhase.SHOWDOWN: return '摊牌 (Showdown)';
        default: return p;
    }
  }

  return (
    <div className="relative w-full max-w-5xl mx-auto min-h-[500px] aspect-[3/4] md:aspect-[2/1] bg-poker-green rounded-[50px] md:rounded-[100px] border-[16px] border-poker-felt shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] flex flex-col items-center justify-between p-4 md:p-8">
      
      {/* Top Section: Opponents */}
      <div className="flex-1 w-full flex items-start justify-center pt-4 z-10">
        <div className="flex flex-wrap justify-center gap-4 md:gap-8">
            {players.filter(p => !p.isUser).map((player) => (
            <PlayerBadge 
                key={player.id} 
                player={player} 
                isCurrentTurn={player.id === players[currentTurnIndex]?.id} 
            />
            ))}
        </div>
      </div>

      {/* Middle Section: Community Cards & Pot */}
      <div className="shrink-0 my-4 z-0 relative flex flex-col items-center justify-center w-full">
        <div className="bg-black/20 rounded-xl p-4 backdrop-blur-sm border border-white/10 shadow-lg mb-2">
            <div className="flex justify-center gap-2 md:gap-4 min-h-[64px] md:min-h-[96px]">
            {activeCommunityCards.map((card, i) => (
                <div key={i} className={`transition-opacity duration-500 ${card ? 'opacity-100' : 'opacity-30'}`}>
                   {card ? <CardDisplay card={card} size="md" /> : <CardDisplay hidden size="md" />}
                </div>
            ))}
            </div>
        </div>
        
        {/* Pot Display */}
        <div className="flex flex-col items-center justify-center bg-black/40 px-6 py-2 rounded-full border-2 border-amber-500/50 backdrop-blur-md">
            <div className="text-poker-gold font-bold uppercase tracking-wider text-xs md:text-sm mb-1">
                {getPhaseNameCN(phase)}
            </div>
            <div className="flex items-center gap-2 text-white font-bold text-xl">
                <Coins className="text-amber-400 fill-amber-400" size={20} />
                <span>底池: {pot}</span>
            </div>
        </div>
      </div>

      {/* Bottom Section: Hero */}
      <div className="flex-1 w-full flex items-end justify-center pb-4 z-10">
        {players.filter(p => p.isUser).map((player) => (
          <div key={player.id} className="flex items-center gap-6 md:gap-12 bg-black/20 p-4 rounded-3xl border border-white/5 backdrop-blur-sm">
             {/* Left: Player Badge */}
             <PlayerBadge 
                player={player} 
                isCurrentTurn={player.id === players[currentTurnIndex]?.id}
                isHero
             />
             
             {/* Right: Hero Cards */}
             <div className="flex gap-2">
                {userCards.map(card => (
                    <CardDisplay key={card.id} card={card} size="lg" className="shadow-2xl ring-4 ring-black/20 transform hover:-translate-y-2 transition-transform" />
                ))}
                {userCards.length === 0 && (
                    <div className="flex items-center justify-center w-24 h-36 text-white/40 text-xs italic bg-black/10 rounded border border-white/10 border-dashed">
                        等待手牌
                    </div>
                )}
             </div>
          </div>
        ))}
      </div>

    </div>
  );
};

const PlayerBadge: React.FC<{ player: PokerPlayer; isCurrentTurn: boolean; isHero?: boolean }> = ({ player, isCurrentTurn, isHero }) => {
  return (
    <div className={`
      relative flex flex-col items-center justify-center w-20 h-20 md:w-28 md:h-28 rounded-full border-4 shadow-xl transition-all duration-300
      ${player.isActive ? 'bg-slate-800' : 'bg-slate-900 opacity-60 grayscale'}
      ${isCurrentTurn ? 'border-amber-400 ring-4 ring-amber-400/30 scale-110 z-20' : 'border-slate-600'}
    `}>
      <div className={`
        absolute -top-3 px-2 py-0.5 rounded-full text-[10px] md:text-xs font-bold uppercase tracking-wider whitespace-nowrap z-30
        ${isHero ? 'bg-indigo-600 text-white' : 'bg-slate-600 text-slate-200'}
      `}>
        {player.positionName}
      </div>
      
      {isHero ? <User className="text-indigo-400 w-6 h-6 md:w-8 md:h-8" /> : <Bot className="text-slate-400 w-6 h-6 md:w-8 md:h-8" />}
      
      {/* Name and Stack */}
      <div className="flex flex-col items-center max-w-[90%]">
          <div className="mt-1 text-[10px] md:text-xs font-semibold text-white truncate w-full text-center">
            {isHero ? '我' : `对手 ${player.id}`}
          </div>
          <div className="text-[10px] md:text-xs font-mono text-amber-300 flex items-center gap-0.5">
             <Coins size={10} /> {player.chips}
          </div>
      </div>

      {player.isDealer && (
         <div className="absolute -right-1 top-0 bg-white text-black rounded-full w-5 h-5 md:w-6 md:h-6 flex items-center justify-center font-bold text-xs border-2 border-slate-300 shadow-sm z-30" title="庄家">
            庄
         </div>
      )}

      {/* Current Bet Display */}
      {player.roundBet > 0 && player.isActive && (
          <div className="absolute -bottom-8 bg-black/60 text-white px-2 py-1 rounded-md text-xs border border-amber-500/50 flex items-center gap-1 z-40 whitespace-nowrap">
              <Coins size={10} className="text-amber-400" />
              {player.roundBet}
          </div>
      )}

      {!player.isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full z-20">
              <span className="text-white font-bold text-xs">弃牌</span>
          </div>
      )}
    </div>
  );
};

export default PokerTable;