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

  // 復帰可能な場合（部屋に入っていない状態でセッション情報がある）
  if (canRejoin && rejoinInfo && !room) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-900 p-4">
        {reconnectingOverlay}
        <h1 className="text-4xl font-bold text-white mb-8">Dobon Online</h1>
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">ゲームに復帰</h2>
          <p className="text-gray-600 mb-2">
            前回のゲームが見つかりました
          </p>
          <p className="text-gray-800 mb-6">
            ルームID: <span className="font-mono font-bold">{rejoinInfo.roomId}</span>
            <br />
            プレイヤー: <span className="font-bold">{rejoinInfo.playerName}</span>
          </p>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}
          <div className="space-y-3">
            <button
              onClick={rejoinRoom}
              disabled={isReconnecting}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xl font-semibold rounded-lg transition"
            >
              復帰する
            </button>
            <button
              onClick={cancelRejoin}
              disabled={isReconnecting}
              className="w-full py-3 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 font-semibold rounded-lg transition"
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
