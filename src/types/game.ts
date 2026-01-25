import { Card } from './card';

// プレイヤーのゲーム状態
export interface PlayerGameState {
  playerId: string;
  playerName: string;
  cardCount: number;    // 他プレイヤーには枚数のみ公開
  hand?: Card[];        // 自分の手札のみ含まれる
  isReach: boolean;     // リーチ状態
}

// 勝者情報
export interface WinnerInfo {
  playerId: string;
  playerName: string;
  handCount: number;
  finalScore: number;
}

// 初期レートボーナス情報
export interface InitialRateBonus {
  type: 'joker' | 'myMark';
  card: Card;
  multiplier: number;
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
  canDobonGaeshi: boolean;    // ドボン返し可能か（自分視点）
  winningNumbers?: number[];  // 自分の待ち数字（リーチ時のみ、非公開）
  mustPlayCard: boolean;      // 手札7枚以上で出せるカードがある場合true
  winnerId?: string;          // 単独勝者（後方互換性のため維持）
  winnerName?: string;
  winners?: WinnerInfo[];     // 複数勝者対応
  // レート関連
  rate: number;               // 現在のレート
  lastDrawCards?: Card[];     // ラストドローで引いたカード
  finalScore?: number;        // 最終スコア（単独勝者時、後方互換性）
  winnerHandCount?: number;   // 勝者の手札枚数（単独勝者時、後方互換性）
  // ドボン返し関連
  dobonPlayerIds?: string[];  // ドボンを宣言したプレイヤーたち（ドボン返し待機中）
  dobonPlayerNames?: string[];// ドボンを宣言したプレイヤー名たち
  // 後方互換性
  dobonPlayerId?: string;
  dobonPlayerName?: string;
  // 初期レートボーナス関連
  initialRateBonuses?: InitialRateBonus[];  // 初期レートボーナス一覧
  waitingForInitialRateConfirm?: boolean;   // 初期レート確認待ち
  initialRateConfirmPlayerId?: string;      // 確認するプレイヤーID
  // ドボン待機関連
  isWaitingForDobon?: boolean;              // 誰かがドボン選択中
  isWaitingForDobonGaeshi?: boolean;        // 誰かがドボン返し選択中
}

// ゲーム設定
export const GAME_CONFIG = {
  initialHandSize: 5,  // 初期手札枚数
};
