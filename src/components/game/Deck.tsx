'use client';

import { CardBack } from './Card';

interface DeckProps {
  count: number;
  onDraw: () => void;
  canDraw: boolean;
}

export function Deck({ count, onDraw, canDraw }: DeckProps) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-white/60 text-[11px] font-medium tracking-wide mb-2">山札 {count}</span>
      <button
        onClick={onDraw}
        disabled={!canDraw}
        className={`
          group relative transition-transform
          ${canDraw ? 'hover:scale-105 cursor-pointer' : 'opacity-60 cursor-not-allowed'}
        `}
      >
        {canDraw && <span className="absolute -inset-1 rounded-2xl bg-accent/30 blur-md anim-glow" />}
        <span className="relative block"><CardBack size="lg" /></span>
        {canDraw && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-sm font-medium">引く</span>
          </div>
        )}
      </button>
    </div>
  );
}
