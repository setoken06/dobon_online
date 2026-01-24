import { Suit } from './card';

// マイマーク（プレイヤーが選択するマーク）
export type MyMark = Suit;

// プレイヤー
export interface Player {
  id: string;          // Socket ID
  name: string;
  isHost: boolean;
  myMark?: MyMark;     // マイマーク
}

// 部屋の状態
export type RoomStatus = 'waiting' | 'playing' | 'finished';

// 部屋
export interface Room {
  id: string;           // 5桁のルームID
  status: RoomStatus;
  players: Player[];
  hostId: string;
  maxPlayers: number;
  minPlayers: number;
  jokerCount: number;   // ジョーカーの枚数（0-4）
  rate: number;         // レート
}

// 部屋作成時のデフォルト設定
export const DEFAULT_ROOM_CONFIG = {
  maxPlayers: 4,
  minPlayers: 2,
  jokerCount: 2,
  rate: 100,
};
