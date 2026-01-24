import { Card } from './card';

// プレイヤーのゲーム状態
export interface PlayerGameState {
  playerId: string;
  playerName: string;
  cardCount: number;    // 他プレイヤーには枚数のみ公開
  hand?: Card[];        // 自分の手札のみ含まれる
  isReach: boolean;     // リーチ状態
}

// ゲームの状態
export interface GameState {
  roomId: string;
  status: 'playing' | 'finished';
  players: PlayerGameState[];
  currentPlayerId: string;
  topCard: Card;              // 場の一番上のカード
  effectiveTopCard?: Card;    // ジョーカーの場合、その下のカード（マッチング用）
  deckCount: number;          // 山札の残り枚数
  hasDrawnThisTurn: boolean;  // このターンにカードを引いたか
  canDobon: boolean;          // ドボン可能か（自分視点）
  winningNumbers?: number[];  // 自分の待ち数字（リーチ時のみ、非公開）
  mustPlayCard: boolean;      // 手札7枚以上で出せるカードがある場合true
  winnerId?: string;
  winnerName?: string;
  // レート関連
  rate: number;               // 現在のレート
  lastDrawCards?: Card[];     // ラストドローで引いたカード
  finalScore?: number;        // 最終スコア
  winnerHandCount?: number;   // 勝者の手札枚数（ドボン時）
}

// ゲーム設定
export const GAME_CONFIG = {
  initialHandSize: 5,  // 初期手札枚数
};
