'use client';

import { Card as CardType, isJokerCard } from '../../types/card';
import { WinnerInfo, LoserInfo, PlayerGameState } from '../../types/game';
import { Card } from './Card';

interface GameResultProps {
  winnerName: string;
  isWinner: boolean;
  onBackToLobby: () => void;
  lastDrawCards?: CardType[];
  finalScore?: number;
  winnerHandCount?: number;
  rate: number;
  winners?: WinnerInfo[];
  playerId: string;
  loser?: LoserInfo;
  dobonWinnerPlayerIds?: string[];
  dobonTriggerCard?: CardType;
  winnerPlayers?: PlayerGameState[];
}

export function GameResult({
  winnerName,
  isWinner,
  onBackToLobby,
  lastDrawCards,
  finalScore,
  winnerHandCount,
  rate,
  winners,
  playerId,
  loser,
  dobonWinnerPlayerIds,
  dobonTriggerCard,
  winnerPlayers,
}: GameResultProps) {
  // ラストドローの最終カード（ジョーカー以外）を取得
  const lastNonJokerCard = lastDrawCards?.find(c => !isJokerCard(c));
  const lastDrawValue = lastNonJokerCard ? lastNonJokerCard.rank : 0;

  // 手札枚数倍率を計算
  const getHandCountMultiplier = (count: number): number => {
    if (count === 1) return 2;
    if (count === 2) return 1;
    return count;
  };

  // 複数勝者がいる場合
  const hasMultipleWinners = winners && winners.length > 1;
  // 自分が勝者の中にいるか
  const myWinner = winners?.find(w => w.playerId === playerId);

  // オナニー成功判定：ツモドボンで、自分がカードを切った場合
  const isOnaniiSuccess = loser?.isTsumoDobon && loser?.playerId === playerId && isWinner;

  // ドボンされたプレイヤーの表示名を決定
  const getLoserDisplayName = (): string | null => {
    if (!loser) return null;
    if (isOnaniiSuccess) return 'オナニー成功';
    return loser.playerName;
  };
  const loserDisplayName = getLoserDisplayName();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
        <div className="text-6xl mb-4">{isWinner ? '🎉' : '😢'}</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          {isWinner ? '勝利！' : 'ゲーム終了'}
        </h2>
        <p className="text-xl text-gray-600 mb-4">
          {isWinner
            ? hasMultipleWinners
              ? '複数プレイヤーがドボン！'
              : 'おめでとうございます！'
            : hasMultipleWinners
              ? `${winners?.map(w => w.playerName).join(', ')} の勝利です`
              : `${winnerName} の勝利です`}
        </p>

        {/* ドボンされたプレイヤー表示 */}
        {loserDisplayName && (
          <div className={`mb-4 p-3 rounded-lg ${isOnaniiSuccess ? 'bg-purple-100' : 'bg-red-100'}`}>
            <p className="text-sm text-gray-500 mb-1">
              {loser?.isTsumoDobon ? 'ツモドボン' : 'ドボン'}
            </p>
            <p className={`text-lg font-bold ${isOnaniiSuccess ? 'text-purple-600' : 'text-red-600'}`}>
              {isOnaniiSuccess ? (
                <>🎊 {loserDisplayName} 🎊</>
              ) : (
                <>{loserDisplayName} がドボンされました</>
              )}
            </p>
          </div>
        )}

        {/* ドボンカード表示 */}
        {dobonTriggerCard && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">ドボンしたカード</p>
            <div className="flex justify-center">
              <Card card={dobonTriggerCard} size="sm" disabled />
            </div>
          </div>
        )}

        {/* 勝者の手札表示 */}
        {winnerPlayers && winnerPlayers.length > 0 && (
          <div className="mb-4">
            {winnerPlayers.map(wp => wp.hand && (
              <div key={wp.playerId} className="mb-3">
                <p className="text-sm text-gray-500 mb-2">{wp.playerName} の手札</p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {wp.hand.map(card => (
                    <Card key={card.id} card={card} size="sm" disabled />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ラストドロー表示 */}
        {lastDrawCards && lastDrawCards.length > 0 && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 mb-2">ラストドロー</p>
            <div className="flex justify-center gap-2 flex-wrap">
              {lastDrawCards.map((card) => (
                <Card key={card.id} card={card} size="sm" disabled />
              ))}
            </div>
          </div>
        )}

        {/* 複数勝者のスコア表示 */}
        {hasMultipleWinners ? (
          <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-600 mb-3">勝者一覧</p>
            <div className="space-y-2">
              {winners.map((winner) => {
                const multiplier = getHandCountMultiplier(winner.handCount);
                return (
                  <div
                    key={winner.playerId}
                    className={`p-2 rounded ${winner.playerId === playerId ? 'bg-yellow-200' : 'bg-white/50'}`}
                  >
                    <p className={`font-bold ${winner.playerId === playerId ? 'text-orange-600' : 'text-gray-700'}`}>
                      {winner.playerName}
                      {winner.playerId === playerId && ' (あなた)'}
                    </p>
                    <p className="text-lg font-bold text-orange-600">
                      {winner.finalScore.toLocaleString()} EVJ
                    </p>
                    <p className="text-xs text-gray-500">
                      {rate} EVJ × {lastDrawValue} × {multiplier}倍（{winner.handCount}枚）
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 単独勝者のスコア表示 */
          finalScore !== undefined && (
            <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-600 mb-2">勝利点</p>
              <p className="text-3xl font-bold text-orange-600">{finalScore.toLocaleString()} EVJ</p>
              <p className="text-xs text-gray-500 mt-2">
                {rate} EVJ × {lastDrawValue} × {getHandCountMultiplier(winnerHandCount || 1)}倍（{winnerHandCount || 1}枚）
              </p>
            </div>
          )
        )}

        {dobonWinnerPlayerIds ? (
          dobonWinnerPlayerIds.includes(playerId) ? (
            <button
              onClick={onBackToLobby}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg transition"
            >
              待機画面に戻る
            </button>
          ) : (
            <p className="text-gray-400 animate-pulse">待機中...</p>
          )
        ) : (
          <button
            onClick={onBackToLobby}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg transition"
          >
            待機画面に戻る
          </button>
        )}
      </div>
    </div>
  );
}
