import React from 'react';
import { Card, Suit } from '../game/pokerTypes';

interface CardDisplayProps {
  card?: Card;
  size?: 'sm' | 'md' | 'lg';
  hidden?: boolean;
  onClick?: () => void;
  className?: string;
}

const CardDisplay: React.FC<CardDisplayProps> = ({ card, size = 'md', hidden = false, onClick, className = '' }) => {
  const isRed = card?.suit === Suit.HEARTS || card?.suit === Suit.DIAMONDS;

  const sizeClasses = {
    sm: 'w-10 h-14 text-xs',
    md: 'w-16 h-24 text-base',
    lg: 'w-24 h-36 text-xl',
  };

  const baseClasses = `
    relative flex flex-col items-center justify-center 
    rounded-md border-2 shadow-md transition-transform transform hover:-translate-y-1 select-none
    ${sizeClasses[size]}
    ${className}
    ${onClick ? 'cursor-pointer' : ''}
  `;

  if (hidden || !card) {
    return (
      <div className={`${baseClasses} bg-blue-800 border-blue-900`} onClick={onClick}>
        <div className="w-full h-full opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
      </div>
    );
  }

  return (
    <div 
      className={`${baseClasses} bg-white border-gray-300 ${isRed ? 'text-red-600' : 'text-slate-900'}`}
      onClick={onClick}
    >
      <div className="absolute top-1 left-1 leading-none font-bold">
        {card.rank}
        <div className="text-[0.8em]">{card.suit}</div>
      </div>
      <div className="text-2xl">{card.suit}</div>
      <div className="absolute bottom-1 right-1 leading-none font-bold rotate-180">
        {card.rank}
        <div className="text-[0.8em]">{card.suit}</div>
      </div>
    </div>
  );
};

export default CardDisplay;