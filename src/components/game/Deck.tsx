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
      <span className="text-white text-sm mb-2">山札 ({count}枚)</span>
      <button
        onClick={onDraw}
        disabled={!canDraw}
        className={`
          relative transition-transform
          ${canDraw ? 'hover:scale-105 cursor-pointer' : 'opacity-70 cursor-not-allowed'}
        `}
      >
        <CardBack size="lg" />
        {canDraw && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-white font-bold">引く</span>
          </div>
        )}
      </button>
    </div>
  );
}
