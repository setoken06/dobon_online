'use client';

import { Card as CardType, SUIT_SYMBOLS, RANK_LABELS, isJokerCard } from '../../types/card';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  playable?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function Card({
  card,
  onClick,
  disabled = false,
  selected = false,
  playable = false,
  size = 'md',
}: CardProps) {
  const isJoker = isJokerCard(card);
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  const sizeClasses = {
    sm: 'w-12 h-16 text-sm',
    md: 'w-16 h-24 text-lg',
    lg: 'w-20 h-28 text-xl',
  };

  // ジョーカーの場合は特別な表示
  if (isJoker) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg border-2 shadow-md
          flex flex-col items-center justify-center
          transition-all duration-200
          text-white
          ${selected ? 'border-yellow-400 ring-2 ring-yellow-400 transform -translate-y-2' : 'border-purple-700'}
          ${playable && !disabled ? 'hover:border-yellow-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span className="text-3xl">🃏</span>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        ${sizeClasses[size]}
        bg-white rounded-lg border-2 shadow-md
        flex flex-col items-center justify-center
        transition-all duration-200
        ${isRed ? 'text-red-600' : 'text-gray-900'}
        ${selected ? 'border-yellow-400 ring-2 ring-yellow-400 transform -translate-y-2' : 'border-gray-300'}
        ${playable && !disabled ? 'hover:border-green-500 hover:shadow-lg hover:-translate-y-1 cursor-pointer' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${!playable && !disabled ? 'hover:border-gray-400' : ''}
      `}
    >
      <span className="font-bold">{RANK_LABELS[card.rank]}</span>
      <span className="text-2xl">{SUIT_SYMBOLS[card.suit]}</span>
    </button>
  );
}

interface CardBackProps {
  size?: 'sm' | 'md' | 'lg';
}

export function CardBack({ size = 'md' }: CardBackProps) {
  const sizeClasses = {
    sm: 'w-12 h-16',
    md: 'w-16 h-24',
    lg: 'w-20 h-28',
  };

  return (
    <div
      className={`
        ${sizeClasses[size]}
        bg-blue-800 rounded-lg border-2 border-blue-900 shadow-md
        flex items-center justify-center
      `}
    >
      <div className="w-3/4 h-3/4 bg-blue-700 rounded border border-blue-600 flex items-center justify-center">
        <span className="text-blue-400 text-2xl">?</span>
      </div>
    </div>
  );
}
