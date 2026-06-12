import { Suit, GameMode } from './card';

// マイマーク（プレイヤーが選択するマーク）
export type MyMark = Suit;

// プレイヤー
export interface Player {
  id: string;          // Socket ID
  sessionId: string;   // 再接続用のセッションID
  name: string;
  isHost: boolean;
  myMark?: MyMark;     // マイマーク
  isDisconnected?: boolean;  // 切断中フラグ
}

// 部屋の状態
export type RoomStatus = 'waiting' | 'playing' | 'finished';

// セッション内の対戦履歴エントリ（部屋の生存期間のみ保持）
export interface GameHistoryEntry {
  winners: { playerName: string; score: number }[];  // 勝者一覧（ダブルドボン対応）
  loserName: string | null;                          // 敗者名（オナニーや該当なしの場合は null）
  totalScore: number;                                // 勝者スコアの合計（=敗者の損失）
  timestamp: number;                                 // Date.now()
  playerNames?: string[];                            // 参加者全員の名前（オナニー時の按分計算用）
  isDobonGaeshi?: boolean;
  isWorst?: boolean;
  isOnanii?: boolean;
}

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
  gameMode: GameMode;   // ゲームモード
  gameHistory?: GameHistoryEntry[];  // セッション内の対戦履歴（永続化なし）
}

// 部屋作成時のデフォルト設定
export const DEFAULT_ROOM_CONFIG = {
  maxPlayers: 4,
  minPlayers: 2,
  jokerCount: 2,
  rate: 100,
  gameMode: 'classic' as GameMode,
};
