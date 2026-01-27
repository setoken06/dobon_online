import { Card, canPlayCard, isJokerCard, Suit } from '../../src/types/card';
import { GameState, PlayerGameState, GAME_CONFIG, WinnerInfo, InitialRateBonus, LoserInfo } from '../../src/types/game';
import { Player, MyMark } from '../../src/types/room';
import { Deck } from './Deck';

interface InternalPlayerState {
  playerId: string;
  sessionId: string;
  playerName: string;
  hand: Card[];
  isReach: boolean;
  myMark?: MyMark;
}

// ドボンしたプレイヤー情報
interface DobonPlayerInfo {
  playerId: string;
  playerName: string;
  handCount: number;
}

export class GameManager {
  private roomId: string;
  private deck: Deck;
  private players: InternalPlayerState[];
  private discardPile: Card[] = [];
  private currentPlayerIndex: number = 0;
  private hasDrawnThisTurn: boolean = false;
  private winners: WinnerInfo[] = [];
  private dobonablePlayerIds: Set<string> = new Set();
  private playersWhoDoboned: Map<string, DobonPlayerInfo> = new Map();
  private playersWhoSkippedDobon: Set<string> = new Set();
  private rate: number;
  private lastDrawCards: Card[] = [];
  // ドボン返し関連
  private dobonGaeshiEligiblePlayerIds: Set<string> = new Set();
  private dobonTriggerPlayerId?: string; // カードを出したプレイヤー（ドボン返し対象）
  private dobonCardValue?: number;
  // 最後にカードを出したプレイヤー情報（ツモドボン用）
  private lastDiscardPlayerId?: string;
  private lastDiscardPlayerName?: string;
  // ツモドボンフラグ
  private isTsumoDobon: boolean = false;
  // 敗者情報
  private loser?: LoserInfo;
  // 初期レートボーナス関連
  private initialRateBonuses: InitialRateBonus[] = [];
  private waitingForInitialRateConfirm: boolean = false;

  constructor(roomId: string, players: Player[], jokerCount: number = 0, initialRate: number = 100) {
    this.roomId = roomId;
    this.rate = initialRate;
    this.deck = new Deck(jokerCount);
    this.deck.shuffle();

    // プレイヤーの初期化
    this.players = players.map(p => ({
      playerId: p.id,
      sessionId: p.sessionId,
      playerName: p.name,
      hand: [],
      isReach: false,
      myMark: p.myMark,
    }));

    // 手札を配る
    for (const player of this.players) {
      player.hand = this.deck.drawMultiple(GAME_CONFIG.initialHandSize);
    }

    // ランダムに開始プレイヤーを決定
    this.currentPlayerIndex = Math.floor(Math.random() * this.players.length);
    const firstPlayer = this.players[this.currentPlayerIndex];

    // 場に1枚置く（ジョーカーの場合はもう1枚引いて重ねる）
    // ジョーカーを引いた場合はレート*2
    // 最初の手番プレイヤーのマイマークと一致した場合もレート*2
    let firstCard = this.deck.draw();
    if (firstCard) {
      this.discardPile.push(firstCard);

      // ジョーカーならレート*2
      if (isJokerCard(firstCard)) {
        this.rate *= 2;
        this.initialRateBonuses.push({
          type: 'joker',
          card: firstCard,
          multiplier: 2,
        });
      } else {
        // マイマークと一致ならレート*2
        if (firstPlayer.myMark && firstCard.suit === firstPlayer.myMark) {
          this.rate *= 2;
          this.initialRateBonuses.push({
            type: 'myMark',
            card: firstCard,
            multiplier: 2,
          });
        }
      }

      // ジョーカーの場合、もう1枚引いて重ねる
      while (isJokerCard(this.discardPile[this.discardPile.length - 1])) {
        const nextCard = this.deck.draw();
        if (nextCard) {
          this.discardPile.push(nextCard);
          // ジョーカーならレート*2
          if (isJokerCard(nextCard)) {
            this.rate *= 2;
            this.initialRateBonuses.push({
              type: 'joker',
              card: nextCard,
              multiplier: 2,
            });
          } else {
            // マイマークと一致ならレート*2
            if (firstPlayer.myMark && nextCard.suit === firstPlayer.myMark) {
              this.rate *= 2;
              this.initialRateBonuses.push({
                type: 'myMark',
                card: nextCard,
                multiplier: 2,
              });
            }
          }
        } else {
          break;
        }
      }
    }

    // 初期レートボーナスがあれば確認待ち状態にする
    if (this.initialRateBonuses.length > 0) {
      this.waitingForInitialRateConfirm = true;
    }
  }

  private getTopCard(): Card {
    return this.discardPile[this.discardPile.length - 1];
  }

  // 場のジョーカーの下にあるカードを取得（マッチング用）
  private getEffectiveTopCard(): Card | undefined {
    // 捨て札を逆順で走査してジョーカー以外のカードを見つける
    for (let i = this.discardPile.length - 1; i >= 0; i--) {
      if (!isJokerCard(this.discardPile[i])) {
        return this.discardPile[i];
      }
    }
    // 全部ジョーカーの場合（ありえないはずだが）
    return undefined;
  }

  private getCurrentPlayer(): InternalPlayerState {
    return this.players[this.currentPlayerIndex];
  }

  private nextTurn(): void {
    // ターンを渡す前にリーチ状態を更新
    const currentPlayer = this.getCurrentPlayer();
    if (this.checkReachCondition(currentPlayer.hand)) {
      currentPlayer.isReach = true;
    } else {
      currentPlayer.isReach = false;
    }

    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.hasDrawnThisTurn = false;
    this.dobonablePlayerIds.clear();
  }

  private findPlayer(playerId: string): InternalPlayerState | undefined {
    return this.players.find(p => p.playerId === playerId);
  }

  // カードの数値を取得（A=1, J=11, Q=12, K=13, ジョーカー=0）
  private getCardValue(card: Card): number {
    return card.rank;
  }

  // 手札からジョーカーを除いたカードを取得
  private getNonJokerCards(hand: Card[]): Card[] {
    return hand.filter(card => !isJokerCard(card));
  }

  // 手札の合計を計算（ジョーカー除外）
  private calculateHandSum(hand: Card[]): number {
    return this.getNonJokerCards(hand).reduce((sum, card) => sum + this.getCardValue(card), 0);
  }

  // 上がり数字を計算（ジョーカー除外）
  private calculateWinningNumbers(hand: Card[]): number[] {
    const nonJokerCards = this.getNonJokerCards(hand);

    if (nonJokerCards.length === 0) return [];

    if (nonJokerCards.length === 1) {
      const value = this.getCardValue(nonJokerCards[0]);
      return value >= 1 && value <= 13 ? [value] : [];
    }

    if (nonJokerCards.length === 2) {
      const a = this.getCardValue(nonJokerCards[0]);
      const b = this.getCardValue(nonJokerCards[1]);
      const results = new Set<number>();

      // 足す
      const sum = a + b;
      if (sum >= 1 && sum <= 13) results.add(sum);

      // 引く（両方向）
      const diff1 = Math.abs(a - b);
      if (diff1 >= 1 && diff1 <= 13) results.add(diff1);

      // かける
      const prod = a * b;
      if (prod >= 1 && prod <= 13) results.add(prod);

      // 割る（割り切れる場合のみ）
      if (b !== 0 && a % b === 0) {
        const div = a / b;
        if (div >= 1 && div <= 13) results.add(div);
      }
      if (a !== 0 && b % a === 0) {
        const div = b / a;
        if (div >= 1 && div <= 13) results.add(div);
      }

      return Array.from(results);
    }

    // 3枚以上の場合は合計のみ
    const sum = this.calculateHandSum(hand);
    return sum >= 1 && sum <= 13 ? [sum] : [];
  }

  // リーチ条件をチェック（ジョーカー除外した枚数・合計で判定）
  private checkReachCondition(hand: Card[]): boolean {
    const nonJokerCards = this.getNonJokerCards(hand);

    // ジョーカー以外が2枚以下
    if (nonJokerCards.length <= 2) return true;

    // ジョーカー以外の合計が13以下
    const sum = this.calculateHandSum(hand);
    return sum <= 13;
  }

  // ドボン可能かチェック（特定のプレイヤーが特定のカードに対して）
  private checkDobonCondition(playerId: string, targetCardValue: number): boolean {
    const player = this.findPlayer(playerId);
    if (!player) return false;

    // リーチ状態でなければドボンできない
    if (!player.isReach) return false;

    // ジョーカーではドボンできない
    if (targetCardValue === 0) return false;

    // 上がり数字に含まれているか
    const winningNumbers = this.calculateWinningNumbers(player.hand);
    return winningNumbers.includes(targetCardValue);
  }

  // 指定プレイヤー視点のゲーム状態を取得
  getStateForPlayer(playerId: string): GameState {
    const player = this.findPlayer(playerId);
    const playerStates: PlayerGameState[] = this.players.map(p => ({
      playerId: p.playerId,
      playerName: p.playerName,
      cardCount: p.hand.length,
      hand: p.playerId === playerId ? p.hand : undefined,
      isReach: p.isReach,
    }));

    const canDobon = this.dobonablePlayerIds.has(playerId);
    const canDobonGaeshi = this.dobonGaeshiEligiblePlayerIds.has(playerId);

    // リーチ状態なら待ち数字を計算（自分のみ）
    let winningNumbers: number[] | undefined;
    if (player?.isReach) {
      winningNumbers = this.calculateWinningNumbers(player.hand);
    }

    // 8枚以上で出せるカードがあるか
    const isCurrentPlayer = this.getCurrentPlayer().playerId === playerId;
    const hasPlayableCard = player ? this.getPlayableCards(playerId).length > 0 : false;
    const mustPlayCard = isCurrentPlayer && (player?.hand.length ?? 0) >= 8 && hasPlayableCard;

    const topCard = this.getTopCard();
    const effectiveTopCard = isJokerCard(topCard) ? this.getEffectiveTopCard() : undefined;

    // ドボンしたプレイヤー情報（ドボン返し時に表示用）
    const dobonPlayerIds = Array.from(this.playersWhoDoboned.keys());
    const dobonPlayerNames = Array.from(this.playersWhoDoboned.values()).map(p => p.playerName);

    // 後方互換性のための単独勝者情報
    const firstWinner = this.winners.length > 0 ? this.winners[0] : undefined;

    return {
      roomId: this.roomId,
      status: this.winners.length > 0 ? 'finished' : 'playing',
      players: playerStates,
      currentPlayerId: this.getCurrentPlayer().playerId,
      topCard,
      effectiveTopCard,
      deckCount: this.deck.remaining(),
      hasDrawnThisTurn: this.hasDrawnThisTurn,
      canDobon,
      canDobonGaeshi,
      winningNumbers,
      mustPlayCard,
      // 複数勝者対応
      winners: this.winners.length > 0 ? this.winners : undefined,
      // 敗者情報
      loser: this.loser,
      // 後方互換性
      winnerId: firstWinner?.playerId,
      winnerName: firstWinner?.playerName,
      finalScore: firstWinner?.finalScore,
      winnerHandCount: firstWinner?.handCount,
      rate: this.rate,
      lastDrawCards: this.lastDrawCards.length > 0 ? this.lastDrawCards : undefined,
      // ドボン返し関連
      dobonPlayerIds: dobonPlayerIds.length > 0 ? dobonPlayerIds : undefined,
      dobonPlayerNames: dobonPlayerNames.length > 0 ? dobonPlayerNames : undefined,
      // 後方互換性（単独ドボン時用）
      dobonPlayerId: dobonPlayerIds.length > 0 ? dobonPlayerIds[0] : undefined,
      dobonPlayerName: dobonPlayerNames.length > 0 ? dobonPlayerNames[0] : undefined,
      // 初期レートボーナス関連
      initialRateBonuses: this.initialRateBonuses.length > 0 ? this.initialRateBonuses : undefined,
      waitingForInitialRateConfirm: this.waitingForInitialRateConfirm,
      initialRateConfirmPlayerId: this.waitingForInitialRateConfirm ? this.getCurrentPlayer().playerId : undefined,
      // ドボン待機関連
      isWaitingForDobon: this.dobonablePlayerIds.size > 0,
      isWaitingForDobonGaeshi: this.dobonGaeshiEligiblePlayerIds.size > 0,
    };
  }

  // 出せるカードを取得
  getPlayableCards(playerId: string): Card[] {
    const player = this.findPlayer(playerId);
    if (!player) return [];

    const topCard = this.getTopCard();
    const effectiveTopCard = this.getEffectiveTopCard();
    return player.hand.filter(card => canPlayCard(card, topCard, effectiveTopCard));
  }

  // 手札からジョーカーを取得
  private getJokerFromHand(hand: Card[]): Card | undefined {
    return hand.find(card => isJokerCard(card));
  }

  // カードを出す（複数枚対応：同じ数字なら2枚まで同時に出せる）
  playCards(playerId: string, cardIds: string[]): { success: boolean; error?: string } {
    // 初期レート確認待ちの場合はカードを出せない
    if (this.waitingForInitialRateConfirm) {
      return { success: false, error: '初期レートの確認を待っています' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.playerId !== playerId) {
      return { success: false, error: 'あなたのターンではありません' };
    }

    if (cardIds.length === 0) {
      return { success: false, error: 'カードを選択してください' };
    }

    if (cardIds.length > 4) {
      return { success: false, error: '同時に出せるのは4枚までです' };
    }

    // カードを取得
    const cards: Card[] = [];
    for (const cardId of cardIds) {
      const card = currentPlayer.hand.find(c => c.id === cardId);
      if (!card) {
        return { success: false, error: 'そのカードは手札にありません' };
      }
      cards.push(card);
    }

    // 複数枚の場合、同じ数字かチェック（ジョーカーは単独でしか出せない）
    if (cards.length >= 2) {
      if (cards.some(c => isJokerCard(c))) {
        return { success: false, error: 'ジョーカーは1枚ずつしか出せません' };
      }
      const firstRank = cards[0].rank;
      if (!cards.every(c => c.rank === firstRank)) {
        return { success: false, error: '同時に出せるのは同じ数字のカードのみです' };
      }
    }

    // 少なくとも1枚が場に出せるかチェック
    const topCard = this.getTopCard();
    const effectiveTopCard = this.getEffectiveTopCard();
    const canPlayAny = cards.some(card => canPlayCard(card, topCard, effectiveTopCard));
    if (!canPlayAny) {
      return { success: false, error: 'そのカードは出せません' };
    }

    // カードを出す（手札から削除して捨て札に追加）
    for (const card of cards) {
      const cardIndex = currentPlayer.hand.findIndex(c => c.id === card.id);
      currentPlayer.hand.splice(cardIndex, 1);
      this.discardPile.push(card);
    }

    // 最後にカードを出したプレイヤーを記録（ツモドボン用）
    this.lastDiscardPlayerId = playerId;
    this.lastDiscardPlayerName = currentPlayer.playerName;

    // カードを出した後、リーチ状態を更新（ドボン返し判定のため）
    if (this.checkReachCondition(currentPlayer.hand)) {
      currentPlayer.isReach = true;
    } else {
      currentPlayer.isReach = false;
    }

    // ドボン可能なプレイヤーをチェック（最後に出したカードの数字で判定）
    this.dobonablePlayerIds.clear();
    this.playersWhoDoboned.clear();
    this.playersWhoSkippedDobon.clear();
    this.isTsumoDobon = false; // 通常ドボンなのでフラグをリセット
    const lastCard = cards[cards.length - 1];
    const cardValue = this.getCardValue(lastCard);

    // ジョーカーでなければドボンチェック
    if (!isJokerCard(lastCard)) {
      for (const player of this.players) {
        if (player.playerId !== playerId && this.checkDobonCondition(player.playerId, cardValue)) {
          this.dobonablePlayerIds.add(player.playerId);
        }
      }
    }

    // ドボン可能なプレイヤーがいる場合、トリガープレイヤーを記録
    if (this.dobonablePlayerIds.size > 0) {
      this.dobonTriggerPlayerId = playerId;
      this.dobonCardValue = cardValue;
    } else {
      // ドボン可能なプレイヤーがいなければ次のターンへ
      this.dobonTriggerPlayerId = undefined;
      this.dobonCardValue = undefined;
      this.nextTurn();
    }

    return { success: true };
  }

  // カードを引く
  drawCard(playerId: string): { success: boolean; card?: Card; error?: string; mustDrawAgain?: boolean; mustPlayJoker?: boolean } {
    // 初期レート確認待ちの場合はカードを引けない
    if (this.waitingForInitialRateConfirm) {
      return { success: false, error: '初期レートの確認を待っています' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.playerId !== playerId) {
      return { success: false, error: 'あなたのターンではありません' };
    }

    // 通常は1回だけ引ける。ただし8枚以上で出せるカードがない場合は複数回引ける
    if (this.hasDrawnThisTurn) {
      const playableCards = this.getPlayableCards(playerId);
      if (currentPlayer.hand.length < 7 || playableCards.length > 0) {
        return { success: false, error: '既にカードを引いています' };
      }
    }

    // 山札が空なら捨て札を戻す（レート*2）
    if (this.deck.isEmpty() && this.discardPile.length > 1) {
      const topCard = this.discardPile.pop()!;
      this.deck.addCards(this.discardPile);
      this.discardPile = [topCard];
      this.rate *= 2; // デッキリシャッフルでレート*2
    }

    const card = this.deck.draw();
    if (!card) {
      this.hasDrawnThisTurn = true;
      return { success: true };
    }

    currentPlayer.hand.push(card);
    this.hasDrawnThisTurn = true;

    // リーチ状態で、場のカードで上がり数字になった場合はドボン可能（ツモドボン）
    this.dobonablePlayerIds.clear();
    this.isTsumoDobon = false;
    if (currentPlayer.isReach) {
      const effectiveCard = this.getEffectiveTopCard();
      if (effectiveCard) {
        const topCardValue = this.getCardValue(effectiveCard);
        if (this.checkDobonCondition(playerId, topCardValue)) {
          this.dobonablePlayerIds.add(playerId);
          this.isTsumoDobon = true; // ツモドボンフラグを立てる
        }
      }
    }

    // 8枚以上で出せるカードがまだない場合
    const playableAfterDraw = this.getPlayableCards(playerId);

    if (currentPlayer.hand.length >= 8 && playableAfterDraw.length === 0) {
      // ジョーカーがあれば強制的に出す
      const joker = this.getJokerFromHand(currentPlayer.hand);
      if (joker) {
        return { success: true, card, mustPlayJoker: true };
      }
      // ジョーカーがなければ続けて引く
      return { success: true, card, mustDrawAgain: true };
    }

    return { success: true, card };
  }

  // パス
  pass(playerId: string): { success: boolean; error?: string } {
    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.playerId !== playerId) {
      return { success: false, error: 'あなたのターンではありません' };
    }

    if (!this.hasDrawnThisTurn) {
      return { success: false, error: '先にカードを引いてください' };
    }

    // 8枚以上で出せるカードがある場合はパス不可
    if (currentPlayer.hand.length >= 8) {
      const playableCards = this.getPlayableCards(playerId);
      if (playableCards.length > 0) {
        return { success: false, error: '手札が8枚以上の場合、出せるカードがあればパスできません' };
      }
    }

    this.nextTurn();
    return { success: true };
  }

  // ドボン（全員が選択完了後に勝敗決定）
  dobon(playerId: string): { success: boolean; error?: string; allResponded?: boolean } {
    if (!this.dobonablePlayerIds.has(playerId)) {
      return { success: false, error: 'ドボンできません' };
    }

    const player = this.findPlayer(playerId);
    if (!player) {
      return { success: false, error: 'プレイヤーが見つかりません' };
    }

    // ドボンを選択
    this.playersWhoDoboned.set(playerId, {
      playerId,
      playerName: player.playerName,
      handCount: player.hand.length,
    });
    this.dobonablePlayerIds.delete(playerId);

    // 全員が選択完了したかチェック
    if (this.dobonablePlayerIds.size === 0) {
      return this.resolveDobonPhase();
    }

    return { success: true, allResponded: false };
  }

  // ドボンをスキップ
  skipDobon(playerId: string): { success: boolean; error?: string; allResponded?: boolean } {
    if (!this.dobonablePlayerIds.has(playerId)) {
      return { success: false, error: 'ドボンの権利がありません' };
    }

    this.playersWhoSkippedDobon.add(playerId);
    this.dobonablePlayerIds.delete(playerId);

    // 全員が選択完了したかチェック
    if (this.dobonablePlayerIds.size === 0) {
      return this.resolveDobonPhase();
    }

    return { success: true, allResponded: false };
  }

  // 全員のドボン選択完了後の処理
  private resolveDobonPhase(): { success: boolean; allResponded: boolean } {
    // 誰もドボンしなかった場合
    if (this.playersWhoDoboned.size === 0) {
      this.dobonTriggerPlayerId = undefined;
      this.dobonCardValue = undefined;
      this.nextTurn();
      return { success: true, allResponded: true };
    }

    // ドボン返しチェック（カードを出したプレイヤーがドボン返しできるか）
    if (this.dobonTriggerPlayerId && this.dobonCardValue) {
      const triggerPlayer = this.findPlayer(this.dobonTriggerPlayerId);
      if (triggerPlayer &&
          triggerPlayer.isReach &&
          this.checkDobonCondition(this.dobonTriggerPlayerId, this.dobonCardValue)) {
        // ドボン返し可能
        this.dobonGaeshiEligiblePlayerIds.add(this.dobonTriggerPlayerId);
        return { success: true, allResponded: true };
      }
    }

    // ドボン返しできない場合、ドボンしたプレイヤー全員が勝利
    this.finalizeMultipleWinners();
    return { success: true, allResponded: true };
  }

  // 複数勝者の確定処理
  private finalizeMultipleWinners(): void {
    this.performLastDraw();

    const lastNonJokerCard = this.lastDrawCards.find(c => !isJokerCard(c));
    const lastDrawValue = lastNonJokerCard ? this.getCardValue(lastNonJokerCard) : 0;

    this.winners = [];
    for (const [, dobonInfo] of this.playersWhoDoboned) {
      const handCountMultiplier = this.getHandCountMultiplier(dobonInfo.handCount);
      const score = this.rate * lastDrawValue * handCountMultiplier;
      this.winners.push({
        playerId: dobonInfo.playerId,
        playerName: dobonInfo.playerName,
        handCount: dobonInfo.handCount,
        finalScore: score,
      });
    }

    // 敗者情報を設定
    if (this.isTsumoDobon && this.lastDiscardPlayerId && this.lastDiscardPlayerName) {
      // ツモドボンの場合：最後にカードを出したプレイヤーが敗者
      this.loser = {
        playerId: this.lastDiscardPlayerId,
        playerName: this.lastDiscardPlayerName,
        isTsumoDobon: true,
      };
    } else if (this.dobonTriggerPlayerId) {
      // 通常ドボンの場合：カードを出したプレイヤーが敗者
      const triggerPlayer = this.findPlayer(this.dobonTriggerPlayerId);
      if (triggerPlayer) {
        this.loser = {
          playerId: this.dobonTriggerPlayerId,
          playerName: triggerPlayer.playerName,
          isTsumoDobon: false,
        };
      }
    }

    // クリア
    this.playersWhoDoboned.clear();
    this.playersWhoSkippedDobon.clear();
    this.dobonTriggerPlayerId = undefined;
    this.dobonCardValue = undefined;
  }

  // ドボン返し
  dobonGaeshi(playerId: string): { success: boolean; error?: string } {
    if (!this.dobonGaeshiEligiblePlayerIds.has(playerId)) {
      return { success: false, error: 'ドボン返しできません' };
    }

    const player = this.findPlayer(playerId);
    if (!player) {
      return { success: false, error: 'プレイヤーが見つかりません' };
    }

    // ドボン返し成功：手札枚数は自分の手札 + ドボンした全プレイヤーの手札
    let totalDobonHandCount = 0;
    const dobonPlayerNames: string[] = [];
    for (const [, dobonInfo] of this.playersWhoDoboned) {
      totalDobonHandCount += dobonInfo.handCount;
      dobonPlayerNames.push(dobonInfo.playerName);
    }
    const combinedHandCount = player.hand.length + totalDobonHandCount;

    this.performLastDraw();

    const lastNonJokerCard = this.lastDrawCards.find(c => !isJokerCard(c));
    const lastDrawValue = lastNonJokerCard ? this.getCardValue(lastNonJokerCard) : 0;
    const handCountMultiplier = this.getHandCountMultiplier(combinedHandCount);
    const score = this.rate * lastDrawValue * handCountMultiplier;

    this.winners = [{
      playerId: player.playerId,
      playerName: player.playerName,
      handCount: combinedHandCount,
      finalScore: score,
    }];

    // ドボン返しの場合、敗者はドボンを仕掛けたプレイヤーたち（最初の一人の名前を表示）
    const firstDobonPlayer = Array.from(this.playersWhoDoboned.values())[0];
    if (firstDobonPlayer) {
      this.loser = {
        playerId: firstDobonPlayer.playerId,
        playerName: dobonPlayerNames.join(', '),
        isTsumoDobon: false,
      };
    }

    // クリア
    this.dobonGaeshiEligiblePlayerIds.clear();
    this.playersWhoDoboned.clear();
    this.playersWhoSkippedDobon.clear();
    this.dobonTriggerPlayerId = undefined;
    this.dobonCardValue = undefined;

    return { success: true };
  }

  // ドボン返しをスキップ
  skipDobonGaeshi(playerId: string): { success: boolean; error?: string } {
    if (!this.dobonGaeshiEligiblePlayerIds.has(playerId)) {
      return { success: false, error: 'ドボン返しの権利がありません' };
    }

    this.dobonGaeshiEligiblePlayerIds.delete(playerId);

    // ドボン返しがスキップされたら、ドボンしたプレイヤー全員が勝利
    if (this.dobonGaeshiEligiblePlayerIds.size === 0) {
      this.finalizeMultipleWinners();
    }

    return { success: true };
  }

  // ラストドロー実行
  private performLastDraw(): void {
    this.lastDrawCards = [];

    // 山札が空なら捨て札を戻す（レート*2）
    if (this.deck.isEmpty() && this.discardPile.length > 1) {
      const topCard = this.discardPile.pop()!;
      this.deck.addCards(this.discardPile);
      this.discardPile = [topCard];
      this.rate *= 2;
    }

    // ジョーカー以外が出るまで引く
    let lastDrawCard = this.deck.draw();
    while (lastDrawCard) {
      this.lastDrawCards.push(lastDrawCard);

      if (isJokerCard(lastDrawCard)) {
        // ジョーカーならレート*2してもう一枚引く
        this.rate *= 2;

        // 山札が空なら捨て札を戻す（レート*2）
        if (this.deck.isEmpty() && this.discardPile.length > 1) {
          const topCard = this.discardPile.pop()!;
          this.deck.addCards(this.discardPile);
          this.discardPile = [topCard];
          this.rate *= 2;
        }

        lastDrawCard = this.deck.draw();
      } else {
        // ジョーカー以外が出たら終了
        break;
      }
    }
  }

  // 手札枚数に応じた倍率を取得
  private getHandCountMultiplier(handCount: number): number {
    if (handCount === 1) return 2;  // 1枚 = 2倍
    if (handCount === 2) return 1;  // 2枚 = 1倍
    return handCount;               // 3枚以上 = 枚数倍
  }

  getWinner(): { winnerId?: string; winnerName?: string; winners?: WinnerInfo[] } {
    if (this.winners.length === 0) {
      return {};
    }
    // 後方互換性のため単独勝者の場合は winnerId/winnerName も返す
    const firstWinner = this.winners[0];
    return {
      winnerId: firstWinner.playerId,
      winnerName: firstWinner.playerName,
      winners: this.winners,
    };
  }

  isGameOver(): boolean {
    return this.winners.length > 0;
  }

  isWaitingForDobon(): boolean {
    return this.dobonablePlayerIds.size > 0;
  }

  isWaitingForDobonGaeshi(): boolean {
    return this.dobonGaeshiEligiblePlayerIds.size > 0;
  }

  isWaitingForInitialRateConfirm(): boolean {
    return this.waitingForInitialRateConfirm;
  }

  // 再接続時にプレイヤーIDを更新
  updatePlayerId(sessionId: string, newPlayerId: string): void {
    const player = this.players.find(p => p.sessionId === sessionId);
    if (!player) return;

    const oldPlayerId = player.playerId;
    player.playerId = newPlayerId;

    // ドボン関連のIDも更新
    if (this.dobonablePlayerIds.has(oldPlayerId)) {
      this.dobonablePlayerIds.delete(oldPlayerId);
      this.dobonablePlayerIds.add(newPlayerId);
    }
    if (this.playersWhoSkippedDobon.has(oldPlayerId)) {
      this.playersWhoSkippedDobon.delete(oldPlayerId);
      this.playersWhoSkippedDobon.add(newPlayerId);
    }
    if (this.playersWhoDoboned.has(oldPlayerId)) {
      const dobonInfo = this.playersWhoDoboned.get(oldPlayerId)!;
      this.playersWhoDoboned.delete(oldPlayerId);
      dobonInfo.playerId = newPlayerId;
      this.playersWhoDoboned.set(newPlayerId, dobonInfo);
    }
    if (this.dobonGaeshiEligiblePlayerIds.has(oldPlayerId)) {
      this.dobonGaeshiEligiblePlayerIds.delete(oldPlayerId);
      this.dobonGaeshiEligiblePlayerIds.add(newPlayerId);
    }
    if (this.dobonTriggerPlayerId === oldPlayerId) {
      this.dobonTriggerPlayerId = newPlayerId;
    }
  }

  // 初期レートボーナス確認
  confirmInitialRate(playerId: string): { success: boolean; error?: string } {
    if (!this.waitingForInitialRateConfirm) {
      return { success: false, error: '確認待ちではありません' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.playerId !== playerId) {
      return { success: false, error: '最初の手番プレイヤーのみ確認できます' };
    }

    this.waitingForInitialRateConfirm = false;
    return { success: true };
  }
}
