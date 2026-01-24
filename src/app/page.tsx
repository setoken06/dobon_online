'use client';

import { useSocket } from '../hooks/useSocket';
import { RoomForm } from '../components/lobby/RoomForm';
import { PlayerList } from '../components/lobby/PlayerList';
import { GameBoard } from '../components/game/GameBoard';

export default function Home() {
  const {
    isConnected,
    room,
    playerId,
    gameState,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    playCards,
    drawCard,
    pass,
    dobon,
    skipDobon,
    backToLobby,
    clearError,
  } = useSocket();

  // 接続待ち表示
  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-900">
        <div className="text-white text-xl">接続中...</div>
      </div>
    );
  }

  // ゲーム中またはゲーム終了（リザルト表示）
  if ((room?.status === 'playing' || room?.status === 'finished') && gameState && playerId) {
    return (
      <GameBoard
        gameState={gameState}
        playerId={playerId}
        onPlayCards={playCards}
        onDrawCard={drawCard}
        onPass={pass}
        onDobon={dobon}
        onSkipDobon={skipDobon}
        onBackToLobby={backToLobby}
      />
    );
  }

  // 待機中
  if (room && playerId) {
    return (
      <PlayerList
        room={room}
        playerId={playerId}
        onStartGame={startGame}
        onLeaveRoom={leaveRoom}
      />
    );
  }

  // ロビー
  return (
    <RoomForm
      onCreateRoom={createRoom}
      onJoinRoom={joinRoom}
      error={error}
      onClearError={clearError}
    />
  );
}
