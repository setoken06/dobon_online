'use client';

import { Card as CardType, isJokerCard, SUIT_SYMBOLS, RANK_LABELS } from '../../types/card';
import { Card } from './Card';

interface DiscardPileProps {
  topCard: CardType;
  effectiveTopCard?: CardType;
}

export function DiscardPile({ topCard, effectiveTopCard }: DiscardPileProps) {
  const isJokerOnTop = isJokerCard(topCard);
  const showEffectiveCard = isJokerOnTop && effectiveTopCard && !isJokerCard(effectiveTopCard);

  return (
    <div className="flex flex-col items-center">
      <span className="text-white text-sm mb-2">場札</span>
      <div className="relative">
        <Card card={topCard} size="lg" disabled />
        {/* ジョーカーが場に出ている場合、有効なカードを表示 */}
        {showEffectiveCard && (
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-3 py-1 rounded-lg text-sm whitespace-nowrap shadow-lg border border-gray-600">
            有効: {RANK_LABELS[effectiveTopCard.rank]} {SUIT_SYMBOLS[effectiveTopCard.suit]}
          </div>
        )}
      </div>
    </div>
  );
}
