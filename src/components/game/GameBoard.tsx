'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { GameState } from '../../types/game';
import { canPlayCard } from '../../types/card';
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

  // ドボン/ドボン返し待機中はアクション不可
  const isWaitingForDobonAction = gameState.isWaitingForDobon || gameState.isWaitingForDobonGaeshi;
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
    return new Set(
      myPlayer.hand
        .filter(card => canPlayCard(card, gameState.topCard, gameState.effectiveTopCard))
        .map(card => card.id)
    );
  }, [myPlayer?.hand, gameState.topCard, gameState.effectiveTopCard]);

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
      const firstCard = myPlayer.hand!.find(c => c.id === prev[0]);
      if (firstCard && firstCard.rank === selectedCard.rank && prev.length < 4) {
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
      {/* 結果モーダル */}
      {isFinished && gameState.winnerName && (
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
                待ち: {gameState.winningNumbers.sort((a, b) => a - b).join(', ')}
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
