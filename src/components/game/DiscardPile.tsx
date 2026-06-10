'use client';

import { Card as CardType, isJokerCard, isWildCard, SUIT_SYMBOLS, RANK_LABELS, UNO_SPECIAL_LABELS } from '../../types/card';
import { Card } from './Card';

interface DiscardPileProps {
  topCard: CardType;
  effectiveTopCard?: CardType;
}

export function DiscardPile({ topCard, effectiveTopCard }: DiscardPileProps) {
  const isJokerOnTop = isJokerCard(topCard) || isWildCard(topCard);
  const showEffectiveCard = isJokerOnTop && effectiveTopCard && !isJokerCard(effectiveTopCard) && !isWildCard(effectiveTopCard);

  return (
    <div className="flex flex-col items-center">
      <span className="text-white/60 text-[11px] font-medium tracking-wide mb-2">場札</span>
      <div className="relative">
        <Card card={topCard} size="lg" disabled />
        {/* ジョーカーが場に出ている場合、有効なカードを表示 */}
        {showEffectiveCard && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white/10 text-white/90 px-3 py-1 rounded-full text-xs whitespace-nowrap backdrop-blur border border-white/15">
            有効: {effectiveTopCard.unoSpecial ? UNO_SPECIAL_LABELS[effectiveTopCard.unoSpecial] : RANK_LABELS[effectiveTopCard.rank]} {SUIT_SYMBOLS[effectiveTopCard.suit]}
          </div>
        )}
        {/* ワイルドカードに色が指定されている場合 */}
        {isWildCard(topCard) && topCard.chosenColor && (
          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-white/10 text-white/90 px-3 py-1 rounded-full text-xs whitespace-nowrap backdrop-blur border border-white/15">
            指定色: {SUIT_SYMBOLS[topCard.chosenColor]}
          </div>
        )}
      </div>
    </div>
  );
}
