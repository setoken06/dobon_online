import { Card, Suit, Rank, SUITS, RANKS, UNO_COLORS, UnoColor, UnoSpecialType, GameMode } from '../../src/types/card';

const UNO_SPECIALS: UnoSpecialType[] = ['draw2', 'skip', 'reverse'];

export class Deck {
  private cards: Card[] = [];

  constructor(jokerCount: number = 0, gameMode: GameMode = 'classic') {
    if (gameMode === 'uno') {
      this.initializeUno();
    } else {
      this.initialize(jokerCount);
    }
  }

  private initialize(jokerCount: number): void {
    this.cards = [];

    // 通常カード（52枚）
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push({
          id: `${suit}-${rank}`,
          suit,
          rank,
        });
      }
    }

    // ジョーカー追加
    for (let i = 0; i < jokerCount; i++) {
      this.cards.push({
        id: `joker-${i + 1}`,
        suit: 'joker',
        rank: 0,
        isJoker: true,
      });
    }
  }

  private initializeUno(): void {
    this.cards = [];

    for (const color of UNO_COLORS) {
      // 「0」は各色1枚
      this.cards.push({
        id: `${color}-0-0`,
        suit: color,
        rank: 0,
      });

      // 「1〜9」は各色2枚ずつ
      for (let num = 1; num <= 9; num++) {
        for (let copy = 0; copy < 2; copy++) {
          this.cards.push({
            id: `${color}-${num}-${copy}`,
            suit: color,
            rank: num as Rank,
          });
        }
      }

      // 記号カード: 各色2枚ずつ
      for (const special of UNO_SPECIALS) {
        for (let copy = 0; copy < 2; copy++) {
          this.cards.push({
            id: `${color}-${special}-${copy}`,
            suit: color,
            rank: 0,
            unoSpecial: special,
          });
        }
      }
    }

    // ワイルドカード: 4枚
    for (let i = 0; i < 4; i++) {
      this.cards.push({
        id: `wild-${i}`,
        suit: 'wild',
        rank: 0,
        isJoker: true,
      });
    }

    // ワイルドドロー4: 4枚
    for (let i = 0; i < 4; i++) {
      this.cards.push({
        id: `wild4-${i}`,
        suit: 'wild',
        rank: 0,
        isJoker: true,
        isWild4: true,
      });
    }
  }

  shuffle(): void {
    // Fisher-Yates シャッフル
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw(): Card | undefined {
    return this.cards.pop();
  }

  drawMultiple(count: number): Card[] {
    const drawn: Card[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.draw();
      if (card) {
        drawn.push(card);
      }
    }
    return drawn;
  }

  remaining(): number {
    return this.cards.length;
  }

  isEmpty(): boolean {
    return this.cards.length === 0;
  }

  // 捨て札を山札に戻す（トップカードを除く）
  addCards(cards: Card[]): void {
    this.cards = [...cards, ...this.cards];
    this.shuffle();
  }
}
