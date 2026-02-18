import React, { useState, useEffect } from 'react';
import { 
  PokerGameState, 
  GamePhase, 
  PokerPlayer, 
  Card, 
  PlayerActionType, 
  PlayerAction, 
  Suit
} from '../game/pokerTypes';
import { getPositionName } from '../game/pokerConstants';
import CardSelector from './CardSelector';
import PokerTable from './PokerTable';
import { getStrategicAdvice } from '../services/geminiService';
import { Play, RotateCcw, BrainCircuit, X, Trophy, HandCoins, LogOut } from 'lucide-react';

const INITIAL_STACK = 1000;
const SB_AMOUNT = 5;
const BB_AMOUNT = 10;

const PokerGame: React.FC = () => {
  // --- Setup State ---
  const [playerCount, setPlayerCount] = useState<number>(6);
  const [heroPosition, setHeroPosition] = useState<number>(0); // 0-indexed relative to BTN
  const [setupCards, setSetupCards] = useState<Card[]>([]);
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [winnerMessage, setWinnerMessage] = useState<string | null>(null);

  // Persistence State
  const [savedStacks, setSavedStacks] = useState<number[] | null>(null);

  // --- Game State ---
  const [gameState, setGameState] = useState<PokerGameState>({
    playerCount: 6,
    userPosition: 0,
    players: [],
    userCards: [],
    communityCards: [],
    phase: GamePhase.SETUP,
    actionLog: [],
    currentTurnIndex: 0,
    dealerIndex: 0,
    pot: 0,
    currentHighBet: 0,
    minRaise: BB_AMOUNT,
  });

  // --- UI State ---
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [cardSelectorCallback, setCardSelectorCallback] = useState<((card: Card) => void) | null>(null);
  const [selectorTitle, setSelectorTitle] = useState('');
  const [selectorLimit, setSelectorLimit] = useState(1);
  const [tempSelectedCards, setTempSelectedCards] = useState<Card[]>([]);
  
  // Betting UI
  const [raiseAmountInput, setRaiseAmountInput] = useState<string>('');
  const [showRaiseInput, setShowRaiseInput] = useState(false);

  // --- AI State ---
  const [aiAdvice, setAiAdvice] = useState<string>('');
  const [isThinking, setIsThinking] = useState(false);

  // --- Initialization ---

  const initGame = () => {
    // 1. Create Players with stacks
    const newPlayers: PokerPlayer[] = [];
    for (let i = 0; i < playerCount; i++) {
        // Use saved stack if available, else default. Auto-rebuy if 0.
        let startingChips = INITIAL_STACK;
        if (savedStacks && savedStacks.length === playerCount) {
             startingChips = savedStacks[i] > 0 ? savedStacks[i] : INITIAL_STACK;
        }

        newPlayers.push({
            id: i,
            positionName: getPositionName(i, playerCount, 0),
            isUser: i === heroPosition,
            isActive: true,
            isDealer: i === 0,
            chips: startingChips,
            roundBet: 0
        });
    }

    // 2. Identify Blinds
    // Heads up (2 players): Dealer is SB(0), Other is BB(1).
    // >2 players: Dealer(0), SB(1), BB(2).
    let sbIndex = 1;
    let bbIndex = 2;
    if (playerCount === 2) {
        sbIndex = 0;
        bbIndex = 1;
    } else {
        sbIndex = 1 % playerCount;
        bbIndex = 2 % playerCount;
    }

    // 3. Post Blinds
    // Handle short stacks (though unlikely with auto-rebuy logic above)
    const sbPost = Math.min(newPlayers[sbIndex].chips, SB_AMOUNT);
    newPlayers[sbIndex].chips -= sbPost;
    newPlayers[sbIndex].roundBet = sbPost;
    
    const bbPost = Math.min(newPlayers[bbIndex].chips, BB_AMOUNT);
    newPlayers[bbIndex].chips -= bbPost;
    newPlayers[bbIndex].roundBet = bbPost;

    // 4. Determine Action Start (UTG)
    // Heads up: Dealer(SB) acts first pre-flop.
    // >2 players: UTG (BB+1) acts first.
    let firstActorIndex = (bbIndex + 1) % playerCount;
    if (playerCount === 2) firstActorIndex = 0; // Dealer acts first in heads up preflop

    setGameState({
        playerCount,
        userPosition: heroPosition,
        players: newPlayers,
        userCards: setupCards,
        communityCards: [],
        phase: GamePhase.PRE_FLOP,
        actionLog: [],
        currentTurnIndex: firstActorIndex,
        dealerIndex: 0,
        pot: 0, 
        currentHighBet: BB_AMOUNT,
        minRaise: BB_AMOUNT
    });
    setIsGameStarted(true);
    setAiAdvice('');
    setWinnerMessage(null);
    setRaiseAmountInput((BB_AMOUNT * 2).toString());
  };

  // --- Rules Logic ---

  const isCheckLegal = (state: PokerGameState): boolean => {
      const currentPlayer = state.players[state.currentTurnIndex];
      // Can check if your current bet matches the table's high bet
      return currentPlayer.roundBet === state.currentHighBet;
  };

  const getCallAmount = (state: PokerGameState): number => {
      const currentPlayer = state.players[state.currentTurnIndex];
      return state.currentHighBet - currentPlayer.roundBet;
  };

  // --- Actions ---

  const handlePlayerAction = (type: PlayerActionType, specifiedAmount?: number) => {
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    let newPlayers = [...gameState.players];
    let p = { ...newPlayers[gameState.currentTurnIndex] };
    
    let betDelta = 0;
    let newHighBet = gameState.currentHighBet;
    
    // Process Chips & Betting Logic
    if (type === PlayerActionType.FOLD) {
        p.isActive = false;
    } else if (type === PlayerActionType.CHECK) {
        // No chips changed
    } else if (type === PlayerActionType.CALL) {
        const callAmt = gameState.currentHighBet - p.roundBet;
        // Check if player has enough (All-in logic simplified)
        const actualCall = Math.min(callAmt, p.chips);
        p.chips -= actualCall;
        p.roundBet += actualCall;
        betDelta = actualCall;
    } else if (type === PlayerActionType.RAISE) {
        // 'specifiedAmount' is the TOTAL amount player wants to bet (e.g., raise to 30)
        // or delta? Let's assume input is "Total Bet Amount" for simplicity in UI prompt
        if (!specifiedAmount) return; // Error
        
        const delta = specifiedAmount - p.roundBet;
        if (delta > p.chips) {
             alert("筹码不足！");
             return; 
        }
        
        p.chips -= delta;
        p.roundBet = specifiedAmount;
        betDelta = delta;
        newHighBet = specifiedAmount;
    }

    newPlayers[gameState.currentTurnIndex] = p;

    // Record Action
    const newAction: PlayerAction = {
        playerId: p.id,
        type,
        amount: betDelta,
        totalBet: p.roundBet,
        phase: gameState.phase
    };

    // Calculate Next Turn
    let nextIndex = (gameState.currentTurnIndex + 1) % gameState.playerCount;
    let loopCount = 0;
    while (!newPlayers[nextIndex].isActive && loopCount < gameState.playerCount) {
        nextIndex = (nextIndex + 1) % gameState.playerCount;
        loopCount++;
    }

    // Update State
    const nextState = {
        ...gameState,
        players: newPlayers,
        actionLog: [...gameState.actionLog, newAction],
        currentTurnIndex: nextIndex,
        currentHighBet: newHighBet
    };
    
    setGameState(nextState);
    setShowRaiseInput(false);
    
    // Clear AI advice if user acted
    if (p.isUser) setAiAdvice('');

    // Check Win by Fold
    const activePlayers = newPlayers.filter(pl => pl.isActive);
    if (activePlayers.length === 1) {
        handleWin(activePlayers[0]);
    }
  };

  const handleWin = (winner: PokerPlayer) => {
      // Collect all bets into pot for display
      const currentRoundPot = gameState.players.reduce((acc, p) => acc + p.roundBet, 0);
      const totalPot = gameState.pot + currentRoundPot;
      
      setWinnerMessage(`${winner.isUser ? '你' : winner.positionName} 赢得了底池 ${totalPot}!`);

      // Calculate final stacks for next hand
      const finalPlayers = gameState.players.map(p => {
          // p.chips already reflects deductions for bets.
          // We just need to add the pot to the winner.
          let endChips = p.chips; 
          if (p.id === winner.id) {
              endChips += totalPot;
          }
          return endChips;
      });
      
      // Save for next game
      setSavedStacks(finalPlayers);
      
      setTimeout(() => {
            setWinnerMessage(null);
            // Return to setup, but ready for next hand (User can click "Start Game" to use saved stacks)
            setGameState(prev => ({ ...prev, phase: GamePhase.SETUP }));
            setIsGameStarted(false);
        }, 3000);
  };

  // --- Phase Logic ---

  const advancePhase = () => {
    // 1. Move all roundBets to Pot
    // We use the current gameState to calculate this to ensure we capture the latest bets
    const roundPot = gameState.players.reduce((acc, p) => acc + p.roundBet, 0);
    const newTotalPot = gameState.pot + roundPot;

    // 2. Reset bets for next round
    const resetPlayers = gameState.players.map(p => ({ ...p, roundBet: 0 }));

    // 3. Determine Next Phase
    const nextPhaseMap: Record<GamePhase, GamePhase> = {
        [GamePhase.SETUP]: GamePhase.PRE_FLOP,
        [GamePhase.PRE_FLOP]: GamePhase.FLOP,
        [GamePhase.FLOP]: GamePhase.TURN,
        [GamePhase.TURN]: GamePhase.RIVER,
        [GamePhase.RIVER]: GamePhase.SHOWDOWN,
        [GamePhase.SHOWDOWN]: GamePhase.SETUP
    };
    const nextPhase = nextPhaseMap[gameState.phase];

    if (nextPhase === GamePhase.SETUP) {
        // Should not happen via advancePhase usually, as SHOWDOWN stops automation
        setIsGameStarted(false);
        return;
    }

    // 4. Community Cards Logic
    let cardsNeeded = 0;
    if (nextPhase === GamePhase.FLOP) cardsNeeded = 3;
    if (nextPhase === GamePhase.TURN) cardsNeeded = 1;
    if (nextPhase === GamePhase.RIVER) cardsNeeded = 1;

    // 5. Determine First Actor for Post-Flop
    // Post-flop: SB (index 1) acts first, or first active player after dealer.
    let nextActor = findFirstActiveAfterDealer(resetPlayers);

    const newStateBase = {
        ...gameState,
        players: resetPlayers,
        pot: newTotalPot, // Ensure pot accumulates
        currentHighBet: 0, // Reset bet to check
        phase: nextPhase,
        currentTurnIndex: nextActor
    };

    if (cardsNeeded > 0) {
         setGameState(newStateBase);
         
         const phaseNamesCN: Record<GamePhase, string> = {
            [GamePhase.SETUP]: '设置',
            [GamePhase.PRE_FLOP]: '翻牌前',
            [GamePhase.FLOP]: '翻牌圈',
            [GamePhase.TURN]: '转牌圈',
            [GamePhase.RIVER]: '河牌圈',
            [GamePhase.SHOWDOWN]: '摊牌',
        };
        openCardSelectorForCommunity(cardsNeeded, nextPhase, phaseNamesCN[nextPhase]);
    } else {
        setGameState(newStateBase);
    }
  };

  const findFirstActiveAfterDealer = (players: PokerPlayer[]): number => {
      // Dealer is 0. Scan 1, 2, ...
      for (let i = 1; i <= players.length; i++) {
          const idx = i % players.length;
          if (players[idx].isActive) return idx;
      }
      return 0;
  };

  // --- Strict Betting Phase Advancement ---
  const shouldAdvancePhase = (state: PokerGameState): boolean => {
      if (state.phase === GamePhase.SHOWDOWN || state.phase === GamePhase.SETUP) return false;

      const activePlayers = state.players.filter(p => p.isActive);
      if (activePlayers.length < 2) return false;

      // Condition 1: All active players must have equal bets (or be all-in - ignoring all-in side pots for now)
      // Since we don't have explicit "all-in" boolean in Player struct besides actionLog, let's assume if chips=0 they are all in.
      // But simple check: Are all active players' roundBet equal to currentHighBet?
      const allBetsEqual = activePlayers.every(p => p.roundBet === state.currentHighBet || p.chips === 0);
      
      if (!allBetsEqual) return false;

      // Condition 2: Everyone must have acted at least once in this betting level.
      // If `currentHighBet` is 0 (check down), everyone must check.
      // If `currentHighBet` > 0, everyone must have called/raised.
      // We can look at actionLog for current phase.
      const phaseActions = state.actionLog.filter(a => a.phase === state.phase);
      
      if (phaseActions.length < activePlayers.length) return false; // Impossible to finish if fewer actions than players

      // We need to ensure that after the LAST raise, everyone else has acted.
      // Find index of last raise in actionLog
      let lastAggressiveActionIndex = -1;
      for (let i = phaseActions.length - 1; i >= 0; i--) {
          if (phaseActions[i].type === PlayerActionType.RAISE || 
              (state.phase === GamePhase.PRE_FLOP && i < 2) // Blinds count as aggression essentially
             ) {
              // Note: Pre-flop blinds are set in Init, not actionLog. 
              // But RAISE actions are in log.
              if (phaseActions[i].type === PlayerActionType.RAISE) {
                  lastAggressiveActionIndex = i;
                  break;
              }
          }
      }

      // If no raises in log (post-flop check down, or pre-flop everyone calls blinds)
      if (lastAggressiveActionIndex === -1) {
          // Pre-flop: Big Blind has "Option". If everyone calls BB, BB must Check.
          if (state.phase === GamePhase.PRE_FLOP) {
              // We need to ensure BB has acted.
              // We can just count actions. 
              // If actions >= active players, and bets equal, we are good.
              // (Since bets are equal, it means BB checked or everyone matched raise).
              return phaseActions.length >= activePlayers.length;
          }
          // Post-flop: Everyone checked.
          return phaseActions.length >= activePlayers.length;
      }

      // If there was a raise:
      const actionsAfterRaise = phaseActions.slice(lastAggressiveActionIndex + 1);
      
      // Every active player (except the raiser) must be in actionsAfterRaise
      const raiserId = phaseActions[lastAggressiveActionIndex].playerId;
      const needToAct = activePlayers.filter(p => p.id !== raiserId && p.chips > 0);
      const whoActed = new Set(actionsAfterRaise.map(a => a.playerId));
      
      const allResponded = needToAct.every(p => whoActed.has(p.id));

      return allResponded;
  };

  useEffect(() => {
    if (!isGameStarted) return;
    
    if (shouldAdvancePhase(gameState)) {
        // Small delay
        const timer = setTimeout(() => {
            advancePhase();
        }, 800);
        return () => clearTimeout(timer);
    }
  }, [gameState.actionLog, gameState.players, gameState.currentHighBet]);


  // --- AI Integration ---

  const triggerAIAnalysis = async () => {
    setIsThinking(true);
    const advice = await getStrategicAdvice(gameState);
    setAiAdvice(advice);
    setIsThinking(false);
  };

  useEffect(() => {
    if (!isGameStarted) return;
    
    // Only auto-trigger AI if it's HERO's turn
    const currentPlayer = gameState.players[gameState.currentTurnIndex];
    if (currentPlayer && currentPlayer.isUser && currentPlayer.isActive) {
        // Avoid re-triggering if raise input is showing
        if (!showRaiseInput) {
            triggerAIAnalysis();
        }
    }
  }, [gameState.currentTurnIndex, isGameStarted, showRaiseInput]);


  // --- Helper Wrappers ---

  const openCardSelectorForSetup = () => {
    setSelectorTitle("选择您的手牌");
    setSelectorLimit(2);
    setTempSelectedCards([]);
    setCardSelectorCallback(() => (card: Card) => {
        setTempSelectedCards(prev => {
            const newer = [...prev, card];
            if (newer.length === 2) {
                setSetupCards(newer);
                setShowCardSelector(false);
            }
            return newer;
        });
    });
    setShowCardSelector(true);
  };

  const openCardSelectorForCommunity = (count: number, targetPhase: GamePhase, phaseNameCN: string) => {
      setSelectorTitle(`选择 ${count} 张 ${phaseNameCN} 公共牌`);
      setSelectorLimit(count);
      setTempSelectedCards([]);
      setCardSelectorCallback(() => (card: Card) => {
          setTempSelectedCards(prev => {
              const newer = [...prev, card];
              if (newer.length === count) {
                  // Actually commit cards to state
                  setGameState(old => ({
                      ...old,
                      communityCards: [...old.communityCards, ...newer],
                  }));
                  setShowCardSelector(false);
              }
              return newer;
          });
      });
      setShowCardSelector(true);
  };

  const resetToSetup = () => {
      // Hard reset to setup screen
      setGameState(prev => ({
        ...prev,
        phase: GamePhase.SETUP,
        players: [],
        communityCards: [],
        pot: 0,
        actionLog: []
      }));
      setSavedStacks(null);
      setIsGameStarted(false);
      setSetupCards([]);
      setWinnerMessage(null);
      setAiAdvice('');
  };


  // --- Render ---

  if (!isGameStarted) {
    return (
      <div className="flex-1 bg-slate-900 flex items-center justify-center p-4 font-sans h-full">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-700">
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <BrainCircuit className="text-emerald-400" />
            德扑 AI 军师
          </h1>
          <p className="text-slate-400 mb-8">配置牌桌以开始您的策略会话。</p>

          <div className="space-y-6">
            <div>
                <label className="block text-slate-300 mb-2 font-medium">玩家人数</label>
                <div className="flex gap-2 flex-wrap">
                    {[3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button 
                            key={num}
                            onClick={() => setPlayerCount(num)}
                            className={`px-4 py-2 rounded-lg font-bold transition-colors ${playerCount === num ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                        >
                            {num}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <label className="block text-slate-300 mb-2 font-medium">您的位置 (相对于庄家)</label>
                <select 
                    value={heroPosition}
                    onChange={(e) => setHeroPosition(Number(e.target.value))}
                    className="w-full bg-slate-700 text-white p-3 rounded-lg border border-slate-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                    {Array.from({ length: playerCount }).map((_, i) => (
                        <option key={i} value={i}>
                            {getPositionName(i, playerCount, 0)} {i === 0 ? '(庄家 Dealer)' : ''}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label className="block text-slate-300 mb-2 font-medium">您的手牌</label>
                {setupCards.length === 2 ? (
                    <div className="flex gap-4 items-center">
                        <div className="flex gap-2">
                           {setupCards.map(c => <div key={c.id} className="transform scale-75 origin-top-left"><CardSelectorWrapper card={c} /></div>)}
                        </div>
                        <button onClick={() => setSetupCards([])} className="text-red-400 hover:text-red-300 underline text-sm">重选</button>
                    </div>
                ) : (
                    <button 
                        onClick={openCardSelectorForSetup}
                        className="w-full py-4 border-2 border-dashed border-slate-600 rounded-lg text-slate-500 hover:border-emerald-500 hover:text-emerald-500 transition-all flex items-center justify-center gap-2"
                    >
                        <span>选择手牌</span>
                    </button>
                )}
            </div>

            <button 
                disabled={setupCards.length !== 2}
                onClick={initGame}
                className={`w-full py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 mt-4
                    ${setupCards.length === 2 ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/50' : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
                `}
            >
                <Play size={20} /> 开始牌局
            </button>
          </div>
          
          {showCardSelector && (
             <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
                <CardSelector 
                    title={selectorTitle}
                    selectedCards={[...setupCards, ...tempSelectedCards]} 
                    limit={selectorLimit}
                    currentlySelected={tempSelectedCards.length}
                    onSelect={(c) => cardSelectorCallback && cardSelectorCallback(c)}
                />
                <button 
                    onClick={() => setShowCardSelector(false)}
                    className="absolute top-4 right-4 text-white hover:text-gray-300"
                >
                    <X size={32} />
                </button>
             </div>
          )}
        </div>
      </div>
    );
  }

  // Active Game

  const currentPlayer = gameState.players[gameState.currentTurnIndex];
  const isHeroTurn = currentPlayer?.isUser;
  const canCheck = isCheckLegal(gameState);
  const callAmount = getCallAmount(gameState);

  return (
    <div className="flex-1 bg-slate-900 text-slate-200 flex flex-col font-sans h-full overflow-hidden relative">
      {/* Winner Overlay */}
      {winnerMessage && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-gradient-to-br from-amber-500 to-amber-700 p-8 rounded-2xl shadow-2xl text-center border-4 border-amber-300 transform scale-110">
                  <Trophy className="w-20 h-20 text-white mx-auto mb-4 drop-shadow-md" />
                  <h2 className="text-3xl font-bold text-white mb-2">牌局结束</h2>
                  <p className="text-xl text-amber-100 font-semibold">{winnerMessage}</p>
                  <p className="text-sm text-amber-200 mt-4 animate-pulse">正在开始下一轮...</p>
              </div>
          </div>
      )}

      {/* In-Game Header for Poker-specific controls */}
      <div className="bg-slate-800 border-b border-slate-700 p-2 px-4 flex justify-between items-center z-30 shrink-0">
         <div className="flex gap-2">
            <button 
                onClick={resetToSetup}
                className="p-1.5 px-3 bg-emerald-700 hover:bg-emerald-600 rounded text-xs flex items-center gap-1 cursor-pointer text-white font-medium transition-colors"
                title="返回设置页面重新开始"
            >
                <RotateCcw size={14} /> 重置 / 设置
            </button>
         </div>
         <div className="text-xs text-slate-500 font-mono">
             Pot: <span className="text-amber-400 font-bold">{gameState.pot}</span>
         </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden h-full">
        {/* Left: Table Area */}
        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-slate-900 relative flex flex-col items-center">
           <PokerTable 
              players={gameState.players}
              userCards={gameState.userCards}
              communityCards={gameState.communityCards}
              currentTurnIndex={gameState.phase === GamePhase.SHOWDOWN ? -1 : gameState.currentTurnIndex}
              phase={gameState.phase}
              pot={gameState.pot + gameState.players.reduce((acc, p) => acc + p.roundBet, 0)}
           />
           
           <div className="mt-8 w-full max-w-2xl bg-slate-800/50 rounded-xl p-4 backdrop-blur-sm border border-slate-700 z-10">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-2 font-bold flex justify-between">
                  <span>游戏控制</span>
                  <span>当前最大注: <span className="text-amber-400">{gameState.currentHighBet}</span></span>
              </div>
              
              {gameState.phase === GamePhase.SHOWDOWN ? (
                  <div className="text-center py-4">
                      <h2 className="text-2xl font-bold text-amber-400 mb-4 flex items-center justify-center gap-2">
                          <HandCoins /> 摊牌阶段 - 谁赢得了底池？
                      </h2>
                      <div className="flex flex-wrap justify-center gap-3">
                          {gameState.players.filter(p => p.isActive).map(player => (
                              <button
                                key={player.id}
                                onClick={() => handleWin(player)}
                                className={`
                                    px-6 py-3 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95
                                    ${player.isUser ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-600 hover:bg-slate-500'}
                                `}
                              >
                                  {player.isUser ? '我赢了' : `${player.positionName} 赢了`}
                              </button>
                          ))}
                      </div>
                  </div>
              ) : isHeroTurn ? (
                  <div className="text-center py-4">
                      <h2 className="text-2xl font-bold text-white mb-2 animate-pulse">轮到您了</h2>
                      
                      {!showRaiseInput ? (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <ActionButton 
                                type="弃牌" 
                                onClick={() => handlePlayerAction(PlayerActionType.FOLD)} 
                                color="bg-red-600 hover:bg-red-500" 
                            />
                            {canCheck ? (
                                <ActionButton 
                                    type="过牌" 
                                    onClick={() => handlePlayerAction(PlayerActionType.CHECK)} 
                                    color="bg-slate-600 hover:bg-slate-500" 
                                />
                            ) : (
                                <button disabled className="py-4 rounded-lg font-bold text-slate-500 bg-slate-800 border border-slate-700 cursor-not-allowed opacity-50 flex flex-col items-center justify-center">
                                    <span>不能过牌</span>
                                </button>
                            )}
                            <ActionButton 
                                type={`跟注 ${callAmount}`} 
                                onClick={() => handlePlayerAction(PlayerActionType.CALL)} 
                                color="bg-blue-600 hover:bg-blue-500" 
                            />
                            <ActionButton 
                                type="加注" 
                                onClick={() => {
                                    setRaiseAmountInput(Math.max(gameState.currentHighBet + BB_AMOUNT, BB_AMOUNT * 2).toString());
                                    setShowRaiseInput(true);
                                }} 
                                color="bg-emerald-600 hover:bg-emerald-500" 
                            />
                        </div>
                      ) : (
                          <div className="flex flex-col gap-2">
                              <label className="text-white text-sm">请输入总下注额 (需 &gt; {gameState.currentHighBet})</label>
                              <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    value={raiseAmountInput}
                                    onChange={(e) => setRaiseAmountInput(e.target.value)}
                                    className="flex-1 p-2 rounded bg-slate-700 text-white border border-slate-600"
                                    autoFocus
                                />
                                <button 
                                    onClick={() => handlePlayerAction(PlayerActionType.RAISE, Number(raiseAmountInput))}
                                    className="px-6 bg-emerald-600 hover:bg-emerald-500 rounded font-bold text-white"
                                >
                                    确认加注
                                </button>
                                <button 
                                    onClick={() => setShowRaiseInput(false)}
                                    className="px-4 bg-slate-600 hover:bg-slate-500 rounded text-white"
                                >
                                    取消
                                </button>
                              </div>
                          </div>
                      )}
                  </div>
              ) : (
                  <div className="text-center py-4">
                    <h2 className="text-xl text-slate-300 mb-2">
                        当前行动: <span className="font-bold text-white">{currentPlayer?.positionName}</span>
                    </h2>
                    
                    {!showRaiseInput ? (
                        <div className="flex flex-wrap justify-center gap-2">
                            <button onClick={() => handlePlayerAction(PlayerActionType.FOLD)} className="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600 text-sm">对手弃牌</button>
                            {canCheck ? (
                                <button onClick={() => handlePlayerAction(PlayerActionType.CHECK)} className="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600 text-sm">对手过牌</button>
                            ) : (
                                <button disabled className="px-4 py-2 bg-slate-800 text-slate-600 rounded cursor-not-allowed text-sm">对手无法过牌</button>
                            )}
                            <button onClick={() => handlePlayerAction(PlayerActionType.CALL)} className="px-4 py-2 bg-slate-700 rounded hover:bg-slate-600 text-sm">对手跟注 ({callAmount})</button>
                            <button 
                                onClick={() => {
                                    setRaiseAmountInput(Math.max(gameState.currentHighBet + BB_AMOUNT, BB_AMOUNT * 2).toString());
                                    setShowRaiseInput(true);
                                }} 
                                className="px-4 py-2 bg-amber-700 rounded hover:bg-amber-600 text-white text-sm"
                            >
                                对手加注...
                            </button>
                        </div>
                    ) : (
                        <div className="bg-slate-800 p-2 rounded border border-slate-600 inline-block">
                             <div className="text-xs text-left mb-1 text-slate-400">对手加注总额:</div>
                             <div className="flex gap-1">
                                <input 
                                    type="number" 
                                    value={raiseAmountInput}
                                    onChange={(e) => setRaiseAmountInput(e.target.value)}
                                    className="w-24 p-1 rounded bg-slate-900 text-white text-sm"
                                    autoFocus
                                />
                                <button 
                                    onClick={() => handlePlayerAction(PlayerActionType.RAISE, Number(raiseAmountInput))}
                                    className="px-2 bg-amber-600 text-white text-xs rounded"
                                >
                                    确认
                                </button>
                                <button onClick={() => setShowRaiseInput(false)} className="px-2 bg-slate-600 text-white text-xs rounded">X</button>
                             </div>
                        </div>
                    )}
                  </div>
              )}
           </div>
        </div>

        {/* Right: AI Panel */}
        <div className="w-full lg:w-96 bg-slate-950 border-l border-slate-800 p-6 flex flex-col shadow-2xl z-20">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <BrainCircuit className={isThinking ? "animate-spin text-emerald-500" : "text-emerald-500"} />
                AI 策略军师
            </h3>
            
            <div className="flex-1 bg-slate-900 rounded-xl p-4 border border-slate-800 overflow-y-auto">
                {isThinking ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="animate-pulse">正在分析范围和底池赔率...</p>
                    </div>
                ) : aiAdvice ? (
                    <div className="prose prose-invert prose-sm text-slate-300 text-sm whitespace-pre-wrap">
                        {aiAdvice.replace(/\*\*/g, '')}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600 text-center">
                        <p>等待您的回合...</p>
                        <p className="text-xs mt-2">建议将在此处自动显示。</p>
                    </div>
                )}
            </div>

            <div className="mt-4">
                 <button 
                    onClick={triggerAIAnalysis}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                 >
                    <BrainCircuit size={18} /> 强制重新分析
                 </button>
            </div>
        </div>
      </div>

      {/* Modal for Card Selection during game */}
      {showCardSelector && (
         <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl">
                <div className="flex justify-between items-center mb-4 px-4">
                     <h3 className="text-xl font-bold text-white">{selectorTitle}</h3>
                     <button onClick={() => setShowCardSelector(false)} className="text-white hover:text-red-400"><X /></button>
                </div>
                <CardSelector 
                    title=""
                    selectedCards={[...gameState.userCards, ...gameState.communityCards, ...tempSelectedCards]} 
                    limit={selectorLimit}
                    currentlySelected={tempSelectedCards.length}
                    onSelect={(c) => cardSelectorCallback && cardSelectorCallback(c)}
                />
                <div className="mt-4 text-center text-slate-400">
                    已选 {tempSelectedCards.length} / {selectorLimit}
                </div>
            </div>
         </div>
      )}
    </div>
  );
};

// Helper Components
const ActionButton: React.FC<{ type: string, onClick: () => void, color: string }> = ({ type, onClick, color }) => (
    <button onClick={onClick} className={`py-4 rounded-lg font-bold text-white shadow-lg transition-transform active:scale-95 ${color}`}>
        {type}
    </button>
);

const CardSelectorWrapper: React.FC<{ card: Card }> = ({ card }) => {
    // Just a wrapper to render the card display we imported without full props overkill inside the map
    const { id, rank, suit } = card;
    return (
        <div className="w-12 h-16 bg-white rounded border border-gray-300 flex flex-col items-center justify-center relative select-none">
             <span className={`font-bold leading-none ${(suit === Suit.HEARTS || suit === Suit.DIAMONDS) ? 'text-red-600' : 'text-black'}`}>
                {rank}{suit}
             </span>
        </div>
    )
};

export default PokerGame;