'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { GameState } from '../../types/game';
import { canPlayCard, UnoColor, UNO_COLORS } from '../../types/card';
import { Hand } from './Hand';
import { Deck } from './Deck';
import { DiscardPile } from './DiscardPile';
import { OpponentHand } from './OpponentHand';
import { GameResult } from './GameResult';
import { Card } from './Card';
import { SUIT_SYMBOLS } from '../../types/card';

interface GameBoardProps {
  gameState: GameState;
  playerId: string;
  disconnectedPlayers: Map<string, string>;
  onPlayCards: (cardIds: string[]) => void;
  onDrawCard: () => void;
  onPass: () => void;
  onDobon: () => void;
  onSkipDobon: () => void;
  onDobonGaeshi: () => void;
  onSkipDobonGaeshi: () => void;
  onBackToLobby: () => void;
  onConfirmInitialRate: () => void;
  onAdvanceDobonPhase: () => void;
  onChooseColor?: (color: UnoColor) => void;
  onRevealLastDrawCard?: () => void;
}

export function GameBoard({
  gameState,
  playerId,
  disconnectedPlayers,
  onPlayCards,
  onDrawCard,
  onPass,
  onDobon,
  onSkipDobon,
  onDobonGaeshi,
  onSkipDobonGaeshi,
  onBackToLobby,
  onConfirmInitialRate,
  onAdvanceDobonPhase,
  onChooseColor,
  onRevealLastDrawCard,
}: GameBoardProps) {
  const myPlayer = gameState.players.find((p) => p.playerId === playerId);
  const opponents = gameState.players.filter((p) => p.playerId !== playerId);
  const isMyTurn = gameState.currentPlayerId === playerId;
  const isFinished = gameState.status === 'finished';
  // 複数勝者対応：winnersに自分が含まれているか、または単独勝者が自分か
  const isWinner = gameState.winners
    ? gameState.winners.some(w => w.playerId === playerId)
    : gameState.winnerId === playerId;
  const handCount = myPlayer?.hand?.length ?? 0;

  // 文字演出（ドボン/ツモドボン/ドボン返し）
  const [announcement, setAnnouncement] = useState<string | null>(null);
  const [showDobonDialog, setShowDobonDialog] = useState(false);
  const [prevDobonPhase, setPrevDobonPhase] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (gameState.dobonPhase === 'success' && prevDobonPhase !== 'success') {
      let text = 'ドボン！';
      if (gameState.isDobonGaeshi) {
        text = 'ドボン返し！';
      } else if (gameState.loser?.isTsumoDobon) {
        text = 'ツモドボン！';
      }
      setAnnouncement(text);
      setShowDobonDialog(false);
      const timer = setTimeout(() => {
        setAnnouncement(null);
        setShowDobonDialog(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
    if (gameState.dobonPhase !== 'success') {
      setShowDobonDialog(false);
    }
    setPrevDobonPhase(gameState.dobonPhase);
  }, [gameState.dobonPhase, gameState.isDobonGaeshi, gameState.loser?.isTsumoDobon, prevDobonPhase]);

  // ラストドロー演出（サーバー同期）
  const [lastDrawAnnouncement, setLastDrawAnnouncement] = useState<string | null>(null);
  const [prevRevealedCount, setPrevRevealedCount] = useState(0);
  const [resultDismissed, setResultDismissed] = useState(false);

  // カード公開数が変わったら演出テキスト表示
  useEffect(() => {
    const count = gameState.revealedLastDrawCount || 0;
    if (count > prevRevealedCount && gameState.lastDrawCards && count <= gameState.lastDrawCards.length) {
      const card = gameState.lastDrawCards[count - 1];
      const isWild = card.suit === 'wild' || card.suit === 'joker';
      if (isWild) {
        setLastDrawAnnouncement('×2！');
      } else {
        const value = card.unoSpecial ? 10 : card.rank;
        setLastDrawAnnouncement(`×${value}！`);
      }
      setTimeout(() => setLastDrawAnnouncement(null), 1500);
    }
    setPrevRevealedCount(count);
  }, [gameState.revealedLastDrawCount, gameState.lastDrawCards, prevRevealedCount]);

  // dobonPhase が変わったらリザルト非表示リセット
  useEffect(() => {
    if (!gameState.dobonPhase) {
      setResultDismissed(false);
    }
  }, [gameState.dobonPhase]);

  const isWinnerPlayer = gameState.dobonWinnerPlayerIds?.includes(playerId);
  const revealedCount = gameState.revealedLastDrawCount || 0;
  const allCardsRevealed = gameState.lastDrawCards ? revealedCount >= gameState.lastDrawCards.length : false;

  // ドボン/ドボン返し待機中 or ドボン演出中はアクション不可
  const isWaitingForDobonAction = gameState.isWaitingForDobon || gameState.isWaitingForDobonGaeshi || !!gameState.dobonPhase || !!gameState.isAnyoneDecidingDobon;
  const canDraw = isMyTurn && !gameState.hasDrawnThisTurn && !isWaitingForDobonAction;

  // 選択中のカードID
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  // 出せるカードがあるかどうか
  const hasPlayableCard = useMemo(() => {
    if (!myPlayer?.hand) return false;
    return myPlayer.hand.some((card) => canPlayCard(card, gameState.topCard, gameState.effectiveTopCard));
  }, [myPlayer?.hand, gameState.topCard, gameState.effectiveTopCard]);

  // パス可能かどうか（8枚以上の場合は不可、ドボン待機中は不可）
  // 8枚以上で出せるカードがある場合 → mustPlayCard=true → パス不可
  // 8枚以上で出せるカードがない場合 → 強制ドロー中 → パス不可
  const canPass = isMyTurn && gameState.hasDrawnThisTurn && !gameState.mustPlayCard && !isWaitingForDobonAction && !(handCount >= 8 && !hasPlayableCard);

  // ターンが変わったら選択をリセット
  useEffect(() => {
    setSelectedCardIds([]);
  }, [gameState.currentPlayerId]);

  // 出せるカードがない場合、自動的に1枚引く
  // 8枚以上で出せるカードがない場合も自動で引き続ける
  // ドボン待機中は自動ドローしない
  useEffect(() => {
    if (isMyTurn && gameState.status === 'playing' && !isWaitingForDobonAction) {
      // 出せるカードがない場合
      if (!hasPlayableCard) {
        const timer = setTimeout(() => {
          onDrawCard();
        }, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [isMyTurn, gameState.hasDrawnThisTurn, hasPlayableCard, gameState.status, onDrawCard, handCount, isWaitingForDobonAction]);

  // 出せるカードのIDセット
  const playableCardIds = useMemo(() => {
    if (!myPlayer?.hand) return new Set<string>();
    let playable = myPlayer.hand.filter(card => canPlayCard(card, gameState.topCard, gameState.effectiveTopCard));

    // UNOモード: ワイルド4は他に出せるカードがある場合は使用不可
    if (gameState.gameMode === 'uno') {
      const nonWild4 = playable.filter(card => !card.isWild4);
      if (nonWild4.length > 0) {
        playable = nonWild4;
      }
    }

    return new Set(playable.map(card => card.id));
  }, [myPlayer?.hand, gameState.topCard, gameState.effectiveTopCard, gameState.gameMode]);

  // カード選択ハンドラ
  const handleCardSelect = useCallback((cardId: string) => {
    if (!myPlayer?.hand) return;

    const selectedCard = myPlayer.hand.find(c => c.id === cardId);
    if (!selectedCard) return;

    const isPlayable = playableCardIds.has(cardId);

    setSelectedCardIds(prev => {
      // 既に選択されている場合は解除
      if (prev.includes(cardId)) {
        return prev.filter(id => id !== cardId);
      }

      // 新規選択：出せるカードのみ選択可能
      if (prev.length === 0) {
        if (!isPlayable) return prev; // 出せないカードは選択不可
        return [cardId];
      }

      // 2枚目以降の選択：同じランクのみ許可（最大4枚）
      // ジョーカー/ワイルド/UNO記号カードは1枚ずつ
      const firstCard = myPlayer.hand!.find(c => c.id === prev[0]);
      if (firstCard && firstCard.rank === selectedCard.rank && prev.length < 4
        && !firstCard.isJoker && !firstCard.unoSpecial && firstCard.suit !== 'wild' && firstCard.suit !== 'joker'
        && !selectedCard.isJoker && !selectedCard.unoSpecial && selectedCard.suit !== 'wild' && selectedCard.suit !== 'joker') {
        return [...prev, cardId];
      }

      // 別のランクなら入れ替え（出せるカードのみ）
      if (!isPlayable) return prev;
      return [cardId];
    });
  }, [myPlayer?.hand, playableCardIds]);

  // カードを出す
  const handlePlayCards = useCallback(() => {
    if (selectedCardIds.length > 0) {
      onPlayCards(selectedCardIds);
      setSelectedCardIds([]);
    }
  }, [selectedCardIds, onPlayCards]);

  // 選択中のカードが出せるかチェック
  const canPlaySelected = useMemo(() => {
    if (selectedCardIds.length === 0 || !myPlayer?.hand) return false;
    const selectedCards = selectedCardIds.map(id => myPlayer.hand!.find(c => c.id === id)).filter(Boolean);
    return selectedCards.some(card => card && canPlayCard(card, gameState.topCard, gameState.effectiveTopCard));
  }, [selectedCardIds, myPlayer?.hand, gameState.topCard, gameState.effectiveTopCard]);

  return (
    <div className="min-h-screen bg-green-900 p-4 flex flex-col">
      {/* 結果モーダル（ドボン演出を経由した場合はドボンリザルトフェーズで表示済みなので非表示） */}
      {isFinished && gameState.winnerName && !gameState.winners && (
        <GameResult
          winnerName={gameState.winnerName}
          isWinner={isWinner}
          onBackToLobby={onBackToLobby}
          lastDrawCards={gameState.lastDrawCards}
          finalScore={gameState.finalScore}
          winnerHandCount={gameState.winnerHandCount}
          rate={gameState.rate}
          winners={gameState.winners}
          playerId={playerId}
          loser={gameState.loser}
        />
      )}

      {/* スマホ用: ターン + レート表示（横並び） */}
      <div className="md:hidden flex justify-between items-center mb-2">
        {isMyTurn ? (
          <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full font-bold text-sm animate-pulse">
            あなたのターン
          </div>
        ) : (
          <div className="bg-gray-600 text-white px-3 py-1 rounded-full font-medium text-sm">
            {gameState.players.find((p) => p.playerId === gameState.currentPlayerId)?.playerName} のターン
          </div>
        )}
        <div className="bg-black/50 text-white px-3 py-1 rounded-lg">
          <span className="text-xs">レート</span>
          <span className="ml-1 text-sm font-bold text-yellow-400">{gameState.rate} EVJ</span>
        </div>
      </div>

      {/* PC用: レート表示（右上固定） */}
      <div className="hidden md:block absolute top-4 right-4">
        <div className="bg-black/50 text-white px-4 py-2 rounded-lg">
          <span className="text-sm">レート</span>
          <span className="ml-2 text-xl font-bold text-yellow-400">{gameState.rate} EVJ</span>
        </div>
      </div>

      {/* 初期レートボーナス確認ポップアップ */}
      {gameState.waitingForInitialRateConfirm && gameState.initialRateBonuses && gameState.initialRateBonuses.length > 0 && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-8 shadow-2xl text-center max-w-md">
            <h2 className="text-3xl font-bold text-white mb-4">レートアップ！</h2>
            <div className="bg-white/20 rounded-lg p-4 mb-4">
              {gameState.initialRateBonuses.map((bonus, index) => (
                <div key={index} className="flex items-center justify-center gap-3 mb-3 last:mb-0">
                  <Card card={bonus.card} size="sm" disabled />
                  <div className="text-white text-left">
                    {bonus.type === 'joker' ? (
                      <p className="font-bold">ジョーカー出現！</p>
                    ) : (
                      <p className="font-bold">
                        マイマーク一致！（{SUIT_SYMBOLS[bonus.card.suit]}）
                      </p>
                    )}
                    <p className="text-sm">レート ×{bonus.multiplier}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-white text-2xl font-bold mb-4">
              現在のレート: {gameState.rate} EVJ
            </p>
            {gameState.initialRateConfirmPlayerId === playerId ? (
              <button
                onClick={onConfirmInitialRate}
                className="px-8 py-4 bg-white text-orange-600 font-bold text-xl rounded-lg hover:bg-gray-100 transition transform hover:scale-105"
              >
                確認
              </button>
            ) : (
              <p className="text-white/80">
                {gameState.players.find(p => p.playerId === gameState.initialRateConfirmPlayerId)?.playerName} の確認を待っています...
              </p>
            )}
          </div>
        </div>
      )}

      {/* ワイルド使用後の色選択オーバーレイ */}
      {gameState.waitingForColorChoice && gameState.colorChoicePlayerId === playerId && onChooseColor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">色を選択</h2>
            <div className="grid grid-cols-2 gap-4">
              {UNO_COLORS.map((color) => {
                const colorStyles: Record<string, string> = {
                  red: 'bg-red-500 hover:bg-red-600',
                  blue: 'bg-blue-500 hover:bg-blue-600',
                  yellow: 'bg-yellow-400 hover:bg-yellow-500 text-gray-900',
                  green: 'bg-green-500 hover:bg-green-600',
                };
                const colorLabels: Record<string, string> = {
                  red: '赤', blue: '青', yellow: '黄', green: '緑',
                };
                return (
                  <button
                    key={color}
                    onClick={() => onChooseColor(color)}
                    className={`w-24 h-24 rounded-xl text-white text-2xl font-bold transition transform hover:scale-110 ${colorStyles[color]}`}
                  >
                    {colorLabels[color]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 他プレイヤーの色選択待ち表示 */}
      {gameState.waitingForColorChoice && gameState.colorChoicePlayerId !== playerId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30">
          <div className="bg-white rounded-2xl p-6 shadow-2xl text-center">
            <p className="text-gray-800 text-lg font-semibold">色を選択中...</p>
          </div>
        </div>
      )}

      {/* ドボン可能時のオーバーレイ */}
      {gameState.canDobon && !isFinished && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl p-8 shadow-2xl text-center animate-pulse">
            <h2 className="text-4xl font-bold text-white mb-4">ドボン！</h2>
            <p className="text-white/90 mb-6">場のカードで上がれます</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={onDobon}
                className="px-8 py-4 bg-white text-red-600 font-bold text-xl rounded-lg hover:bg-gray-100 transition transform hover:scale-105"
              >
                ドボン！
              </button>
              <button
                onClick={onSkipDobon}
                className="px-8 py-4 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition"
              >
                スキップ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ドボン返し可能時のオーバーレイ */}
      {gameState.canDobonGaeshi && !isFinished && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="bg-gradient-to-br from-purple-500 to-blue-600 rounded-2xl p-8 shadow-2xl text-center animate-pulse">
            <h2 className="text-4xl font-bold text-white mb-4">ドボン返し！</h2>
            {gameState.dobonPlayerNames && gameState.dobonPlayerNames.length > 1 ? (
              <>
                <p className="text-white/90 mb-2">
                  {gameState.dobonPlayerNames.join(', ')} がドボンしました
                </p>
                <p className="text-white/90 mb-6">
                  ドボン返し！（手札合計: あなた + {gameState.dobonPlayerNames.length}人分）
                </p>
              </>
            ) : (
              <>
                <p className="text-white/90 mb-2">{gameState.dobonPlayerName} がドボンしました</p>
                <p className="text-white/90 mb-6">あなたも同じ数字で上がれます！</p>
              </>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={onDobonGaeshi}
                className="px-8 py-4 bg-white text-purple-600 font-bold text-xl rounded-lg hover:bg-gray-100 transition transform hover:scale-105"
              >
                ドボン返し！
              </button>
              <button
                onClick={onSkipDobonGaeshi}
                className="px-8 py-4 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition"
              >
                スキップ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 文字演出オーバーレイ */}
      {announcement && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-bounce">
            <h1
              className="text-6xl md:text-8xl font-black text-white drop-shadow-[0_0_30px_rgba(255,0,0,0.8)]"
              style={{
                textShadow: '0 0 20px rgba(255,50,50,0.9), 0 0 60px rgba(255,0,0,0.5), 0 4px 8px rgba(0,0,0,0.5)',
                animation: 'announcePulse 0.5s ease-in-out',
              }}
            >
              {announcement}
            </h1>
          </div>
          <style>{`
            @keyframes announcePulse {
              0% { transform: scale(0.3); opacity: 0; }
              50% { transform: scale(1.2); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* ドボン成功フェーズ（文字演出完了後に表示） */}
      {gameState.dobonPhase === 'success' && !isFinished && showDobonDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className={`rounded-2xl p-6 md:p-8 shadow-2xl text-center max-w-lg mx-4 ${
            gameState.isDobonGaeshi
              ? 'bg-gradient-to-br from-purple-500 to-blue-600'
              : 'bg-gradient-to-br from-red-500 to-pink-600'
          }`}>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {gameState.isDobonGaeshi ? 'ドボン返し成功！' : 'ドボン成功！'}
            </h2>
            {gameState.dobonPlayerNames && gameState.dobonPlayerNames.length > 0 && !gameState.isDobonGaeshi && (
              <p className="text-white/90 text-xl mb-2">
                {gameState.dobonPlayerNames.join(', ')}
              </p>
            )}
            {gameState.isDobonGaeshi && gameState.dobonWinnerPlayerIds && (
              <p className="text-white/90 text-xl mb-2">
                {gameState.players.find(p => p.playerId === gameState.dobonWinnerPlayerIds![0])?.playerName}
              </p>
            )}
            {gameState.loser && (
              <p className="text-white/80 mb-4">
                {gameState.loser.isTsumoDobon ? 'ツモドボン' : `${gameState.loser.playerName} をドボン`}
              </p>
            )}
            {/* 勝者の手札を表示 */}
            {gameState.dobonWinnerPlayerIds && gameState.dobonWinnerPlayerIds.map(winnerId => {
              const winnerPlayer = gameState.players.find(p => p.playerId === winnerId);
              return winnerPlayer?.hand && (
                <div key={winnerId} className="mb-4">
                  <p className="text-white/80 text-sm mb-2">{winnerPlayer.playerName} の手札</p>
                  <div className="flex justify-center gap-1 flex-wrap">
                    {winnerPlayer.hand.map(card => (
                      <Card key={card.id} card={card} size="sm" disabled />
                    ))}
                  </div>
                </div>
              );
            })}
            {gameState.dobonWinnerPlayerIds?.includes(playerId) ? (
              <button
                onClick={onAdvanceDobonPhase}
                className="px-8 py-4 bg-white text-gray-800 font-bold text-xl rounded-lg hover:bg-gray-100 transition transform hover:scale-105"
              >
                次へ
              </button>
            ) : (
              <p className="text-white/70 animate-pulse">待機中...</p>
            )}
          </div>
        </div>
      )}

      {/* ラストドローフェーズ */}
      {gameState.dobonPhase === 'lastDraw' && !isFinished && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-30">
          <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-2xl p-8 shadow-2xl text-center max-w-lg">
            <h2 className="text-4xl font-bold text-white mb-4">ラストドロー</h2>
            {/* 勝者の手札を表示 */}
            {gameState.dobonWinnerPlayerIds && gameState.dobonWinnerPlayerIds.map(winnerId => {
              const winnerPlayer = gameState.players.find(p => p.playerId === winnerId);
              return winnerPlayer?.hand && (
                <div key={winnerId} className="mb-4">
                  <p className="text-white/80 text-sm mb-2">{winnerPlayer.playerName} の手札</p>
                  <div className="flex justify-center gap-2 flex-wrap">
                    {winnerPlayer.hand.map(card => (
                      <Card key={card.id} card={card} size="sm" disabled />
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="text-white/90 mb-6">山札からカードを引いてスコアを決定します</p>
            {gameState.dobonWinnerPlayerIds?.includes(playerId) ? (
              <button
                onClick={onAdvanceDobonPhase}
                className="px-8 py-4 bg-white text-orange-600 font-bold text-xl rounded-lg hover:bg-gray-100 transition transform hover:scale-105"
              >
                ドロー！
              </button>
            ) : (
              <p className="text-white/70 animate-pulse">待機中...</p>
            )}
          </div>
        </div>
      )}

      {/* ラストドロー演出（カードめくり・サーバー同期） */}
      {gameState.dobonPhase === 'result' && gameState.lastDrawCards && !allCardsRevealed && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-6">ラストドロー</h2>
            <div className="flex justify-center gap-6 flex-wrap mb-6">
              {gameState.lastDrawCards.map((card, index) => (
                <div key={index}
                  className={isWinnerPlayer && index === revealedCount ? 'cursor-pointer' : ''}
                  onClick={() => isWinnerPlayer && index === revealedCount && onRevealLastDrawCard?.()}
                >
                  {index < revealedCount ? (
                    <div className="animate-bounce">
                      <Card card={card} size="lg" disabled />
                    </div>
                  ) : (
                    <div className={`w-24 h-36 bg-blue-800 rounded-xl border-2 border-blue-900 shadow-lg flex items-center justify-center ${
                      isWinnerPlayer && index === revealedCount ? 'animate-pulse hover:border-yellow-400 cursor-pointer' : 'opacity-50'
                    }`}>
                      <div className="w-3/4 h-3/4 bg-blue-700 rounded-lg border border-blue-600 flex items-center justify-center">
                        <span className="text-blue-400 text-4xl">?</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* めくり演出テキスト */}
            {lastDrawAnnouncement && (
              <div className="animate-bounce">
                <span className="text-5xl font-black text-yellow-300 drop-shadow-[0_0_20px_rgba(255,200,0,0.8)]"
                  style={{ textShadow: '0 0 20px rgba(255,200,0,0.9), 0 4px 8px rgba(0,0,0,0.5)' }}>
                  {lastDrawAnnouncement}
                </span>
              </div>
            )}
            {!lastDrawAnnouncement && revealedCount === 0 && isWinnerPlayer && (
              <p className="text-white/70">カードをタップしてめくってください</p>
            )}
            {!lastDrawAnnouncement && revealedCount === 0 && !isWinnerPlayer && (
              <p className="text-white/70 animate-pulse">ドロー中...</p>
            )}
          </div>
        </div>
      )}

      {/* ドボンリザルトフェーズ（全カード公開後） */}
      {gameState.dobonPhase === 'result' && gameState.winners && allCardsRevealed && !resultDismissed && (
        <GameResult
          winnerName={gameState.winners[0]?.playerName || ''}
          isWinner={gameState.winners.some(w => w.playerId === playerId)}
          onBackToLobby={() => { setResultDismissed(true); onAdvanceDobonPhase(); setTimeout(onBackToLobby, 300); }}
          lastDrawCards={gameState.lastDrawCards}
          finalScore={gameState.finalScore}
          winnerHandCount={gameState.winnerHandCount}
          rate={gameState.rate}
          winners={gameState.winners}
          playerId={playerId}
          loser={gameState.loser}
          dobonWinnerPlayerIds={gameState.dobonWinnerPlayerIds}
          dobonTriggerCard={gameState.dobonTriggerCard}
          winnerPlayers={gameState.dobonWinnerPlayerIds
            ?.map(id => gameState.players.find(p => p.playerId === id))
            .filter((p): p is typeof gameState.players[0] => !!p)}
        />
      )}

      {/* ターン表示（PC用・中央配置） */}
      <div className="hidden md:block text-center mb-4">
        {isMyTurn ? (
          <div className="inline-block bg-yellow-400 text-yellow-900 px-6 py-2 rounded-full font-bold text-lg animate-pulse">
            あなたのターン
          </div>
        ) : (
          <div className="inline-block bg-gray-600 text-white px-6 py-2 rounded-full font-medium">
            {gameState.players.find((p) => p.playerId === gameState.currentPlayerId)?.playerName} のターン
          </div>
        )}
      </div>

      {/* 相手プレイヤー */}
      <div className="flex flex-wrap justify-center gap-4 mb-6">
        {opponents.map((opponent) => (
          <OpponentHand
            key={opponent.playerId}
            player={opponent}
            isCurrentTurn={gameState.currentPlayerId === opponent.playerId}
            isDisconnected={disconnectedPlayers.has(opponent.playerId)}
          />
        ))}
      </div>

      {/* 場の中央（山札と場札） */}
      <div className="flex-1 flex items-center justify-center gap-8 mb-6">
        <Deck count={gameState.deckCount} onDraw={onDrawCard} canDraw={canDraw && hasPlayableCard} />
        <DiscardPile topCard={gameState.topCard} effectiveTopCard={gameState.effectiveTopCard} />
      </div>

      {/* アクションボタン */}
      {isMyTurn && !isWaitingForDobonAction && (
        <div className="flex flex-col items-center gap-3 mb-4">
          <div className="flex justify-center gap-4">
            {/* 選択したカードを出すボタン */}
            {selectedCardIds.length > 0 && canPlaySelected && (
              <button
                onClick={handlePlayCards}
                className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition"
              >
                {selectedCardIds.length === 1 ? 'カードを出す' : `${selectedCardIds.length}枚出す`}
              </button>
            )}
            {/* カードを引いていない場合：カードを引くボタン */}
            {!gameState.hasDrawnThisTurn && hasPlayableCard && (
              <button
                onClick={onDrawCard}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition"
              >
                カードを引く
              </button>
            )}
            {/* カードを引いた後：パスボタン（8枚以上で出せるカードがある場合は非表示） */}
            {canPass && (
              <button
                onClick={onPass}
                className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition"
              >
                パス
              </button>
            )}
          </div>
          {/* 状態メッセージ */}
          {gameState.mustPlayCard && (
            <span className="text-red-400 text-center font-bold">
              手札が8枚以上です。カードを出してください（パス不可）
            </span>
          )}
          {gameState.hasDrawnThisTurn && !gameState.mustPlayCard && (
            <span className="text-yellow-300 text-center">
              カードを引きました。出せるカードがあれば出すか、パスしてください
            </span>
          )}
          {!gameState.hasDrawnThisTurn && !hasPlayableCard && (
            <span className="text-yellow-300 text-center animate-pulse">
              出せるカードがありません。自動でカードを引いています...
            </span>
          )}
          {!gameState.hasDrawnThisTurn && hasPlayableCard && !gameState.mustPlayCard && (
            <span className="text-yellow-300 text-center">
              カードを選択してください（同じ数字は4枚まで同時に出せます）
            </span>
          )}
        </div>
      )}

      {/* 自分の手札 */}
      <div className="relative">
        {/* 自分のリーチ状態と待ち数字表示 */}
        {myPlayer?.isReach && !gameState.canDobon && !isFinished && (
          <div className="flex justify-center items-center gap-4 mb-2">
            <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full font-bold shadow-lg animate-pulse">
              リーチ中！
            </div>
            {gameState.winningNumbers && gameState.winningNumbers.length > 0 && (
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold shadow-lg">
                待ち: {gameState.winningNumbers.sort((a, b) => a - b).map(n => {
                  if (n === -1) return 'ドロー2';
                  if (n === -2) return 'スキップ';
                  if (n === -3) return 'リバース';
                  return String(n);
                }).join(', ')}
              </div>
            )}
          </div>
        )}
        {myPlayer?.hand && (
          <Hand
            cards={myPlayer.hand}
            topCard={gameState.topCard}
            isMyTurn={isMyTurn}
            hasDrawn={gameState.hasDrawnThisTurn}
            selectedCardIds={selectedCardIds}
            playableCardIds={playableCardIds}
            onCardSelect={handleCardSelect}
          />
        )}
      </div>
    </div>
  );
}
