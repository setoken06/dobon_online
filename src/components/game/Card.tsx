'use client';

import { Card as CardType, SUIT_SYMBOLS, RANK_LABELS, UNO_SPECIAL_LABELS, isJokerCard, isWildCard, isUnoSpecialCard, UnoColor } from '../../types/card';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  playable?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const UNO_COLOR_CLASSES: Record<UnoColor, { bg: string; border: string; text: string }> = {
  red: { bg: 'bg-red-500', border: 'border-red-700', text: 'text-white' },
  blue: { bg: 'bg-blue-500', border: 'border-blue-700', text: 'text-white' },
  yellow: { bg: 'bg-yellow-400', border: 'border-yellow-600', text: 'text-gray-900' },
  green: { bg: 'bg-green-500', border: 'border-green-700', text: 'text-white' },
};

export function Card({
  card,
  onClick,
  disabled = false,
  selected = false,
  playable = false,
  size = 'md',
}: CardProps) {
  const isJoker = isJokerCard(card);
  const isWild = isWildCard(card);
  const isUnoSpecial = isUnoSpecialCard(card);
  const isUnoColor = card.suit in UNO_COLOR_CLASSES;
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  const sizeClasses = {
    sm: 'w-12 h-16 text-sm',
    md: 'w-16 h-24 text-lg',
    lg: 'w-20 h-28 text-xl',
    xl: 'w-40 h-56 text-4xl',
  };

  // ワイルドカード（UNOモード）
  if (isWild) {
    const isW4 = card.isWild4;
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          bg-gradient-to-br ${isW4 ? 'from-red-500 via-blue-500 to-green-500' : 'from-purple-500 to-pink-500'} rounded-lg border-2 shadow-md
          flex flex-col items-center justify-center
          transition-all duration-200
          text-white
          ${selected ? 'border-yellow-400 ring-2 ring-yellow-400 transform -translate-y-2' : 'border-gray-700'}
          ${playable && !disabled ? 'hover:border-yellow-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span className="text-xs font-bold">{isW4 ? '+4' : ''}</span>
        <span className="text-2xl">🌈</span>
        <span className="text-xs font-bold">WILD</span>
      </button>
    );
  }

  // ジョーカー（クラシックモード）
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

  // UNOカード（色付き）
  if (isUnoColor) {
    const colorClass = UNO_COLOR_CLASSES[card.suit as UnoColor];
    const displayText = isUnoSpecial
      ? UNO_SPECIAL_LABELS[card.unoSpecial!]
      : String(card.rank);

    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          ${colorClass.bg} rounded-lg border-2 shadow-md
          flex flex-col items-center justify-center
          transition-all duration-200
          ${colorClass.text}
          ${selected ? 'border-yellow-400 ring-2 ring-yellow-400 transform -translate-y-2' : colorClass.border}
          ${playable && !disabled ? 'hover:border-yellow-300 hover:shadow-lg hover:-translate-y-1 cursor-pointer' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <span className="font-bold text-xl">{displayText}</span>
      </button>
    );
  }

  // クラシックカード
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
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function CardBack({ size = 'md' }: CardBackProps) {
  const sizeClasses = {
    sm: 'w-12 h-16',
    md: 'w-16 h-24',
    lg: 'w-20 h-28',
    xl: 'w-40 h-56',
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
