import React from 'react';
import { Card, Suit } from '../game/pokerTypes';
import { generateDeck } from '../game/pokerConstants';
import { Shuffle } from 'lucide-react';

interface CardSelectorProps {
  onSelect: (card: Card) => void;
  selectedCards: Card[]; // Cards already selected in the game to disable duplicates
  title?: string;
  limit?: number; // Total cards needed
  currentlySelected?: number; // Cards currently selected in this session
}

const CardSelector: React.FC<CardSelectorProps> = ({ 
  onSelect, 
  selectedCards, 
  title, 
  limit = 0, 
  currentlySelected = 0 
}) => {
  const deck = generateDeck();

  // Helper to check if card is already taken
  const isSelected = (c: Card) => selectedCards.some(sc => sc.id === c.id);

  const handleRandom = () => {
    const needed = limit - currentlySelected;
    if (needed <= 0) return;

    // Filter out cards that are already selected (either in game or in temp selection)
    const available = deck.filter(c => !selectedCards.some(sc => sc.id === c.id));
    
    // Shuffle and pick needed amount
    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const toAdd = shuffled.slice(0, needed);

    toAdd.forEach(card => {
        onSelect(card);
    });
  };

  // Group by suit for better layout
  const groupedCards = {
    [Suit.SPADES]: deck.filter(c => c.suit === Suit.SPADES),
    [Suit.HEARTS]: deck.filter(c => c.suit === Suit.HEARTS),
    [Suit.CLUBS]: deck.filter(c => c.suit === Suit.CLUBS),
    [Suit.DIAMONDS]: deck.filter(c => c.suit === Suit.DIAMONDS),
  };

  return (
    <div className="p-4 bg-slate-800 rounded-lg shadow-xl border border-slate-700 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
          {title && <h3 className="text-white text-lg font-bold">{title}</h3>}
          
          {limit > 0 && limit > currentlySelected && (
              <button 
                onClick={handleRandom}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-bold transition-colors"
                title="随机填充剩余卡牌"
              >
                  <Shuffle size={16} />
                  <span>随机填充 ({limit - currentlySelected})</span>
              </button>
          )}
      </div>
      
      <div className="flex flex-col gap-4 overflow-x-auto">
        {Object.entries(groupedCards).map(([suit, cards]) => (
          <div key={suit} className="flex gap-2">
            <div className="w-8 flex items-center justify-center text-2xl bg-slate-700 rounded text-white">
                <span className={suit === Suit.HEARTS || suit === Suit.DIAMONDS ? 'text-red-400' : 'text-slate-200'}>
                    {suit}
                </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {cards.map(card => {
                const disabled = isSelected(card);
                return (
                  <button
                    key={card.id}
                    disabled={disabled}
                    onClick={() => onSelect(card)}
                    className={`
                      w-10 h-14 rounded flex items-center justify-center text-sm font-bold border
                      ${disabled 
                        ? 'opacity-20 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500' 
                        : 'bg-white hover:bg-slate-100 cursor-pointer border-slate-300'
                      }
                      ${(card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS) ? 'text-red-600' : 'text-slate-900'}
                    `}
                  >
                    {card.rank}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CardSelector;