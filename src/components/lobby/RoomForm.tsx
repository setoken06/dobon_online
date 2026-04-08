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
      <div className="min-h-screen flex flex-col items-center justify-center bg-green-900 p-4">
        <h1 className="text-4xl font-bold text-white mb-8">Dobon Online</h1>
        <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white text-xl font-semibold rounded-lg transition"
            >
              部屋を作る
            </button>
            <button
              onClick={() => setMode('join')}
              className="w-full py-4 bg-green-600 hover:bg-green-700 text-white text-xl font-semibold rounded-lg transition"
            >
              部屋に入る
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-green-900 p-4">
      <h1 className="text-4xl font-bold text-white mb-8">Dobon Online</h1>
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          {mode === 'create' ? '部屋を作る' : '部屋に入る'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 mb-1">
              あなたの名前
            </label>
            <input
              type="text"
              id="playerName"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="名前を入力"
              maxLength={10}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#333]"
            />
          </div>

          <div>
            <label htmlFor="roomId" className="block text-sm font-medium text-gray-700 mb-1">
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest text-[#333]"
            />
          </div>

          {/* マイマーク選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              マイマーク
            </label>
            <div className="flex justify-center gap-2">
              {SUITS.map((suit) => (
                <button
                  key={suit}
                  type="button"
                  onClick={() => setMyMark(suit)}
                  className={`w-14 h-14 text-3xl rounded-lg border-2 transition ${
                    myMark === suit
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  } ${suit === 'hearts' || suit === 'diamonds' ? 'text-red-500' : 'text-gray-800'}`}
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ゲームモード
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGameMode('classic')}
                    className={`flex-1 py-3 rounded-lg border-2 font-semibold transition ${
                      gameMode === 'classic'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-300'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    クラシック
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameMode('uno')}
                    className={`flex-1 py-3 rounded-lg border-2 font-semibold transition ${
                      gameMode === 'uno'
                        ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-300'
                        : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                    }`}
                  >
                    UNO
                  </button>
                </div>
              </div>

              {/* ジョーカー枚数設定（クラシックモードのみ） */}
              {gameMode === 'classic' && (
                <div>
                  <label htmlFor="jokerCount" className="block text-sm font-medium text-gray-700 mb-1">
                    ジョーカーの枚数
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      id="jokerCount"
                      min={0}
                      max={4}
                      value={jokerCount}
                      onChange={(e) => setJokerCount(parseInt(e.target.value, 10))}
                      className="flex-1"
                    />
                    <span className="text-xl font-bold text-gray-800 w-8 text-center">{jokerCount}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">0〜4枚から選択できます</p>
                </div>
              )}

              {/* レート設定 */}
              <div>
                <label htmlFor="rate" className="block text-sm font-medium text-gray-700 mb-1">
                  レート (EVJ)
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
                    className="w-full px-4 py-3 pr-14 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-[#333]"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">EVJ</span>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleBack}
              className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition"
            >
              戻る
            </button>
            <button
              type="submit"
              disabled={roomId.length !== 5 || !playerName.trim()}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition"
            >
              {mode === 'create' ? '作成' : '参加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
