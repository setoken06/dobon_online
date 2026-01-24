'use client';

import { CardBack } from './Card';
import { PlayerGameState } from '../../types/game';

interface OpponentHandProps {
  player: PlayerGameState;
  isCurrentTurn: boolean;
}

export function OpponentHand({ player, isCurrentTurn }: OpponentHandProps) {
  return (
    <div
      className={`
        flex flex-col items-center p-3 rounded-lg relative
        ${isCurrentTurn ? 'bg-yellow-500/30 ring-2 ring-yellow-400' : 'bg-green-800/50'}
        ${player.isReach ? 'ring-2 ring-red-500' : ''}
      `}
    >
      {/* リーチ表示 */}
      {player.isReach && (
        <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
          リーチ
        </div>
      )}
      <span className={`text-sm font-semibold mb-2 ${isCurrentTurn ? 'text-yellow-300' : 'text-white'}`}>
        {player.playerName}
        {isCurrentTurn && ' (思考中...)'}
      </span>
      <div className="flex gap-1">
        {Array.from({ length: Math.min(player.cardCount, 7) }).map((_, i) => (
          <CardBack key={i} size="sm" />
        ))}
        {player.cardCount > 7 && (
          <span className="text-white text-sm self-center ml-1">
            +{player.cardCount - 7}
          </span>
        )}
      </div>
      <span className="text-white/70 text-xs mt-1">{player.cardCount}枚</span>
    </div>
  );
}
