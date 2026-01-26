'use client';

import { useSocket } from '../hooks/useSocket';
import { RoomForm } from '../components/lobby/RoomForm';
import { PlayerList } from '../components/lobby/PlayerList';
import { GameBoard } from '../components/game/GameBoard';

export default function Home() {
  const {
    isConnected,
    isReconnecting,
    room,
    playerId,
    gameState,
    error,
    disconnectedPlayers,
    createRoom,
    joinRoom,
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
    clearError,
  } = useSocket();

  // 再接続中オーバーレイ
  const reconnectingOverlay = isReconnecting && (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
        <p className="text-gray-800 text-lg font-semibold">復帰中...</p>
      </div>
    </div>
  );

  // 接続待ち表示
  if (!isConnected && !isReconnecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-900">
        <div className="text-white text-xl">接続中...</div>
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
