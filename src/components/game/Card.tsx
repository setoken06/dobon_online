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

const UNO_COLOR_CLASSES: Record<UnoColor, { bg: string; text: string }> = {
  red: { bg: 'bg-[#e0484d]', text: 'text-white' },
  blue: { bg: 'bg-[#3b82c4]', text: 'text-white' },
  yellow: { bg: 'bg-[#e3b53b]', text: 'text-[#15171c]' },
  green: { bg: 'bg-[#3fa07a]', text: 'text-white' },
};

const SIZES = {
  sm: { box: 'w-12 h-[68px] rounded-md', corner: 'text-[10px]', pip: 'text-xl', center: 'text-xl' },
  md: { box: 'w-16 h-[92px] rounded-lg', corner: 'text-xs', pip: 'text-2xl', center: 'text-2xl' },
  lg: { box: 'w-20 h-28 rounded-xl', corner: 'text-sm', pip: 'text-3xl', center: 'text-3xl' },
  xl: { box: 'w-40 h-56 rounded-2xl', corner: 'text-lg', pip: 'text-6xl', center: 'text-6xl' },
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
  const s = SIZES[size];

  // shared interaction layer
  const interaction = [
    'relative flex flex-col card-shadow transition-all duration-200 ease-out select-none',
    s.box,
    selected ? '-translate-y-3 ring-2 ring-[var(--color-accent)] z-10' : '',
    playable && !disabled ? 'cursor-pointer hover:-translate-y-1.5' : '',
    disabled ? 'opacity-55 cursor-not-allowed' : '',
    !playable && !disabled ? 'cursor-default' : '',
  ].join(' ');

  // Wild card (UNO)
  if (isWild) {
    const isW4 = card.isWild4;
    return (
      <button onClick={onClick} disabled={disabled} className={`${interaction} items-center justify-center overflow-hidden bg-[#1b1f27] border border-white/10`}>
        <div className={`absolute inset-0 opacity-90 ${isW4 ? 'bg-[conic-gradient(at_50%_50%,#e0484d,#e3b53b,#3fa07a,#3b82c4,#e0484d)]' : 'bg-[conic-gradient(at_50%_50%,#e0484d,#e3b53b,#3fa07a,#3b82c4,#e0484d)]'}`} />
        <div className="absolute inset-[3px] rounded-[inherit] bg-[#15181f]/85 backdrop-blur-[1px]" />
        <span className="relative text-white font-semibold tracking-wide" style={{ fontSize: size === 'xl' ? '1.5rem' : '0.7rem' }}>WILD</span>
        {isW4 && <span className="relative text-white/90 font-bold mt-0.5" style={{ fontSize: size === 'xl' ? '2rem' : '0.85rem' }}>+4</span>}
      </button>
    );
  }

  // Joker (classic)
  if (isJoker) {
    return (
      <button onClick={onClick} disabled={disabled} className={`${interaction} items-center justify-center bg-gradient-to-br from-[#1f2430] to-[#11141b] border border-white/10`}>
        <span className={s.center}>🃏</span>
        <span className="absolute bottom-1.5 text-[9px] tracking-[0.2em] text-white/50 font-medium">JOKER</span>
      </button>
    );
  }

  // UNO colored card
  if (isUnoColor) {
    const colorClass = UNO_COLOR_CLASSES[card.suit as UnoColor];
    const displayText = isUnoSpecial ? UNO_SPECIAL_LABELS[card.unoSpecial!] : String(card.rank);
    return (
      <button onClick={onClick} disabled={disabled} className={`${interaction} ${colorClass.bg} ${colorClass.text} items-center justify-center border border-black/10`}>
        <span className={`absolute top-1 left-1.5 font-bold ${s.corner}`}>{displayText}</span>
        <span className={`font-extrabold ${s.center}`}>{displayText}</span>
        <span className={`absolute bottom-1 right-1.5 font-bold rotate-180 ${s.corner}`}>{displayText}</span>
      </button>
    );
  }

  // Classic playing card — minimal index + center pip
  const ink = isRed ? 'text-[#d8434a]' : 'text-[#1a1d23]';
  return (
    <button onClick={onClick} disabled={disabled} className={`${interaction} bg-white border border-[#e2e4e9] ${ink} ${playable && !disabled ? 'hover:border-[var(--color-accent)]' : ''}`}>
      <div className={`absolute top-1 left-1.5 flex flex-col items-center leading-none ${s.corner}`}>
        <span className="font-bold">{RANK_LABELS[card.rank]}</span>
        <span className="font-medium">{SUIT_SYMBOLS[card.suit]}</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className={s.center}>{SUIT_SYMBOLS[card.suit]}</span>
      </div>
      <div className={`absolute bottom-1 right-1.5 flex flex-col items-center leading-none rotate-180 ${s.corner}`}>
        <span className="font-bold">{RANK_LABELS[card.rank]}</span>
        <span className="font-medium">{SUIT_SYMBOLS[card.suit]}</span>
      </div>
    </button>
  );
}

interface CardBackProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function CardBack({ size = 'md' }: CardBackProps) {
  const s = SIZES[size];
  return (
    <div className={`${s.box} card-shadow bg-gradient-to-br from-[#222834] to-[#161a22] border border-white/10 flex items-center justify-center overflow-hidden`}>
      <span className="text-white/25 font-bold tracking-tight" style={{ fontSize: size === 'sm' ? '0.8rem' : '1.25rem' }}>♠</span>
    </div>
  );
}
