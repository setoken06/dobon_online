'use client';

import { useState, useEffect } from 'react';
import { DEFAULT_ROOM_CONFIG } from '../../types/room';
import { Suit, SUIT_SYMBOLS, GameMode } from '../../types/card';

const STORAGE_KEYS = {
  playerName: 'dobon_playerName',
  roomId: 'dobon_roomId',
  jokerCount: 'dobon_jokerCount',
  rate: 'dobon_rate',
  myMark: 'dobon_myMark',
  gameMode: 'dobon_gameMode',
};

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

interface RoomFormProps {
  onCreateRoom: (roomId: string, playerName: string, jokerCount: number, rate: number, myMark: Suit, gameMode: GameMode) => void;
  onJoinRoom: (roomId: string, playerName: string, myMark: Suit) => void;
  error: string | null;
  onClearError: () => void;
}

export function RoomForm({ onCreateRoom, onJoinRoom, error, onClearError }: RoomFormProps) {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [jokerCount, setJokerCount] = useState(DEFAULT_ROOM_CONFIG.jokerCount);
  const [rate, setRate] = useState(DEFAULT_ROOM_CONFIG.rate);
  const [myMark, setMyMark] = useState<Suit>('hearts');
  const [gameMode, setGameMode] = useState<GameMode>(DEFAULT_ROOM_CONFIG.gameMode);

  // ローカルストレージから読み込み
  useEffect(() => {
    const savedName = localStorage.getItem(STORAGE_KEYS.playerName);
    const savedRoomId = localStorage.getItem(STORAGE_KEYS.roomId);
    const savedJokerCount = localStorage.getItem(STORAGE_KEYS.jokerCount);
    const savedRate = localStorage.getItem(STORAGE_KEYS.rate);
    const savedMyMark = localStorage.getItem(STORAGE_KEYS.myMark);
    const savedGameMode = localStorage.getItem(STORAGE_KEYS.gameMode);
    if (savedName) setPlayerName(savedName);
    if (savedRoomId) setRoomId(savedRoomId);
    if (savedJokerCount) {
      const parsed = parseInt(savedJokerCount, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 4) {
        setJokerCount(parsed);
      }
    }
    if (savedRate) {
      const parsed = parseInt(savedRate, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setRate(parsed);
      }
    }
    if (savedMyMark && SUITS.includes(savedMyMark as Suit)) {
      setMyMark(savedMyMark as Suit);
    }
    if (savedGameMode && (savedGameMode === 'classic' || savedGameMode === 'uno')) {
      setGameMode(savedGameMode as GameMode);
    }
  }, []);

  // 名前が変更されたらローカルストレージに保存
  useEffect(() => {
    if (playerName) {
      localStorage.setItem(STORAGE_KEYS.playerName, playerName);
    }
  }, [playerName]);

  // ルームIDが変更されたらローカルストレージに保存
  useEffect(() => {
    if (roomId) {
      localStorage.setItem(STORAGE_KEYS.roomId, roomId);
    }
  }, [roomId]);

  // ジョーカー枚数が変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.jokerCount, jokerCount.toString());
  }, [jokerCount]);

  // レートが変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.rate, rate.toString());
  }, [rate]);

  // マイマークが変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.myMark, myMark);
  }, [myMark]);

  // ゲームモードが変更されたらローカルストレージに保存
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.gameMode, gameMode);
  }, [gameMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomId.match(/^\d{5}$/)) {
      alert('ルームIDは5桁の数字で入力してください');
      return;
    }

    if (!playerName.trim()) {
      alert('名前を入力してください');
      return;
    }

    if (mode === 'create') {
      onCreateRoom(roomId, playerName.trim(), jokerCount, rate, myMark, gameMode);
    } else if (mode === 'join') {
      onJoinRoom(roomId, playerName.trim(), myMark);
    }
  };

  const handleBack = () => {
    setMode('select');
    setRoomId('');
    onClearError();
  };

  if (mode === 'select') {
    return (
      <div className="app-bg min-h-screen flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm anim-fade-up">
          <Brand />
          <div className="bg-surface rounded-2xl elev border border-line p-7 mt-9">
            <div className="space-y-3">
              <button
                onClick={() => setMode('create')}
                className="group w-full flex items-center justify-between px-5 py-4 bg-ink hover:bg-ink-soft text-white rounded-xl font-medium transition-colors"
              >
                <span>部屋を作る</span>
                <span className="text-white/40 group-hover:translate-x-0.5 transition-transform">→</span>
              </button>
              <button
                onClick={() => setMode('join')}
                className="group w-full flex items-center justify-between px-5 py-4 bg-surface hover:bg-surface-2 text-ink border border-line rounded-xl font-medium transition-colors"
              >
                <span>部屋に入る</span>
                <span className="text-muted group-hover:translate-x-0.5 transition-transform">→</span>
              </button>
            </div>
          </div>
          <p className="text-center text-muted text-xs mt-6 tracking-wide">オンラインでドボンを楽しもう</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-bg min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm anim-fade-up">
        <Brand />
        <div className="bg-surface rounded-2xl elev border border-line p-7 mt-8">
          <div className="flex items-center gap-2 mb-6">
            <span className={`w-1.5 h-5 rounded-full ${mode === 'create' ? 'bg-accent' : 'bg-ink'}`} />
            <h2 className="text-lg font-semibold text-ink tracking-tight">
              {mode === 'create' ? '部屋を作る' : '部屋に入る'}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="playerName" className="block text-xs font-medium text-muted mb-1.5">
                あなたの名前
              </label>
              <input
                type="text"
                id="playerName"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="名前を入力"
                maxLength={10}
                className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-xl text-ink placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition"
              />
            </div>

            <div>
              <label htmlFor="roomId" className="block text-xs font-medium text-muted mb-1.5">
                ルームID（5桁の数字）
              </label>
              <input
                type="text"
                id="roomId"
                value={roomId}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9]/g, '').slice(0, 5);
                  setRoomId(value);
                }}
                placeholder="12345"
                maxLength={5}
                className="w-full px-4 py-2.5 bg-surface-2 border border-line rounded-xl text-center text-2xl font-mono tracking-[0.4em] text-ink placeholder:text-muted/50 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition"
              />
            </div>

            {/* マイマーク選択 */}
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">
                マイマーク
              </label>
              <div className="grid grid-cols-4 gap-2">
                {SUITS.map((suit) => (
                  <button
                    key={suit}
                    type="button"
                    onClick={() => setMyMark(suit)}
                    className={`h-12 text-2xl rounded-xl border transition ${
                      myMark === suit
                        ? 'border-accent bg-accent-soft ring-2 ring-accent/15'
                        : 'border-line bg-surface-2 hover:border-muted/40'
                    } ${suit === 'hearts' || suit === 'diamonds' ? 'text-[#d8434a]' : 'text-ink'}`}
                  >
                    {SUIT_SYMBOLS[suit]}
                  </button>
                ))}
              </div>
            </div>

            {/* 部屋作成時のみの設定 */}
            {mode === 'create' && (
              <>
                {/* ゲームモード選択 */}
                <div>
                  <label className="block text-xs font-medium text-muted mb-1.5">
                    ゲームモード
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setGameMode('classic')}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition ${
                        gameMode === 'classic'
                          ? 'border-accent bg-accent-soft text-accent-ink ring-2 ring-accent/15'
                          : 'border-line bg-surface-2 text-muted hover:border-muted/40'
                      }`}
                    >
                      クラシック
                    </button>
                    <button
                      type="button"
                      onClick={() => setGameMode('uno')}
                      className={`py-2.5 rounded-xl border text-sm font-medium transition ${
                        gameMode === 'uno'
                          ? 'border-accent bg-accent-soft text-accent-ink ring-2 ring-accent/15'
                          : 'border-line bg-surface-2 text-muted hover:border-muted/40'
                      }`}
                    >
                      UNO
                    </button>
                  </div>
                </div>

                {/* ジョーカー枚数設定（クラシックモードのみ） */}
                {gameMode === 'classic' && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="jokerCount" className="text-xs font-medium text-muted">
                        ジョーカーの枚数
                      </label>
                      <span className="text-sm font-semibold text-ink tabular-nums">{jokerCount}</span>
                    </div>
                    <input
                      type="range"
                      id="jokerCount"
                      min={0}
                      max={4}
                      value={jokerCount}
                      onChange={(e) => setJokerCount(parseInt(e.target.value, 10))}
                      className="w-full accent-[var(--color-accent)]"
                    />
                  </div>
                )}

                {/* レート設定 */}
                <div>
                  <label htmlFor="rate" className="block text-xs font-medium text-muted mb-1.5">
                    レート
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      id="rate"
                      min={1}
                      value={rate}
                      onChange={(e) => {
                        const value = parseInt(e.target.value, 10);
                        if (!isNaN(value) && value > 0) {
                          setRate(value);
                        }
                      }}
                      className="w-full px-3.5 py-2.5 pr-14 bg-surface-2 border border-line rounded-xl text-ink focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-muted font-medium">EVJ</span>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="bg-danger-soft border border-danger/30 text-danger px-3.5 py-2.5 rounded-xl text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleBack}
                className="px-5 py-2.5 bg-surface border border-line hover:bg-surface-2 text-ink-soft font-medium rounded-xl transition"
              >
                戻る
              </button>
              <button
                type="submit"
                disabled={roomId.length !== 5 || !playerName.trim()}
                className="flex-1 py-2.5 bg-ink hover:bg-ink-soft disabled:bg-line disabled:text-muted disabled:cursor-not-allowed text-white font-medium rounded-xl transition"
              >
                {mode === 'create' ? '作成する' : '参加する'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div className="text-center">
      <div className="inline-flex items-center gap-2.5">
        <span className="flex gap-0.5 text-2xl leading-none">
          <span className="text-ink">♠</span>
          <span className="text-[#d8434a]">♥</span>
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Dobon</h1>
      </div>
      <p className="text-[11px] tracking-[0.35em] text-muted mt-1.5 font-medium">O N L I N E</p>
    </div>
  );
}
