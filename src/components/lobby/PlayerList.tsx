'use client';

import { Room, GameHistoryEntry } from '../../types/room';

interface PlayerListProps {
  room: Room;
  playerId: string;
  disconnectedPlayers: Map<string, string>;
  onStartGame: () => void;
  onLeaveRoom: () => void;
}

// 対戦履歴からプレイヤー間の純フロー（個人間総合成績）を算出
// - 同じ A→B が複数あれば加算
// - A→B と B→A は相殺
// - 異なるペア（A→B と A→C）は別カウント
function computePairSummary(history: GameHistoryEntry[]): { from: string; to: string; net: number }[] {
  const pairs = new Map<string, { playerA: string; playerB: string; netAtoB: number }>();

  // winner が loser から amount を受け取る関係を加算
  const addFlow = (winnerName: string, loserName: string, amount: number) => {
    if (winnerName === loserName || amount === 0) return;
    const sorted = [winnerName, loserName].sort();
    const key = `${sorted[0]}\u0000${sorted[1]}`;
    // winner が playerA(辞書順小) なら + amount、playerB なら - amount
    const delta = winnerName === sorted[0] ? amount : -amount;
    const cur = pairs.get(key) ?? { playerA: sorted[0], playerB: sorted[1], netAtoB: 0 };
    cur.netAtoB += delta;
    pairs.set(key, cur);
  };

  for (const entry of history) {
    if (entry.isOnanii) {
      // オナニー上がり: 敗者が一人に定まらないため、勝者の額を勝者以外の
      // 参加者全員で均等に負担する（2人なら相手1人が全額負担）。
      const names = entry.playerNames;
      if (!names || names.length < 2) continue; // 参加者不明（旧データ等）はスキップ
      for (const winner of entry.winners) {
        const others = names.filter(n => n !== winner.playerName);
        if (others.length === 0) continue;
        const share = winner.score / others.length;
        for (const other of others) addFlow(winner.playerName, other, share);
      }
      continue;
    }
    if (!entry.loserName) continue;
    for (const winner of entry.winners) {
      addFlow(winner.playerName, entry.loserName, winner.score);
    }
  }

  const out: { from: string; to: string; net: number }[] = [];
  for (const { playerA, playerB, netAtoB } of pairs.values()) {
    if (netAtoB > 0) out.push({ from: playerA, to: playerB, net: netAtoB });
    else if (netAtoB < 0) out.push({ from: playerB, to: playerA, net: -netAtoB });
    // 完全に相殺された(0)ペアは省略
  }
  // 移動額の大きい順
  out.sort((a, b) => b.net - a.net);
  return out;
}

export function PlayerList({ room, playerId, disconnectedPlayers, onStartGame, onLeaveRoom }: PlayerListProps) {
  const isHost = room.hostId === playerId;
  const canStart = room.players.length >= room.minPlayers;
  const pairSummary = room.gameHistory ? computePairSummary(room.gameHistory) : [];

  const hasHistory = !!(room.gameHistory && room.gameHistory.length > 0);
  const hasStats = pairSummary.length > 0 || hasHistory;

  return (
    <div className="app-bg min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-3xl anim-fade-up">
        {/* ヘッダー: ルームID + モード */}
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="flex items-baseline gap-3">
            <span className="text-[11px] tracking-[0.3em] text-muted font-medium">ROOM</span>
            <span className="font-mono text-2xl font-semibold tracking-[0.2em] text-ink">{room.id}</span>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-accent-soft text-accent-ink">
            {room.gameMode === 'uno' ? 'UNO' : 'クラシック'}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 items-start">
          {/* ===== 左: プレイヤー + 操作 ===== */}
          <div className="bg-surface rounded-2xl elev border border-line p-5 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-ink-soft">プレイヤー</h3>
              <span className="text-xs text-muted tabular-nums">{room.players.length} / {room.maxPlayers}</span>
            </div>
            <ul className="space-y-1.5">
              {room.players.map((player) => {
                const isDisconnected = player.isDisconnected || disconnectedPlayers.has(player.id);
                const initial = player.name.trim().charAt(0) || '?';
                return (
                  <li
                    key={player.id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition ${
                      player.id === playerId
                        ? 'bg-accent-soft border-accent/30'
                        : isDisconnected
                        ? 'bg-surface-2 border-line opacity-60'
                        : 'bg-surface-2 border-line'
                    }`}
                  >
                    <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
                      player.id === playerId ? 'bg-accent text-white' : 'bg-white border border-line text-ink-soft'
                    }`}>
                      {initial}
                    </span>
                    <span className={`flex-1 font-medium text-sm ${isDisconnected ? 'text-muted' : 'text-ink'}`}>
                      {player.name}
                      {player.id === playerId && <span className="text-muted font-normal"> (あなた)</span>}
                      {isDisconnected && <span className="text-muted font-normal"> (離席中)</span>}
                    </span>
                    <div className="flex gap-1.5">
                      {isDisconnected && (
                        <span className="text-[10px] bg-line text-ink-soft px-2 py-0.5 rounded-full font-medium">離席</span>
                      )}
                      {player.isHost && (
                        <span className="text-[10px] bg-gold/15 text-gold px-2 py-0.5 rounded-full font-medium">ホスト</span>
                      )}
                    </div>
                  </li>
                );
              })}
              {/* 空席プレースホルダ */}
              {Array.from({ length: Math.max(0, room.maxPlayers - room.players.length) }).map((_, i) => (
                <li key={`empty-${i}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-line">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full border border-dashed border-line text-muted/50 text-xs">＋</span>
                  <span className="flex-1 text-sm text-muted/60">空席</span>
                </li>
              ))}
            </ul>

            {room.players.length < room.minPlayers && (
              <p className="text-center text-muted text-sm mt-4">
                あと{room.minPlayers - room.players.length}人で開始できます
              </p>
            )}

            <div className="space-y-2.5 mt-5">
              {isHost && (
                <button
                  onClick={onStartGame}
                  disabled={!canStart}
                  className="w-full py-3 bg-ink hover:bg-ink-soft disabled:bg-line disabled:text-muted disabled:cursor-not-allowed text-white font-medium rounded-xl transition"
                >
                  ゲーム開始
                </button>
              )}
              {!isHost && canStart && (
                <p className="text-center text-muted text-sm py-1">
                  ホストの開始を待っています…
                </p>
              )}
              <button
                onClick={onLeaveRoom}
                className="w-full py-2.5 bg-surface border border-line hover:bg-danger-soft hover:border-danger/30 hover:text-danger text-ink-soft font-medium rounded-xl transition"
              >
                退出
              </button>
            </div>
          </div>

          {/* ===== 右: 成績 + 履歴 ===== */}
          <div className="bg-surface rounded-2xl elev border border-line p-5 md:p-6 md:self-stretch">
            {!hasStats && (
              <div className="flex flex-col items-center justify-center text-center py-10 h-full">
                <span className="text-2xl text-muted/40 mb-2">♠</span>
                <p className="text-sm text-muted">まだ対戦履歴がありません</p>
                <p className="text-xs text-muted/60 mt-1">ゲームを終えると成績がここに表示されます</p>
              </div>
            )}

            {pairSummary.length > 0 && (
              <div className="mb-5">
                <h3 className="text-sm font-semibold text-ink-soft mb-2.5">総合成績</h3>
                <div className="rounded-xl border border-line bg-surface-2 p-2 space-y-1">
                  {pairSummary.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 px-3 py-2 bg-surface rounded-lg text-sm border border-line"
                    >
                      <span className="truncate flex-1">
                        <span className="font-medium text-ink">{p.from}</span>
                        <span className="mx-1.5 text-muted">→</span>
                        <span className="text-muted">{p.to}</span>
                      </span>
                      <span className="font-semibold whitespace-nowrap text-accent-ink tabular-nums">
                        {p.net.toLocaleString()} EVJ
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasHistory && (
              <div>
                <h3 className="text-sm font-semibold text-ink-soft mb-2.5">
                  対戦履歴 <span className="text-muted font-normal">({room.gameHistory!.length}戦)</span>
                </h3>
                <div className="rounded-xl border border-line bg-surface-2 p-2 max-h-72 overflow-y-auto scroll-soft space-y-1">
                  {[...room.gameHistory!].reverse().map((entry, i) => {
                    const winnerNames = entry.winners.map(w => w.playerName).join(', ');
                    const scoreStr = entry.totalScore.toLocaleString();
                    const isPositive = entry.totalScore > 0;
                    return (
                      <div
                        key={room.gameHistory!.length - i - 1}
                        className="flex items-center justify-between gap-2 px-3 py-2 bg-surface rounded-lg text-sm border border-line"
                      >
                        <span className="truncate flex-1">
                          <span className={`font-medium ${entry.isWorst ? 'text-danger' : 'text-ink'}`}>
                            {winnerNames}
                          </span>
                          <span className="mx-1.5 text-muted">→</span>
                          <span className="text-muted">{entry.isOnanii ? '全員' : (entry.loserName ?? '—')}</span>
                        </span>
                        <span className={`font-semibold whitespace-nowrap tabular-nums ${
                          entry.isWorst ? 'text-danger' : isPositive ? 'text-accent-ink' : 'text-muted'
                        }`}>
                          {isPositive ? '+' : ''}{scoreStr}
                        </span>
                        <span className="flex gap-1">
                          {entry.isDobonGaeshi && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 border border-line text-muted">返し</span>}
                          {entry.isWorst && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-danger-soft border border-danger/20 text-danger">ワースト</span>}
                          {entry.isOnanii && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 border border-line text-muted">単</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
