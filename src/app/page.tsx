'use client';

import { useSocket } from '../hooks/useSocket';
import { RoomForm } from '../components/lobby/RoomForm';
import { PlayerList } from '../components/lobby/PlayerList';
import { GameBoard } from '../components/game/GameBoard';

export default function Home() {
  const {
    isConnected,
    isReconnecting,
    canRejoin,
    rejoinInfo,
    room,
    playerId,
    gameState,
    error,
    disconnectedPlayers,
    createRoom,
    joinRoom,
    rejoinRoom,
    cancelRejoin,
    leaveRoom,
    startGame,
    playCards,
    drawCard,
    pass,
    dobon,
    skipDobon,
    dobonGaeshi,
    skipDobonGaeshi,
    backToLobby,
    confirmInitialRate,
    advanceDobonPhase,
    chooseColor,
    revealLastDrawCard,
    clearError,
  } = useSocket();

  // 復帰中オーバーレイ
  const reconnectingOverlay = isReconnecting && (
    <div className="fixed inset-0 bg-[#0d1015]/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface rounded-2xl elev-lg border border-line p-8 text-center anim-pop">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-accent border-t-transparent mx-auto mb-4"></div>
        <p className="text-ink text-base font-medium">復帰中…</p>
      </div>
    </div>
  );

  // 接続待ち表示
  if (!isConnected && !isReconnecting) {
    return (
      <div className="app-bg min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted">
          <span className="animate-spin rounded-full h-5 w-5 border-2 border-muted/40 border-t-muted"></span>
          <span className="text-sm">接続中…</span>
        </div>
      </div>
    );
  }

  // 復帰可能な場合（部屋に入っていない状態でセッション情報がある）
  if (canRejoin && rejoinInfo && !room) {
    return (
      <div className="app-bg min-h-screen flex flex-col items-center justify-center p-6">
        {reconnectingOverlay}
        <div className="bg-surface rounded-2xl elev border border-line p-7 w-full max-w-sm text-center anim-fade-up">
          <span className="inline-block w-10 h-1 rounded-full bg-accent mb-4" />
          <h2 className="text-lg font-semibold text-ink mb-1 tracking-tight">ゲームに復帰</h2>
          <p className="text-sm text-muted mb-4">前回のゲームが見つかりました</p>
          <div className="rounded-xl border border-line bg-surface-2 p-3 mb-5 text-sm">
            <div className="flex justify-between py-0.5">
              <span className="text-muted">ルームID</span>
              <span className="font-mono font-semibold text-ink tracking-wider">{rejoinInfo.roomId}</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-muted">プレイヤー</span>
              <span className="font-medium text-ink">{rejoinInfo.playerName}</span>
            </div>
          </div>
          {error && (
            <div className="bg-danger-soft border border-danger/30 text-danger px-3.5 py-2.5 rounded-xl mb-4 text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2.5">
            <button
              onClick={rejoinRoom}
              disabled={isReconnecting}
              className="w-full py-3 bg-ink hover:bg-ink-soft disabled:bg-line disabled:text-muted text-white font-medium rounded-xl transition"
            >
              復帰する
            </button>
            <button
              onClick={cancelRejoin}
              disabled={isReconnecting}
              className="w-full py-2.5 bg-surface border border-line hover:bg-surface-2 disabled:opacity-50 text-ink-soft font-medium rounded-xl transition"
            >
              新しく始める
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ゲーム中またはゲーム終了（リザルト表示）
  if ((room?.status === 'playing' || room?.status === 'finished') && gameState && playerId) {
    return (
      <>
        {reconnectingOverlay}
        <GameBoard
          gameState={gameState}
          playerId={playerId}
          isHost={room?.hostId === playerId}
          disconnectedPlayers={disconnectedPlayers}
          onPlayCards={playCards}
          onDrawCard={drawCard}
          onPass={pass}
          onDobon={dobon}
          onSkipDobon={skipDobon}
          onDobonGaeshi={dobonGaeshi}
          onSkipDobonGaeshi={skipDobonGaeshi}
          onBackToLobby={backToLobby}
          onConfirmInitialRate={confirmInitialRate}
          onAdvanceDobonPhase={advanceDobonPhase}
          onChooseColor={chooseColor}
          onRevealLastDrawCard={revealLastDrawCard}
        />
      </>
    );
  }

  // 待機中
  if (room && playerId) {
    return (
      <>
        {reconnectingOverlay}
        <PlayerList
          room={room}
          playerId={playerId}
          disconnectedPlayers={disconnectedPlayers}
          onStartGame={startGame}
          onLeaveRoom={leaveRoom}
        />
      </>
    );
  }

  // ロビー
  return (
    <>
      {reconnectingOverlay}
      <RoomForm
        onCreateRoom={createRoom}
        onJoinRoom={joinRoom}
        error={error}
        onClearError={clearError}
      />
    </>
  );
}
