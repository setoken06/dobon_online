'use client';

import { Card, CardBack } from './Card';
import { PlayerGameState } from '../../types/game';

interface OpponentHandProps {
  player: PlayerGameState;
  isCurrentTurn: boolean;
  isDisconnected?: boolean;
}

export function OpponentHand({ player, isCurrentTurn, isDisconnected }: OpponentHandProps) {
  const exposed = player.exposedCards ?? [];
  // 表示は最大7枚。表向き公開カードを優先表示し、残りを裏向きで埋める。
  const exposedShown = exposed.slice(0, 7);
  const backCount = Math.max(0, player.cardCount - exposed.length);
  const backShown = Math.min(backCount, Math.max(0, 7 - exposedShown.length));

  return (
    <div
      className={`
        flex flex-col items-center px-4 py-3 rounded-2xl relative border transition
        ${isCurrentTurn ? 'bg-accent/15 border-accent/40 ring-1 ring-accent/30' : 'bg-white/[0.03] border-white/8'}
        ${player.isReach ? 'border-[#e3b53b]/50' : ''}
        ${isDisconnected ? 'opacity-50' : ''}
      `}
    >
      {/* 離席表示 */}
      {isDisconnected && (
        <div className="absolute -top-2 -left-2 bg-white/15 text-white text-[10px] font-medium px-2 py-0.5 rounded-full backdrop-blur">
          離席
        </div>
      )}
      {/* リーチ表示 */}
      {player.isReach && !isDisconnected && (
        <div className="absolute -top-2 -right-2 bg-[#e3b53b] text-[#15171c] text-[10px] font-bold px-2 py-0.5 rounded-full anim-glow">
          リーチ
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        {isCurrentTurn && !isDisconnected && <span className="w-1.5 h-1.5 rounded-full bg-accent anim-glow" />}
        <span className={`text-sm font-medium ${isDisconnected ? 'text-white/45' : 'text-white'}`}>
          {player.playerName}
        </span>
      </div>
      <div className="flex gap-1">
        {exposedShown.map((c) => (
          <Card key={c.id} card={c} size="sm" disabled />
        ))}
        {Array.from({ length: backShown }).map((_, i) => (
          <CardBack key={`b${i}`} size="sm" />
        ))}
        {player.cardCount > 7 && (
          <span className="text-white/60 text-sm self-center ml-1 tabular-nums">
            +{player.cardCount - 7}
          </span>
        )}
      </div>
      <span className="text-white/55 text-[11px] mt-1.5 tabular-nums">
        {isDisconnected ? '離席中' : isCurrentTurn ? '思考中…' : `${player.cardCount}枚`}
      </span>
    </div>
  );
}
