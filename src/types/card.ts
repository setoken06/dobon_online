// マーク
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

// 数字（1-13: A, 2-10, J, Q, K）
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

// カード
export interface Card {
  id: string;        // ユニークID（例: "hearts-7", "joker-1"）
  suit: Suit | 'joker';
  rank: Rank | 0;    // ジョーカーはrank=0
  isJoker?: boolean; // ジョーカーフラグ
}

// 全てのマーク
export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

// 全てのランク
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// マークの表示名
export const SUIT_SYMBOLS: Record<Suit | 'joker', string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
  joker: '🃏',
};

// ランクの表示名
export const RANK_LABELS: Record<Rank | 0, string> = {
  0: 'JOKER',
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
};

// ジョーカーかどうかの判定
export function isJokerCard(card: Card): boolean {
  return card.isJoker === true || card.suit === 'joker';
}

// カードが出せるかどうかの判定
// ジョーカーはいつでも出せる
// 場がジョーカーの場合、effectiveTopCardを使う
export function canPlayCard(card: Card, topCard: Card, effectiveTopCard?: Card): boolean {
  // ジョーカーはいつでも出せる
  if (isJokerCard(card)) {
    return true;
  }

  // 場のカードがジョーカーの場合、effectiveTopCardを使う
  const compareCard = effectiveTopCard ?? topCard;

  // effectiveTopCardもジョーカーの場合（ゲーム開始時など）、なんでも出せる
  if (isJokerCard(compareCard)) {
    return true;
  }

  return card.suit === compareCard.suit || card.rank === compareCard.rank;
}
