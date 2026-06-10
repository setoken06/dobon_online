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
    <div className="fixed inset-0 bg-[#0d1015]/75 backdrop-blur-sm flex items-center justify-center z-50 p-3">
      <div className={`bg-surface rounded-3xl p-5 md:p-8 max-w-md w-full mx-2 text-center elev-lg border border-line max-h-[95vh] overflow-y-auto scroll-soft anim-pop ${isWorst ? 'ring-2 ring-danger/40' : ''}`}>
        {isWorst ? (
          <>
            <span className="inline-block w-10 h-1 rounded-full bg-danger mb-4" />
            <h2 className="text-xl md:text-2xl font-bold text-danger mb-1 tracking-tight">
              ワースト発動
            </h2>
            <p className="text-xs text-muted mb-3">
              2枚上がり × ラストドロー「1」のペナルティ
            </p>
          </>
        ) : (
          <>
            <span className={`inline-block w-10 h-1 rounded-full mb-4 ${isWinner ? 'bg-accent' : 'bg-line'}`} />
            <h2 className="text-xl md:text-2xl font-semibold text-ink mb-1 tracking-tight">
              {isWinner ? '勝利' : 'ゲーム終了'}
            </h2>
            <p className="text-sm md:text-base text-muted mb-3">
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
          <div className={`mb-3 p-2.5 rounded-xl border ${isOnaniiSuccess ? 'bg-accent-soft border-accent/20' : 'bg-danger-soft border-danger/20'}`}>
            <p className="text-[11px] text-muted mb-0.5">
              {loser?.isTsumoDobon ? 'ツモドボン' : 'ドボン'}
            </p>
            <p className={`text-sm font-semibold ${isOnaniiSuccess ? 'text-accent-ink' : 'text-danger'}`}>
              {isOnaniiSuccess ? (
                <>{loserDisplayName}</>
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
                <p className="text-xs text-muted mb-1">ドボンカード</p>
                <Card card={dobonTriggerCard} size="sm" disabled />
              </div>
            )}
            {/* 勝者の手札 */}
            {winnerPlayers && winnerPlayers.map(wp => wp.hand && (
              <div key={wp.playerId} className="text-center">
                <p className="text-xs text-muted mb-1">{wp.playerName} の手札</p>
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
          <div className={`mb-3 ${isWorst ? 'p-3 rounded-xl bg-danger-soft border border-danger/30' : ''}`}>
            <p className={`text-sm mb-2 ${isWorst ? 'text-danger font-semibold' : 'text-muted'}`}>
              {isWorst ? 'ラストドロー（ワースト判定）' : 'ラストドロー'}
            </p>
            <div className="flex justify-center gap-2 flex-wrap">
              {lastDrawCards.map((card) => (
                <div key={card.id} className={isWorst && card.rank === 1 ? 'ring-2 ring-danger rounded-md' : ''}>
                  <Card card={card} size="sm" disabled />
                </div>
              ))}
            </div>
            {isWorst && (
              <p className="text-xs text-danger mt-2 font-medium">
                ワースト: ドボン者にレート × -25 のペナルティ
              </p>
            )}
          </div>
        )}

        {/* 複数勝者のスコア表示 */}
        {hasMultipleWinners ? (
          <div className="rounded-2xl border border-line bg-surface-2 p-3 md:p-4 mb-4">
            <p className="text-xs text-muted mb-2">勝者一覧</p>
            <div className="space-y-2">
              {winners.map((winner) => {
                const multiplier = winner.isDobonGaeshi
                  ? winner.gaeshiMultiplier || 0
                  : getHandCountMultiplier(winner.handCount);
                return (
                  <div
                    key={winner.playerId}
                    className={`p-2.5 rounded-xl border ${winner.playerId === playerId ? 'bg-accent-soft border-accent/20' : 'bg-surface border-line'}`}
                  >
                    <p className={`font-medium text-sm ${winner.playerId === playerId ? 'text-accent-ink' : 'text-ink-soft'}`}>
                      {winner.playerName}
                      {winner.playerId === playerId && ' (あなた)'}
                      {winner.isDobonGaeshi && ' ・ ドボン返し'}
                    </p>
                    <p className="text-lg font-semibold text-ink tabular-nums">
                      {winner.finalScore.toLocaleString()} <span className="text-xs text-muted font-normal">EVJ</span>
                    </p>
                    <p className="text-[11px] text-muted">
                      {rate} × {lastDrawValue} × {multiplier}倍{winner.isDobonGaeshi ? '（ドボン返し）' : `（${winner.handCount}枚）`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* 単独勝者のスコア表示 */
          finalScore !== undefined && (
            <div className={`rounded-2xl border p-4 md:p-5 mb-4 ${isWorst ? 'bg-danger-soft border-danger/20' : 'bg-surface-2 border-line'}`}>
              <p className={`text-xs mb-1 ${isWorst ? 'text-danger font-semibold' : 'text-muted'}`}>
                {isWorst ? 'ペナルティ' : '勝利点'}
              </p>
              <p className={`text-3xl md:text-4xl font-semibold tabular-nums ${isWorst ? 'text-danger' : 'text-ink'}`}>
                {finalScore.toLocaleString()} <span className="text-sm text-muted font-normal">EVJ</span>
              </p>
              {isWorst ? (
                <p className="text-xs text-danger mt-1 font-medium">
                  {rate} EVJ × -25倍（ワースト ・ 2枚×ラストドロー1）
                </p>
              ) : winners?.[0]?.isDobonGaeshi ? (
                <p className="text-xs text-muted mt-1">
                  {rate} EVJ × {lastDrawValue} × {winners[0].gaeshiMultiplier}倍（ドボン返し）
                </p>
              ) : (
                <p className="text-xs text-muted mt-1">
                  {rate} EVJ × {lastDrawValue} × {getHandCountMultiplier(winnerHandCount || 1)}倍（{winnerHandCount || 1}枚）
                </p>
              )}
            </div>
          )
        )}

        {/* 親子ルール: 累計スコア */}
        {oyakoRoundState && (
          <div className="rounded-2xl border border-line bg-surface-2 p-3 mb-4">
            <p className="text-xs text-ink-soft font-semibold mb-2">
              第{oyakoRoundState.currentGameNumber}/{oyakoRoundState.totalGames}局
              {oyakoRoundState.isRoundComplete && ' · 最終結果'}
            </p>
            <div className="space-y-1">
              {[...oyakoRoundState.playerScores]
                .sort((a, b) => b.cumulativeScore - a.cumulativeScore)
                .map((ps) => (
                  <div
                    key={ps.playerId}
                    className={`flex justify-between items-center px-2.5 py-1.5 rounded-lg border ${
                      ps.playerId === playerId ? 'bg-accent-soft border-accent/20' : 'bg-surface border-line'
                    }`}
                  >
                    <span className={`text-sm ${ps.playerId === playerId ? 'font-medium text-accent-ink' : 'text-ink-soft'}`}>
                      {ps.playerName}
                      {ps.playerId === playerId && ' (あなた)'}
                    </span>
                    <span className={`text-sm font-semibold tabular-nums ${
                      ps.cumulativeScore > 0 ? 'text-accent-ink' : ps.cumulativeScore < 0 ? 'text-danger' : 'text-muted'
                    }`}>
                      {ps.cumulativeScore > 0 ? '+' : ''}{ps.cumulativeScore.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ボタン */}
        {isHost ? (
          <button
            onClick={onBackToLobby}
            className="w-full py-3 bg-ink hover:bg-ink-soft text-white font-medium rounded-xl transition"
          >
            {oyakoRoundState && !oyakoRoundState.isRoundComplete ? '次の局へ' : '待機画面に戻る'}
          </button>
        ) : (
          <p className="text-muted text-sm">
            {oyakoRoundState && !oyakoRoundState.isRoundComplete
              ? 'ホストが次の局に進むのを待っています...'
              : 'ホストが待機画面に戻るのを待っています...'}
          </p>
        )}
      </div>
    </div>
  );
}
