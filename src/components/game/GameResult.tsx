'use client';

import { Card as CardType, SUIT_SYMBOLS, RANK_LABELS, isJokerCard } from '../../types/card';
import { Card } from './Card';

interface GameResultProps {
  winnerName: string;
  isWinner: boolean;
  onBackToLobby: () => void;
  lastDrawCards?: CardType[];
  finalScore?: number;
  winnerHandCount?: number;
  rate: number;
}

export function GameResult({
  winnerName,
  isWinner,
  onBackToLobby,
  lastDrawCards,
  finalScore,
  winnerHandCount,
  rate,
}: GameResultProps) {
  // ラストドローの最終カード（ジョーカー以外）を取得
  const lastNonJokerCard = lastDrawCards?.find(c => !isJokerCard(c));
  const lastDrawValue = lastNonJokerCard ? lastNonJokerCard.rank : 0;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        <div className="text-6xl mb-4">{isWinner ? '🎉' : '😢'}</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          {isWinner ? '勝利！' : 'ゲーム終了'}
        </h2>
        <p className="text-xl text-gray-600 mb-4">
          {isWinner ? 'おめでとうございます！' : `${winnerName} の勝利です`}
        </p>

        {/* ラストドロー表示 */}
        {lastDrawCards && lastDrawCards.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">ラストドロー</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {lastDrawCards.map((card, index) => (
                <Card key={card.id} card={card} size="sm" disabled />
              ))}
            </div>
          </div>
        )}

        {/* スコア計算表示 */}
        {finalScore !== undefined && (
          <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-2">勝利点</p>
            <p className="text-3xl font-bold text-orange-600">{finalScore.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-2">
              {rate} × {lastDrawValue} × {winnerHandCount || 1}枚
            </p>
          </div>
        )}

        <button
          onClick={onBackToLobby}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg transition"
        >
          待機画面に戻る
        </button>
      </div>
    </div>
  );
}
