'use client';

import { Room } from '../../types/room';

interface PlayerListProps {
  room: Room;
  playerId: string;
  disconnectedPlayers: Map<string, string>;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

export function PlayerList({ room, playerId, disconnectedPlayers, onStartGame, onLeaveRoom }: PlayerListProps) {
  const isHost = room.hostId === playerId;
  const canStart = room.players.length >= room.minPlayers;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-green-900 p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">待機中</h2>
          <p className="text-gray-600">
            ルームID: <span className="font-mono text-2xl font-bold">{room.id}</span>
          </p>
          <p className="text-gray-500 text-sm mt-1">
            モード: <span className={`font-semibold ${room.gameMode === 'uno' ? 'text-orange-600' : 'text-blue-600'}`}>
              {room.gameMode === 'uno' ? 'UNO' : 'クラシック'}
            </span>
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">
            プレイヤー ({room.players.length}/{room.maxPlayers})
          </h3>
          <ul className="space-y-2">
            {room.players.map((player) => {
              const isDisconnected = player.isDisconnected || disconnectedPlayers.has(player.id);
              return (
                <li
                  key={player.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-lg ${
                    player.id === playerId
                      ? 'bg-blue-100 border-2 border-blue-500'
                      : isDisconnected
                      ? 'bg-gray-200 opacity-60'
                      : 'bg-gray-100'
                  }`}
                >
                  <span className={`font-medium ${isDisconnected ? 'text-gray-400' : 'text-[#333]'}`}>
                    {player.name}
                    {player.id === playerId && ' (あなた)'}
                    {isDisconnected && ' (離席中)'}
                  </span>
                  <div className="flex gap-2">
                    {isDisconnected && (
                      <span className="text-xs bg-gray-500 text-white px-2 py-1 rounded">
                        離席
                      </span>
                    )}
                    {player.isHost && (
                      <span className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded">
                        ホスト
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {room.players.length < room.minPlayers && (
          <p className="text-center text-gray-500 mb-4">
            あと{room.minPlayers - room.players.length}人で開始できます
          </p>
        )}

        <div className="space-y-3">
          {isHost && (
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-lg font-semibold rounded-lg transition"
            >
              ゲーム開始
            </button>
          )}

          {!isHost && canStart && (
            <p className="text-center text-gray-600">
              ホストがゲームを開始するのを待っています...
            </p>
          )}

          <button
            onClick={onLeaveRoom}
            className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition"
          >
            退出
          </button>
        </div>
      </div>
    </div>
  );
}
