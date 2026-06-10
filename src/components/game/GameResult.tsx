'use client';

import { Card as CardType, isJokerCard, isWildCard } from '../../types/card';
import { WinnerInfo, LoserInfo, PlayerGameState, OyakoRoundState } from '../../types/game';
import { Card } from './Card';

interface GameResultProps {
  winnerName: string;
  isWinner: boolean;
  isHost?: boolean;
  onBackToLobby: () => void;
  onNextRoundGame?: () => void;
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
  oyakoRoundState?: OyakoRoundState;
}

export function GameResult({
  winnerName,
  isWinner,
  isHost = false,
  onBackToLobby,
  onNextRoundGame,
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
  oyakoRoundState,
}: GameResultProps) {
  // ラストドローの最終カード（ジョーカー/ワイルド以外）を取得
  const lastNonJokerCard = lastDrawCards?.find(c => !isJokerCard(c) && !isWildCard(c));
  const lastDrawValue = lastNonJokerCard
    ? (lastNonJokerCard.unoSpecial ? 10 : lastNonJokerCard.rank)
    : 0;

  // 手札枚数倍率を計算
  const getHandCountMultiplier = (count: number): number => {
    if (count === 1) return 2;
    if (count === 2) return 1;
    return count;
  };

  // 複数勝者がいる場合
  const hasMultipleWinners = winners && winners.length > 1;

  // オナニー成功判定：ツモドボンで、自分がカードを切った場合
  const isOnaniiSuccess = loser?.isTsumoDobon && loser?.playerId === playerId && isWinner;

  // ワースト判定: 2枚上がり×ラストドロー1で発動するペナルティ
  const isWorst = (winners?.some(w => w.isWorst)) || loser?.isWorst === true;

  // ドボンされたプレイヤーの表示名を決定
  const getLoserDisplayName = (): string | null => {
    if (!loser) return null;
    if (isOnaniiSuccess) return 'オナニー成功';
    return loser.playerName;
  };
  const loserDisplayName = getLoserDisplayName();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-2">
      <div className={`bg-white rounded-2xl p-4 md:p-8 max-w-md w-full mx-2 text-center shadow-2xl max-h-[95vh] overflow-y-auto ${isWorst ? 'ring-4 ring-red-500 animate-pulse' : ''}`}>
        {isWorst ? (
          <>
            <div className="text-4xl md:text-6xl mb-2 md:mb-4">💀</div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-red-600 mb-1 md:mb-2 tracking-wider">
              ワースト発動！
            </h2>
            <p className="text-sm text-gray-600 mb-3">
              2枚上がり × ラストドロー「1」のペナルティ
            </p>
          </>
        ) : (
          <>
            <div className="text-4xl md:text-6xl mb-2 md:mb-4">{isWinner ? '🎉' : '😢'}</div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 mb-1 md:mb-2">
              {isWinner ? '勝利！' : 'ゲーム終了'}
            </h2>
            <p className="text-lg md:text-xl text-gray-600 mb-3">
              {isWinner
                ? hasMultipleWinners
                  ? '複数プレイヤーがドボン！'
                  : 'おめでとうございます！'
                : hasMultipleWinners
                  ? `${winners?.map(w => w.playerName).join(', ')} の勝利です`
                  : `${winnerName} の勝利です`}
            </p>
          </>
        )}

        {/* ドボンされたプレイヤー表示 */}
        {loserDisplayName && (
          <div className={`mb-3 p-2 rounded-lg ${isOnaniiSuccess ? 'bg-purple-100' : 'bg-red-100'}`}>
            <p className="text-xs text-gray-500 mb-0.5">
              {loser?.isTsumoDobon ? 'ツモドボン' : 'ドボン'}
            </p>
            <p className={`text-base font-bold ${isOnaniiSuccess ? 'text-purple-600' : 'text-red-600'}`}>
              {isOnaniiSuccess ? (
                <>🎊 {loserDisplayName} 🎊</>
              ) : (
                <>{loserDisplayName} がドボンされました</>
              )}
            </p>
          </div>
        )}

        {/* ドボンカード + 勝者手札（横並びコンパクト表示） */}
        {(dobonTriggerCard || (winnerPlayers && winnerPlayers.length > 0)) && (
          <div className="mb-3 flex flex-wrap items-start justify-center gap-3">
            {/* ドボンカード */}
            {dobonTriggerCard && (
              <div className="text-center">
                <p className="text-xs text-gray-500 mb-1">ドボンカード</p>
                <Card card={dobonTriggerCard} size="sm" disabled />
              </div>
            )}
            {/* 勝者の手札 */}
            {winnerPlayers && winnerPlayers.map(wp => wp.hand && (
              <div key={wp.playerId} className="text-center">
                <p className="text-xs text-gray-500 mb-1">{wp.playerName} の手札</p>
                <div className="flex gap-0.5 justify-center">
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
          <div className={`mb-3 ${isWorst ? 'p-3 rounded-lg bg-gradient-to-r from-red-100 to-orange-100 border-2 border-red-400' : ''}`}>
            <p className={`text-sm mb-2 ${isWorst ? 'text-red-600 font-bold' : 'text-gray-500'}`}>
              {isWorst ? '💀 ラストドロー（ワースト判定）💀' : 'ラストドロー'}
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              {lastDrawCards.map((card) => (
                <div key={card.id} className={isWorst && card.rank === 1 ? 'ring-2 ring-red-500 rounded-md animate-pulse' : ''}>
                  <Card card={card} size="sm" disabled />
                </div>
              ))}
            </div>
            {isWorst && (
              <p className="text-xs text-red-600 mt-2 font-bold">
                ⚠️ ワースト: ドボン者にレート × -25 のペナルティ
              </p>
            )}
          </div>
        )}

        {/* 複数勝者のスコア表示 */}
        {hasMultipleWinners ? (
          <div className="bg-gradient-to-r from-yellow-100 to-orange-100 rounded-lg p-3 md:p-4 mb-4">
            <p className="text-sm text-gray-600 mb-2">勝者一覧</p>
            <div className="space-y-2">
              {winners.map((winner) => {
                const multiplier = winner.isDobonGaeshi
                  ? winner.gaeshiMultiplier || 0
                  : getHandCountMultiplier(winner.handCount);
                return (
                  <div
                    key={winner.playerId}
                    className={`p-2 rounded ${winner.playerId === playerId ? 'bg-yellow-200' : 'bg-white/50'}`}
                  >
                    <p className={`font-bold text-sm ${winner.playerId === playerId ? 'text-orange-600' : 'text-gray-700'}`}>
                      {winner.playerName}
                      {winner.playerId === playerId && ' (あなた)'}
                      {winner.isDobonGaeshi && ' 🔄 ドボン返し'}
                    </p>
                    <p className="text-lg font-bold text-orange-600">
                      {winner.finalScore.toLocaleString()} EVJ
                    </p>
                    <p className="text-xs text-gray-500">
                      {rate} EVJ × {lastDrawValue} × {multiplier}倍{winner.isDobonGaeshi ? '（ドボン返し）' : `（${winner.handCount}枚）`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 単独勝者のスコア表示 */
          finalScore !== undefined && (
            <div className={`rounded-lg p-3 md:p-4 mb-4 ${isWorst ? 'bg-gradient-to-r from-red-100 to-red-200' : 'bg-gradient-to-r from-yellow-100 to-orange-100'}`}>
              <p className={`text-sm mb-1 ${isWorst ? 'text-red-700 font-bold' : 'text-gray-600'}`}>
                {isWorst ? '💀 ペナルティ' : '勝利点'}
              </p>
              <p className={`text-2xl md:text-3xl font-bold ${isWorst ? 'text-red-700' : 'text-orange-600'}`}>
                {finalScore.toLocaleString()} EVJ
              </p>
              {isWorst ? (
                <p className="text-xs text-red-600 mt-1 font-semibold">
                  {rate} EVJ × -25倍（ワースト ・ 2枚×ラストドロー1）
                </p>
              ) : winners?.[0]?.isDobonGaeshi ? (
                <p className="text-xs text-gray-500 mt-1">
                  {rate} EVJ × {lastDrawValue} × {winners[0].gaeshiMultiplier}倍（ドボン返し 🔄）
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">
                  {rate} EVJ × {lastDrawValue} × {getHandCountMultiplier(winnerHandCount || 1)}倍（{winnerHandCount || 1}枚）
                </p>
              )}
            </div>
          )
        )}

        {/* 親子ルール: 累計スコア */}
        {oyakoRoundState && (
          <div className="bg-purple-50 rounded-lg p-3 mb-4">
            <p className="text-sm text-purple-600 font-bold mb-2">
              第{oyakoRoundState.currentGameNumber}/{oyakoRoundState.totalGames}局
              {oyakoRoundState.isRoundComplete && ' - 最終結果'}
            </p>
            <div className="space-y-1">
              {[...oyakoRoundState.playerScores]
                .sort((a, b) => b.cumulativeScore - a.cumulativeScore)
                .map((ps) => (
                  <div
                    key={ps.playerId}
                    className={`flex justify-between items-center px-2 py-1 rounded ${
                      ps.playerId === playerId ? 'bg-purple-200' : 'bg-white/50'
                    }`}
                  >
                    <span className={`text-sm ${ps.playerId === playerId ? 'font-bold text-purple-700' : 'text-gray-700'}`}>
                      {ps.playerName}
                      {ps.playerId === playerId && ' (あなた)'}
                    </span>
                    <span className={`text-sm font-bold ${
                      ps.cumulativeScore > 0 ? 'text-green-600' : ps.cumulativeScore < 0 ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {ps.cumulativeScore > 0 ? '+' : ''}{ps.cumulativeScore.toLocaleString()} EVJ
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ボタン */}
        {isHost ? (
          oyakoRoundState && !oyakoRoundState.isRoundComplete ? (
            <button
              onClick={onBackToLobby}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white text-lg font-semibold rounded-lg transition"
            >
              次の局へ
            </button>
          ) : (
            <button
              onClick={onBackToLobby}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-lg font-semibold rounded-lg transition"
            >
              待機画面に戻る
            </button>
          )
        ) : (
          <p className="text-gray-400 text-sm">
            {oyakoRoundState && !oyakoRoundState.isRoundComplete
              ? 'ホストが次の局に進むのを待っています...'
              : 'ホストが待機画面に戻るのを待っています...'}
          </p>
        )}
      </div>
    </div>
  );
}
