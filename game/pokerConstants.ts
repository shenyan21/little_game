import { Rank, Suit, Card } from './pokerTypes';

export const SUITS = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
export const RANKS = [
  Rank.TWO, Rank.THREE, Rank.FOUR, Rank.FIVE, Rank.SIX, Rank.SEVEN, 
  Rank.EIGHT, Rank.NINE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE
];

export const generateDeck = (): Card[] => {
  const deck: Card[] = [];
  SUITS.forEach(suit => {
    RANKS.forEach(rank => {
      deck.push({ rank, suit, id: `${rank}${suit}` });
    });
  });
  return deck;
};

// Map number of players to position names relative to Dealer (Button)
// 0 is always Dealer/Button for simplicity in rotation
export const getPositionName = (index: number, totalPlayers: number, dealerIndex: number): string => {
  // Normalize index so dealer is 0
  const rel = (index - dealerIndex + totalPlayers) % totalPlayers;
  
  if (totalPlayers === 2) {
    if (rel === 0) return '庄家';
    if (rel === 1) return '大盲';
  }

  if (rel === 0) return '庄家';
  if (rel === 1) return '小盲';
  if (rel === 2) return '大盲';
  
  // For remaining positions, assume sequential numbering starting from SB=1, BB=2, so next is 3.
  // Since rel index for UTG is 3, we can just use the rel index.
  return `${rel}号位`;
};