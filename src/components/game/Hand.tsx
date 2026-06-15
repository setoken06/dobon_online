'use client';

import { Card as CardType } from '../../types/card';
import { Card } from './Card';

interface HandProps {
  cards: CardType[];
  topCard: CardType;
  isMyTurn: boolean;
  hasDrawn: boolean;
  selectedCardIds: string[];
  playableCardIds: Set<string>;
  onCardSelect: (cardId: string) => void;
  exposedCardIds?: Set<string>; // 見逃しで表側公開されている自分のカードID
}

export function Hand({ cards, topCard, isMyTurn, hasDrawn, selectedCardIds, playableCardIds, onCardSelect, exposedCardIds }: HandProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] backdrop-blur-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-white/65 text-xs font-medium tracking-wide">あなたの手札</span>
        <span className="text-white/45 text-xs tabular-nums">{cards.length}枚</span>
      </div>
      <div className="flex flex-wrap gap-2 justify-center min-h-[100px]">
        {cards.map((card) => {
          const isPlayable = playableCardIds.has(card.id);
          const isSelected = selectedCardIds.includes(card.id);
          const isExposed = exposedCardIds?.has(card.id) ?? false;

          // 選択中のカードと同じランクかどうか
          const selectedCard = selectedCardIds.length > 0
            ? cards.find(c => c.id === selectedCardIds[0])
            : null;
          const isSameRankAsSelected = selectedCard && card.rank === selectedCard.rank;

          // クリック可能条件：
          // - 自分のターンで
          // - (出せるカード OR 選択中のカードと同じランク OR 既に選択されている)
          const canClick = isMyTurn && (isPlayable || isSameRankAsSelected || isSelected);

          return (
            <div
              key={card.id}
              className={isExposed ? 'rounded-lg ring-2 ring-[#c9483f] ring-offset-1 ring-offset-transparent relative' : 'relative'}
              title={isExposed ? '公開中（見逃しで表側になっています）' : undefined}
            >
              {isExposed && (
                <span className="absolute -top-1.5 -right-1.5 z-10 bg-[#c9483f] text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">
                  公開
                </span>
              )}
              <Card
                card={card}
                playable={isPlayable}
                selected={isSelected}
                disabled={!canClick}
                onClick={() => canClick && onCardSelect(card.id)}
              />
            </div>
          );
        })}
        {cards.length === 0 && (
          <div className="text-white/40 text-sm self-center">手札がありません</div>
        )}
      </div>
    </div>
  );
}
