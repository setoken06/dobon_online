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
            {room.oyakoRule && (
              <span className="ml-2 text-purple-600 font-semibold">親子ルール ON</span>
            )}
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

        {/* セッション内の対戦履歴（このルームが残っている間のみ保持） */}
        {room.gameHistory && room.gameHistory.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              対戦履歴 ({room.gameHistory.length}戦)
            </h3>
            <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto space-y-1.5">
              {[...room.gameHistory].reverse().map((entry, i) => {
                const winnerNames = entry.winners.map(w => w.playerName).join(', ');
                const scoreStr = entry.totalScore.toLocaleString();
                const isPositive = entry.totalScore > 0;
                const isNegative = entry.totalScore < 0;
                return (
                  <div
                    key={room.gameHistory!.length - i - 1}
                    className="flex items-center justify-between gap-2 px-3 py-1.5 bg-white rounded text-sm border border-gray-200"
                  >
                    <span className="text-gray-700 truncate flex-1">
                      <span className={`font-semibold ${entry.isWorst ? 'text-red-600' : isPositive ? 'text-green-600' : 'text-gray-600'}`}>
                        {winnerNames}
                      </span>
                      <span className="mx-1 text-gray-400">→</span>
                      <span className="text-gray-700">{entry.loserName ?? '—'}</span>
                    </span>
                    <span className={`font-bold whitespace-nowrap ${
                      entry.isWorst ? 'text-red-600' :
                      isPositive ? 'text-orange-600' :
                      isNegative ? 'text-red-500' : 'text-gray-500'
                    }`}>
                      {isPositive ? '+' : ''}{scoreStr} EVJ
                    </span>
                    <span className="flex gap-1 text-xs">
                      {entry.isDobonGaeshi && <span title="ドボン返し">🔄</span>}
                      {entry.isWorst && <span title="ワースト">💀</span>}
                      {entry.isOnanii && <span title="オナニー">🎊</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
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
