import { Card, Suit, Rank, SUITS, RANKS } from '../../src/types/card';

export class Deck {
  private cards: Card[] = [];

  constructor(jokerCount: number = 0) {
    this.initialize(jokerCount);
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
