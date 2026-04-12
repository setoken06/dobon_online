// マーク（クラシック）
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

// UNOの色
export type UnoColor = 'red' | 'blue' | 'yellow' | 'green';

// UNO記号カードタイプ
export type UnoSpecialType = 'draw2' | 'skip' | 'reverse';

// ゲームモード
export type GameMode = 'classic' | 'uno';

// 数字（1-13: A, 2-10, J, Q, K）
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

// カード
export interface Card {
  id: string;        // ユニークID（例: "hearts-7", "joker-1", "red-5-0", "wild-1"）
  suit: Suit | UnoColor | 'joker' | 'wild';
  rank: Rank | 0;    // ジョーカー/ワイルド/記号カードはrank=0
  isJoker?: boolean; // ジョーカーフラグ（クラシック: ジョーカー、UNO: ワイルド）
  unoSpecial?: UnoSpecialType; // UNO記号カード種別
  isWild4?: boolean; // ワイルドドロー4フラグ
  chosenColor?: UnoColor; // ワイルド使用時に指定された色
}

// 全てのマーク
export const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

// UNOの全色
export const UNO_COLORS: UnoColor[] = ['red', 'blue', 'yellow', 'green'];

// 全てのランク
export const RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

// UNOのランク（0-9）
export const UNO_RANKS: (Rank | 0)[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

// マークの表示名
export const SUIT_SYMBOLS: Record<Suit | UnoColor | 'joker' | 'wild', string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
  red: '🔴',
  blue: '🔵',
  yellow: '🟡',
  green: '🟢',
  joker: '🃏',
  wild: '🌈',
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

// UNO記号カードの表示名
export const UNO_SPECIAL_LABELS: Record<UnoSpecialType, string> = {
  draw2: '+2',
  skip: '🚫',
  reverse: '🔄',
};

// ジョーカーかどうかの判定（UNOではワイルド系もジョーカー扱い）
export function isJokerCard(card: Card): boolean {
  return card.isJoker === true || card.suit === 'joker';
}

// ワイルドカード（ワイルド or ワイルド4）かどうか
export function isWildCard(card: Card): boolean {
  return card.suit === 'wild';
}

// UNO記号カードかどうか
export function isUnoSpecialCard(card: Card): boolean {
  return card.unoSpecial !== undefined;
}

// UNOの色付きカードかどうか
export function isUnoColorCard(card: Card): boolean {
  return UNO_COLORS.includes(card.suit as UnoColor);
}

// カードが出せるかどうかの判定
// ジョーカー/ワイルドはいつでも出せる
// 場がジョーカー/ワイルドの場合、effectiveTopCardを使う
export function canPlayCard(card: Card, topCard: Card, effectiveTopCard?: Card): boolean {
  // ジョーカー/ワイルドはいつでも出せる
  if (isJokerCard(card) || isWildCard(card)) {
    return true;
  }

  // 場のカードがワイルドの場合
  if (isWildCard(topCard)) {
    // 色が指定されていれば、その色にマッチするカードのみ出せる
    if (topCard.chosenColor) {
      return card.suit === topCard.chosenColor;
    }
    // 色未指定なら何でも出せる
    return true;
  }

  // 場のカードがジョーカーの場合、effectiveTopCardを使う
  const compareCard = (isJokerCard(topCard) ? effectiveTopCard : null) ?? topCard;

  // effectiveTopCardもジョーカーの場合、なんでも出せる
  if (isJokerCard(compareCard)) {
    return true;
  }

  // スート（色）一致
  if (card.suit === compareCard.suit) {
    return true;
  }

  // UNO記号カード同士の場合、同じ種別なら出せる
  if (card.unoSpecial && compareCard.unoSpecial && card.unoSpecial === compareCard.unoSpecial) {
    return true;
  }

  // ランク一致（数字カード同士）
  if (!card.unoSpecial && !compareCard.unoSpecial && card.rank === compareCard.rank) {
    return true;
  }

  return false;
}
