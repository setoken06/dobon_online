import { Card, canPlayCard, isJokerCard, isWildCard, isUnoSpecialCard, Suit, GameMode, UnoColor } from '../../src/types/card';
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
  private gameMode: GameMode;
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
  private minogashiPlayerName?: string; // 見逃し演出用
  private lastDrawCards: Card[] = [];
  // ドボン返し関連
  private dobonGaeshiEligiblePlayerIds: Set<string> = new Set();
  private dobonTriggerPlayerId?: string;
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
  // ドボン演出フェーズ
  private dobonPhase?: 'success' | 'lastDraw' | 'result';
  private pendingDobonWinners: DobonPlayerInfo[] = [];
  private pendingDobonIsGaeshi: boolean = false;
  private pendingGaeshiTotalMultiplier?: number;
  private dobonTriggerCard?: Card;
  // UNOモード用
  private turnDirection: 1 | -1 = 1; // 1=時計回り, -1=反時計回り
  private pendingEffect?: 'draw2' | 'draw4' | 'skip'; // 次プレイヤーへの効果
  private waitingForColorChoice: boolean = false;
  private colorChoicePlayerId?: string;
  private revealedLastDrawCount: number = 0; // ラストドローで公開済みカード数

  constructor(roomId: string, players: Player[], jokerCount: number = 0, initialRate: number = 100, gameMode: GameMode = 'classic') {
    this.roomId = roomId;
    this.gameMode = gameMode;
    this.rate = initialRate;
    this.deck = new Deck(jokerCount, gameMode);
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

    // 場に1枚置く
    let firstCard = this.deck.draw();
    if (firstCard) {
      // UNOモードの場合、最初のカードが記号カードなら引き直す（ワイルドはジョーカー扱いでOK）
      if (this.gameMode === 'uno') {
        while (firstCard && isUnoSpecialCard(firstCard)) {
          this.deck.addCards([firstCard]);
          firstCard = this.deck.draw();
        }
      }

      if (firstCard) {
        this.discardPile.push(firstCard);

        // 初期レートボーナス処理（ジョーカー/ワイルドの場合）
        const isJokerLike = this.gameMode === 'uno' ? isWildCard(firstCard) : isJokerCard(firstCard);
        if (isJokerLike) {
          this.rate *= 2;
          this.initialRateBonuses.push({
            type: 'joker',
            card: firstCard,
            multiplier: 2,
          });
        } else if (this.gameMode === 'classic') {
          // マイマークと一致ならレート*2（クラシックのみ）
          if (firstPlayer.myMark && firstCard.suit === firstPlayer.myMark) {
            this.rate *= 2;
            this.initialRateBonuses.push({
              type: 'myMark',
              card: firstCard,
              multiplier: 2,
            });
          }
        }

        // ジョーカー/ワイルドの場合、もう1枚引いて重ねる
        const isTopJokerLike = () => {
          const top = this.discardPile[this.discardPile.length - 1];
          return this.gameMode === 'uno' ? isWildCard(top) : isJokerCard(top);
        };

        while (isTopJokerLike()) {
          let nextCard = this.deck.draw();

          // UNOモード: 記号カードが出たら引き直し
          if (this.gameMode === 'uno') {
            while (nextCard && isUnoSpecialCard(nextCard)) {
              this.deck.addCards([nextCard]);
              nextCard = this.deck.draw();
            }
          }

          if (nextCard) {
            this.discardPile.push(nextCard);
            const isNextJokerLike = this.gameMode === 'uno' ? isWildCard(nextCard) : isJokerCard(nextCard);
            if (isNextJokerLike) {
              this.rate *= 2;
              this.initialRateBonuses.push({
                type: 'joker',
                card: nextCard,
                multiplier: 2,
              });
            } else if (this.gameMode === 'classic') {
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
  // UNOモードではワイルドは「なんでも出せる」なのでeffectiveTopCard不要
  private getEffectiveTopCard(): Card | undefined {
    for (let i = this.discardPile.length - 1; i >= 0; i--) {
      const card = this.discardPile[i];
      if (this.gameMode === 'uno') {
        // UNO: ワイルドの下は探さない（ワイルドはなんでも出せるため）
        if (!isWildCard(card)) return card;
      } else {
        // クラシック: ジョーカー以外を探す
        if (!isJokerCard(card)) return card;
      }
    }
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

    // UNOモードのターン方向対応
    const step = this.gameMode === 'uno' ? this.turnDirection : 1;
    this.currentPlayerIndex = ((this.currentPlayerIndex + step) % this.players.length + this.players.length) % this.players.length;
    this.hasDrawnThisTurn = false;
    this.dobonablePlayerIds.clear();
    this.minogashiPlayerName = undefined;
  }

  private findPlayer(playerId: string): InternalPlayerState | undefined {
    return this.players.find(p => p.playerId === playerId);
  }

  // カードの数値を取得
  private getCardValue(card: Card): number {
    if (this.gameMode === 'uno') {
      // UNO記号カードはドボンの数値判定では特殊扱い
      if (isUnoSpecialCard(card)) return 0; // 記号カードは数値0（特殊ドボンルール参照）
      if (isWildCard(card)) return 0; // ワイルド系も0
      return card.rank;
    }
    return card.rank;
  }

  // UNOモード: ラストドロー用の数値取得
  private getLastDrawCardValue(card: Card): number {
    if (this.gameMode === 'uno') {
      if (isUnoSpecialCard(card)) return 10; // 記号カード = 10
      if (isWildCard(card)) return 0; // ワイルド系はジョーカー扱い（performLastDrawで処理）
      return card.rank;
    }
    return card.rank;
  }

  // 手札からジョーカー/ワイルドを除いたカードを取得
  private getNonJokerCards(hand: Card[]): Card[] {
    if (this.gameMode === 'uno') {
      return hand.filter(card => !isWildCard(card));
    }
    return hand.filter(card => !isJokerCard(card));
  }

  // UNOモード: 手札から記号カードを除いたカードを取得（ワイルドも除く）
  private getNumberOnlyCards(hand: Card[]): Card[] {
    return hand.filter(card => !isWildCard(card) && !isUnoSpecialCard(card));
  }

  // UNOモード: 手札の記号カードを取得
  private getSpecialCards(hand: Card[]): Card[] {
    return hand.filter(card => isUnoSpecialCard(card));
  }

  // 手札の合計を計算（ジョーカー/ワイルド除外）
  private calculateHandSum(hand: Card[]): number {
    return this.getNonJokerCards(hand).reduce((sum, card) => sum + this.getCardValue(card), 0);
  }

  // 上がり数字を計算
  private calculateWinningNumbers(hand: Card[]): number[] {
    if (this.gameMode === 'uno') {
      return this.calculateWinningNumbersUno(hand);
    }
    return this.calculateWinningNumbersClassic(hand);
  }

  // クラシックモードの上がり数字計算
  private calculateWinningNumbersClassic(hand: Card[]): number[] {
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

      const sum = a + b;
      if (sum >= 1 && sum <= 13) results.add(sum);

      const diff1 = Math.abs(a - b);
      if (diff1 >= 1 && diff1 <= 13) results.add(diff1);

      const prod = a * b;
      if (prod >= 1 && prod <= 13) results.add(prod);

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

    const sum = this.calculateHandSum(hand);
    return sum >= 1 && sum <= 13 ? [sum] : [];
  }

  // UNOモードの上がり数字計算
  private calculateWinningNumbersUno(hand: Card[]): number[] {
    // ワイルド系（ワイルド・ワイルド4）を持っている場合はドボンできない
    if (hand.some(card => isWildCard(card))) return [];

    const specialCards = this.getSpecialCards(hand);
    const numberCards = this.getNumberOnlyCards(hand);

    // 記号カードが2枚以上あるとリーチ不成立
    if (specialCards.length >= 2) return [];

    if (specialCards.length === 1) {
      // 記号カード1枚：数字カードのみでリーチが成立している場合、記号カード単独待ち
      const nonSpecialHand = [...numberCards];
      if (this.checkReachConditionForCards(nonSpecialHand)) {
        // 記号カード単独の待ち（=場に同じ記号カードが出ればドボン）
        // 記号カードのドボンは「場のカードの数値」ではなくカードの種類マッチなので
        // 特殊な待ち番号として-1（draw2）, -2（skip）, -3（reverse）を使う
        const special = specialCards[0].unoSpecial!;
        if (special === 'draw2') return [-1];
        if (special === 'skip') return [-2];
        if (special === 'reverse') return [-3];
      }
      return [];
    }

    // 記号カードなし：通常のドボン計算（数字カードのみ）
    if (numberCards.length === 0) return [];

    if (numberCards.length === 1) {
      const value = numberCards[0].rank;
      return value >= 0 && value <= 9 ? [value] : [];
    }

    if (numberCards.length === 2) {
      const a = numberCards[0].rank;
      const b = numberCards[1].rank;
      const results = new Set<number>();

      const sum = a + b;
      if (sum >= 0 && sum <= 9) results.add(sum);

      const diff = Math.abs(a - b);
      if (diff >= 0 && diff <= 9) results.add(diff);

      const prod = a * b;
      if (prod >= 0 && prod <= 9) results.add(prod);

      if (b !== 0 && a % b === 0) {
        const div = a / b;
        if (div >= 0 && div <= 9) results.add(div);
      }
      if (a !== 0 && b % a === 0) {
        const div = b / a;
        if (div >= 0 && div <= 9) results.add(div);
      }

      return Array.from(results);
    }

    // 3枚以上：合計のみ
    const sum = numberCards.reduce((s, c) => s + c.rank, 0);
    return sum >= 0 && sum <= 9 ? [sum] : [];
  }

  // リーチ条件をチェック
  private checkReachCondition(hand: Card[]): boolean {
    if (this.gameMode === 'uno') {
      return this.checkReachConditionUno(hand);
    }

    const nonJokerCards = this.getNonJokerCards(hand);
    if (nonJokerCards.length <= 2) return true;
    const sum = this.calculateHandSum(hand);
    return sum <= 13;
  }

  // UNOモード用リーチチェック
  private checkReachConditionUno(hand: Card[]): boolean {
    // ワイルド系（ワイルド・ワイルド4）を持っている場合はドボンできない
    if (hand.some(card => isWildCard(card))) return false;

    const specialCards = this.getSpecialCards(hand);

    // 記号カード2枚以上はリーチ不成立
    if (specialCards.length >= 2) return false;

    if (specialCards.length === 1) {
      // 記号カード以外でリーチが成立しているかチェック
      const nonSpecialHand = hand.filter(c => !isUnoSpecialCard(c));
      return this.checkReachConditionForCards(nonSpecialHand);
    }

    // 記号カードなし：通常判定
    return this.checkReachConditionForCards(hand);
  }

  // カード群に対するリーチ判定（ワイルドはジョーカー扱い）
  private checkReachConditionForCards(cards: Card[]): boolean {
    const numberCards = cards.filter(c => !isWildCard(c) && !isUnoSpecialCard(c));
    if (numberCards.length <= 2) return true;
    const sum = numberCards.reduce((s, c) => s + c.rank, 0);
    return this.gameMode === 'uno' ? sum <= 9 : sum <= 13;
  }

  // ドボン可能かチェック
  private checkDobonCondition(playerId: string, targetCardValue: number): boolean {
    const player = this.findPlayer(playerId);
    if (!player) return false;

    if (!player.isReach) return false;

    // クラシック: ジョーカーではドボンできない
    if (this.gameMode === 'classic' && targetCardValue === 0) return false;

    const winningNumbers = this.calculateWinningNumbers(player.hand);
    return winningNumbers.includes(targetCardValue);
  }

  // UNOモード: 記号カードに対するドボンチェック
  private checkDobonConditionForSpecial(playerId: string, card: Card): boolean {
    if (this.gameMode !== 'uno' || !isUnoSpecialCard(card)) return false;

    const player = this.findPlayer(playerId);
    if (!player) return false;
    if (!player.isReach) return false;

    const winningNumbers = this.calculateWinningNumbers(player.hand);
    const specialValue = card.unoSpecial === 'draw2' ? -1 : card.unoSpecial === 'skip' ? -2 : -3;
    return winningNumbers.includes(specialValue);
  }

  // 指定プレイヤー視点のゲーム状態を取得
  getStateForPlayer(playerId: string): GameState {
    const player = this.findPlayer(playerId);
    const showWinnerHands = !!this.dobonPhase;
    const winnerPlayerIdSet = showWinnerHands
      ? new Set(this.pendingDobonWinners.map(w => w.playerId))
      : null;
    const playerStates: PlayerGameState[] = this.players.map(p => ({
      playerId: p.playerId,
      playerName: p.playerName,
      cardCount: p.hand.length,
      hand: p.playerId === playerId || winnerPlayerIdSet?.has(p.playerId) ? p.hand : undefined,
      isReach: p.isReach,
    }));

    const canDobon = this.dobonablePlayerIds.has(playerId);
    const canDobonGaeshi = this.dobonGaeshiEligiblePlayerIds.has(playerId);

    let winningNumbers: number[] | undefined;
    if (player?.isReach) {
      winningNumbers = this.calculateWinningNumbers(player.hand);
    }

    const isCurrentPlayer = this.getCurrentPlayer().playerId === playerId;
    const hasPlayableCard = player ? this.getPlayableCards(playerId).length > 0 : false;
    const mustPlayCard = isCurrentPlayer && (player?.hand.length ?? 0) >= 8 && hasPlayableCard;

    const topCard = this.getTopCard();
    // UNOモード: ワイルドは「なんでも出せる」のでeffectiveTopCard不要
    // クラシック: ジョーカーの場合のみeffectiveTopCardを使う
    const effectiveTopCard = this.gameMode === 'uno'
      ? undefined // UNOではワイルドの下を参照しない（canPlayCardで処理）
      : (isJokerCard(topCard) ? this.getEffectiveTopCard() : undefined);

    const dobonPlayerIds = Array.from(this.playersWhoDoboned.keys());
    const dobonPlayerNames = Array.from(this.playersWhoDoboned.values()).map(p => p.playerName);

    const firstWinner = this.winners.length > 0 ? this.winners[0] : undefined;

    const dobonWinnerPlayerIds = this.dobonPhase
      ? this.pendingDobonWinners.map(w => w.playerId)
      : undefined;

    return {
      roomId: this.roomId,
      status: this.winners.length > 0 && !this.dobonPhase ? 'finished' : 'playing',
      gameMode: this.gameMode,
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
      winners: this.winners.length > 0 ? this.winners : undefined,
      loser: this.loser,
      winnerId: firstWinner?.playerId,
      winnerName: firstWinner?.playerName,
      finalScore: firstWinner?.finalScore,
      winnerHandCount: firstWinner?.handCount,
      rate: this.rate,
      lastDrawCards: this.lastDrawCards.length > 0 ? this.lastDrawCards : undefined,
      dobonPlayerIds: dobonPlayerIds.length > 0 ? dobonPlayerIds : undefined,
      dobonPlayerNames: dobonPlayerNames.length > 0 ? dobonPlayerNames : undefined,
      dobonPlayerId: dobonPlayerIds.length > 0 ? dobonPlayerIds[0] : undefined,
      dobonPlayerName: dobonPlayerNames.length > 0 ? dobonPlayerNames[0] : undefined,
      initialRateBonuses: this.initialRateBonuses.length > 0 ? this.initialRateBonuses : undefined,
      waitingForInitialRateConfirm: this.waitingForInitialRateConfirm,
      initialRateConfirmPlayerId: this.waitingForInitialRateConfirm ? this.getCurrentPlayer().playerId : undefined,
      isWaitingForDobon: this.dobonablePlayerIds.has(playerId),
      isWaitingForDobonGaeshi: this.dobonGaeshiEligiblePlayerIds.has(playerId),
      isAnyoneDecidingDobon: this.dobonablePlayerIds.size > 0 || this.dobonGaeshiEligiblePlayerIds.size > 0,
      dobonPhase: this.dobonPhase,
      dobonWinnerPlayerIds,
      isDobonGaeshi: this.dobonPhase ? this.pendingDobonIsGaeshi : undefined,
      dobonTriggerCard: this.dobonPhase ? this.dobonTriggerCard : undefined,
      // UNOモード用
      turnDirection: this.gameMode === 'uno' ? this.turnDirection : undefined,
      pendingEffect: this.pendingEffect,
      waitingForColorChoice: this.waitingForColorChoice || undefined,
      colorChoicePlayerId: this.colorChoicePlayerId,
      revealedLastDrawCount: this.dobonPhase === 'result' ? this.revealedLastDrawCount : undefined,
      minogashiPlayerName: this.minogashiPlayerName,
    };
  }

  // 出せるカードを取得
  getPlayableCards(playerId: string): Card[] {
    const player = this.findPlayer(playerId);
    if (!player) return [];

    const topCard = this.getTopCard();
    const effectiveTopCard = this.getEffectiveTopCard();
    const playable = player.hand.filter(card => canPlayCard(card, topCard, effectiveTopCard));

    // UNOモード: ワイルド4は他に出せるカードがある場合は使用不可
    if (this.gameMode === 'uno') {
      const nonWild4Playable = playable.filter(card => !card.isWild4);
      if (nonWild4Playable.length > 0) {
        return nonWild4Playable;
      }
    }

    return playable;
  }

  // 手札からジョーカー/ワイルドを取得
  private getJokerFromHand(hand: Card[]): Card | undefined {
    if (this.gameMode === 'uno') {
      return hand.find(card => isWildCard(card));
    }
    return hand.find(card => isJokerCard(card));
  }

  // UNOモード: カード効果を適用
  private applyUnoCardEffect(card: Card): void {
    if (this.gameMode !== 'uno') return;

    if (card.unoSpecial === 'draw2') {
      this.pendingEffect = 'draw2';
    } else if (card.unoSpecial === 'skip') {
      this.pendingEffect = 'skip';
    } else if (card.unoSpecial === 'reverse') {
      this.turnDirection *= -1;
      // 2人プレイの場合はスキップと同等
      if (this.players.length === 2) {
        this.pendingEffect = 'skip';
      }
    } else if (card.isWild4) {
      this.pendingEffect = 'draw4';
    }
  }

  // UNOモード: 次のターン開始時に効果を適用
  private applyPendingEffect(): void {
    if (!this.pendingEffect) return;

    const currentPlayer = this.getCurrentPlayer();

    if (this.pendingEffect === 'draw2') {
      // 2枚引く
      this.refillDeckIfNeeded();
      const drawn = this.deck.drawMultiple(2);
      currentPlayer.hand.push(...drawn);
      // パスしか行えない → 次のターンへ
      this.pendingEffect = undefined;
      this.nextTurn();
      return;
    }

    if (this.pendingEffect === 'draw4') {
      // 4枚引く
      this.refillDeckIfNeeded();
      const drawn = this.deck.drawMultiple(4);
      currentPlayer.hand.push(...drawn);
      // 出番を終了 → 次のターンへ
      this.pendingEffect = undefined;
      this.nextTurn();
      return;
    }

    if (this.pendingEffect === 'skip') {
      // パスしか行えない → 次のターンへ
      this.pendingEffect = undefined;
      this.nextTurn();
      return;
    }
  }

  // 山札が空なら捨て札を戻す
  private refillDeckIfNeeded(): void {
    if (this.deck.isEmpty() && this.discardPile.length > 1) {
      const topCard = this.discardPile.pop()!;
      this.deck.addCards(this.discardPile);
      this.discardPile = [topCard];
      this.rate *= 2;
    }
  }

  // カードを出す（複数枚対応）
  playCards(playerId: string, cardIds: string[]): { success: boolean; error?: string } {
    if (this.dobonPhase) {
      return { success: false, error: 'ドボン演出中です' };
    }

    if (this.dobonablePlayerIds.size > 0 || this.dobonGaeshiEligiblePlayerIds.size > 0) {
      return { success: false, error: 'ドボンの判定中です' };
    }

    if (this.waitingForInitialRateConfirm) {
      return { success: false, error: '初期レートの確認を待っています' };
    }

    if (this.waitingForColorChoice) {
      return { success: false, error: '色選択を待っています' };
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

    // 複数枚の場合のバリデーション
    if (cards.length >= 2) {
      if (this.gameMode === 'uno') {
        // UNOモード: ワイルド系は1枚ずつ、記号カードも1枚ずつ
        if (cards.some(c => isWildCard(c))) {
          return { success: false, error: 'ワイルドカードは1枚ずつしか出せません' };
        }
        if (cards.some(c => isUnoSpecialCard(c))) {
          return { success: false, error: '記号カードは1枚ずつしか出せません' };
        }
        const firstRank = cards[0].rank;
        if (!cards.every(c => c.rank === firstRank)) {
          return { success: false, error: '同時に出せるのは同じ数字のカードのみです' };
        }
      } else {
        if (cards.some(c => isJokerCard(c))) {
          return { success: false, error: 'ジョーカーは1枚ずつしか出せません' };
        }
        const firstRank = cards[0].rank;
        if (!cards.every(c => c.rank === firstRank)) {
          return { success: false, error: '同時に出せるのは同じ数字のカードのみです' };
        }
      }
    }

    // 少なくとも1枚が場に出せるかチェック
    const topCard = this.getTopCard();
    const effectiveTopCard = this.getEffectiveTopCard();
    const canPlayAny = cards.some(card => canPlayCard(card, topCard, effectiveTopCard));
    if (!canPlayAny) {
      return { success: false, error: 'そのカードは出せません' };
    }

    // カードを出す
    for (const card of cards) {
      const cardIndex = currentPlayer.hand.findIndex(c => c.id === card.id);
      currentPlayer.hand.splice(cardIndex, 1);
      this.discardPile.push(card);
    }

    this.lastDiscardPlayerId = playerId;
    this.lastDiscardPlayerName = currentPlayer.playerName;

    // リーチ状態を更新
    if (this.checkReachCondition(currentPlayer.hand)) {
      currentPlayer.isReach = true;
    } else {
      currentPlayer.isReach = false;
    }

    // UNOモード: カード効果を適用（ドロー2/スキップ/リバース/ドロー4）
    const lastCard = cards[cards.length - 1];
    if (this.gameMode === 'uno') {
      this.applyUnoCardEffect(lastCard);
    }

    // UNOモード: ワイルド系を出した場合、色選択待ちに入る
    if (this.gameMode === 'uno' && isWildCard(lastCard)) {
      this.waitingForColorChoice = true;
      this.colorChoicePlayerId = playerId;
      // 色選択後に後続処理（ドボンチェック・ターン進行）を行う
      return { success: true };
    }

    // 色選択不要の場合は直接ドボンチェック・ターン進行
    this.proceedAfterPlay(playerId, lastCard);

    return { success: true };
  }

  // カード出し後の後続処理（ドボンチェック・ターン進行）
  private proceedAfterPlay(playerId: string, lastCard: Card): void {
    // ドボン可能なプレイヤーをチェック
    this.dobonablePlayerIds.clear();
    this.playersWhoDoboned.clear();
    this.playersWhoSkippedDobon.clear();
    this.isTsumoDobon = false;
    const cardValue = this.getCardValue(lastCard);

    if (this.gameMode === 'uno') {
      if (isUnoSpecialCard(lastCard)) {
        for (const player of this.players) {
          if (player.playerId !== playerId && this.checkDobonConditionForSpecial(player.playerId, lastCard)) {
            this.dobonablePlayerIds.add(player.playerId);
          }
        }
      } else if (!isWildCard(lastCard)) {
        for (const player of this.players) {
          if (player.playerId !== playerId && this.checkDobonCondition(player.playerId, cardValue)) {
            this.dobonablePlayerIds.add(player.playerId);
          }
        }
      }
      // ワイルド系ではドボンチェックしない
    } else {
      if (!isJokerCard(lastCard)) {
        for (const player of this.players) {
          if (player.playerId !== playerId && this.checkDobonCondition(player.playerId, cardValue)) {
            this.dobonablePlayerIds.add(player.playerId);
          }
        }
      }
    }

    if (this.dobonablePlayerIds.size > 0) {
      this.dobonTriggerPlayerId = playerId;
      this.dobonCardValue = cardValue;
    } else {
      this.dobonTriggerPlayerId = undefined;
      this.dobonCardValue = undefined;
      this.nextTurn();

      // UNOモード: 効果適用
      if (this.pendingEffect) {
        this.applyPendingEffect();
      }
    }
  }

  // ワイルド使用後の色選択
  chooseColor(playerId: string, color: UnoColor): { success: boolean; error?: string } {
    if (!this.waitingForColorChoice) {
      return { success: false, error: '色選択待ちではありません' };
    }
    if (this.colorChoicePlayerId !== playerId) {
      return { success: false, error: 'あなたが色を選択するターンではありません' };
    }

    // 場の一番上のワイルドカードに色を設定
    const topCard = this.getTopCard();
    if (isWildCard(topCard)) {
      topCard.chosenColor = color;
    }

    this.waitingForColorChoice = false;
    const choicePlayerId = this.colorChoicePlayerId!;
    this.colorChoicePlayerId = undefined;

    // 後続処理（ドボンチェック・ターン進行）
    // ワイルド系はドボンチェック不要なので直接ターン進行
    this.dobonTriggerPlayerId = undefined;
    this.dobonCardValue = undefined;
    this.nextTurn();

    if (this.pendingEffect) {
      this.applyPendingEffect();
    }

    return { success: true };
  }

  // ラストドローカードを1枚公開（勝者のみ操作可能）
  // revealedLastDrawCount の意味:
  // 偶数(0,2,4,...): 次のカードをめくれる状態
  // 奇数(1,3,5,...): 最新カードを確認待ち状態
  // lastDrawCards.length * 2: 全カード公開+確認完了
  revealLastDrawCard(playerId: string): { success: boolean; error?: string } {
    if (this.dobonPhase !== 'result') {
      return { success: false, error: 'リザルトフェーズではありません' };
    }
    const isWinner = this.pendingDobonWinners.some(w => w.playerId === playerId);
    if (!isWinner) {
      return { success: false, error: 'ドボン成功者のみ操作できます' };
    }
    if (this.revealedLastDrawCount >= this.lastDrawCards.length * 2) {
      return { success: false, error: '既に完了しています' };
    }

    this.revealedLastDrawCount++;
    return { success: true };
  }

  // カードを引く
  drawCard(playerId: string): { success: boolean; card?: Card; error?: string; mustDrawAgain?: boolean; mustPlayJoker?: boolean } {
    if (this.dobonPhase) {
      return { success: false, error: 'ドボン演出中です' };
    }

    if (this.dobonablePlayerIds.size > 0 || this.dobonGaeshiEligiblePlayerIds.size > 0) {
      return { success: false, error: 'ドボンの判定中です' };
    }

    if (this.waitingForInitialRateConfirm) {
      return { success: false, error: '初期レートの確認を待っています' };
    }

    if (this.waitingForColorChoice) {
      return { success: false, error: '色選択を待っています' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.playerId !== playerId) {
      return { success: false, error: 'あなたのターンではありません' };
    }

    // 手札が8枚以上で出せるカードがある場合、ドローできない（カードを出してスキップのみ）
    if (!this.hasDrawnThisTurn && currentPlayer.hand.length >= 8) {
      const playableCards = this.getPlayableCards(playerId);
      if (playableCards.length > 0) {
        return { success: false, error: '手札が8枚以上で出せるカードがあります。カードを出してください' };
      }
    }

    if (this.hasDrawnThisTurn) {
      const playableCards = this.getPlayableCards(playerId);
      if (currentPlayer.hand.length < 7 || playableCards.length > 0) {
        return { success: false, error: '既にカードを引いています' };
      }
    }

    this.refillDeckIfNeeded();

    const card = this.deck.draw();
    if (!card) {
      this.hasDrawnThisTurn = true;
      return { success: true };
    }

    currentPlayer.hand.push(card);
    this.hasDrawnThisTurn = true;

    // ツモドボンチェック
    this.dobonablePlayerIds.clear();
    this.isTsumoDobon = false;
    if (currentPlayer.isReach) {
      const effectiveCard = this.getEffectiveTopCard();
      if (effectiveCard) {
        if (this.gameMode === 'uno' && isUnoSpecialCard(effectiveCard)) {
          if (this.checkDobonConditionForSpecial(playerId, effectiveCard)) {
            this.dobonablePlayerIds.add(playerId);
            this.isTsumoDobon = true;
          }
        } else {
          const topCardValue = this.getCardValue(effectiveCard);
          if (this.checkDobonCondition(playerId, topCardValue)) {
            this.dobonablePlayerIds.add(playerId);
            this.isTsumoDobon = true;
          }
        }
      }
    }

    // 8枚以上で出せるカードがまだない場合
    const playableAfterDraw = this.getPlayableCards(playerId);

    if (currentPlayer.hand.length >= 8 && playableAfterDraw.length === 0) {
      const joker = this.getJokerFromHand(currentPlayer.hand);
      if (joker) {
        return { success: true, card, mustPlayJoker: true };
      }
      return { success: true, card, mustDrawAgain: true };
    }

    return { success: true, card };
  }

  // パス
  pass(playerId: string): { success: boolean; error?: string } {
    if (this.dobonPhase) {
      return { success: false, error: 'ドボン演出中です' };
    }

    if (this.dobonablePlayerIds.size > 0 || this.dobonGaeshiEligiblePlayerIds.size > 0) {
      return { success: false, error: 'ドボンの判定中です' };
    }

    const currentPlayer = this.getCurrentPlayer();
    if (currentPlayer.playerId !== playerId) {
      return { success: false, error: 'あなたのターンではありません' };
    }

    if (!this.hasDrawnThisTurn) {
      return { success: false, error: '先にカードを引いてください' };
    }

    if (currentPlayer.hand.length >= 8) {
      const playableCards = this.getPlayableCards(playerId);
      if (playableCards.length > 0) {
        return { success: false, error: '手札が8枚以上の場合、出せるカードがあればパスできません' };
      }
    }

    this.nextTurn();
    return { success: true };
  }

  // ドボン
  dobon(playerId: string): { success: boolean; error?: string; allResponded?: boolean } {
    if (!this.dobonablePlayerIds.has(playerId)) {
      return { success: false, error: 'ドボンできません' };
    }

    const player = this.findPlayer(playerId);
    if (!player) {
      return { success: false, error: 'プレイヤーが見つかりません' };
    }

    this.playersWhoDoboned.set(playerId, {
      playerId,
      playerName: player.playerName,
      handCount: player.hand.length,
    });
    this.dobonablePlayerIds.delete(playerId);

    if (this.dobonablePlayerIds.size === 0) {
      return this.resolveDobonPhase();
    }

    return { success: true, allResponded: false };
  }

  // ドボンをスキップ（見逃し: レート2倍）
  skipDobon(playerId: string): { success: boolean; error?: string; allResponded?: boolean } {
    if (!this.dobonablePlayerIds.has(playerId)) {
      return { success: false, error: 'ドボンの権利がありません' };
    }

    const player = this.findPlayer(playerId);
    this.playersWhoSkippedDobon.add(playerId);
    this.dobonablePlayerIds.delete(playerId);

    // 見逃し: レート2倍
    this.rate *= 2;
    this.minogashiPlayerName = player?.playerName;

    if (this.dobonablePlayerIds.size === 0) {
      return this.resolveDobonPhase();
    }

    return { success: true, allResponded: false };
  }

  // 全員のドボン選択完了後の処理
  private resolveDobonPhase(): { success: boolean; allResponded: boolean } {
    if (this.playersWhoDoboned.size === 0) {
      this.dobonTriggerPlayerId = undefined;
      this.dobonCardValue = undefined;
      this.nextTurn();

      // UNOモード: 効果適用
      if (this.pendingEffect) {
        this.applyPendingEffect();
      }

      return { success: true, allResponded: true };
    }

    // ドボン返しチェック
    if (this.dobonTriggerPlayerId && this.dobonCardValue !== undefined) {
      const triggerPlayer = this.findPlayer(this.dobonTriggerPlayerId);
      if (triggerPlayer && triggerPlayer.isReach) {
        let canGaeshi = false;

        if (this.gameMode === 'uno') {
          const topCard = this.getTopCard();
          if (isUnoSpecialCard(topCard)) {
            canGaeshi = this.checkDobonConditionForSpecial(this.dobonTriggerPlayerId, topCard);
          } else {
            canGaeshi = this.checkDobonCondition(this.dobonTriggerPlayerId, this.dobonCardValue);
          }
        } else {
          canGaeshi = this.checkDobonCondition(this.dobonTriggerPlayerId, this.dobonCardValue);
        }

        if (canGaeshi) {
          this.dobonGaeshiEligiblePlayerIds.add(this.dobonTriggerPlayerId);
          return { success: true, allResponded: true };
        }
      }
    }

    this.enterDobonPhase(false);
    return { success: true, allResponded: true };
  }

  // ドボン演出フェーズに入る
  private enterDobonPhase(isGaeshi: boolean): void {
    this.dobonPhase = 'success';
    this.pendingDobonIsGaeshi = isGaeshi;
    this.dobonTriggerCard = this.getTopCard();

    // 効果をクリア（ドボン成立時は効果無視）
    this.pendingEffect = undefined;

    if (!isGaeshi) {
      this.pendingDobonWinners = Array.from(this.playersWhoDoboned.values());
    }

    this.setLoserInfo();
  }

  // 敗者情報を設定
  private setLoserInfo(): void {
    if (this.pendingDobonIsGaeshi) {
      const dobonPlayerNames = Array.from(this.playersWhoDoboned.values()).map(p => p.playerName);
      const firstDobonPlayer = Array.from(this.playersWhoDoboned.values())[0];
      if (firstDobonPlayer) {
        this.loser = {
          playerId: firstDobonPlayer.playerId,
          playerName: dobonPlayerNames.join(', '),
          isTsumoDobon: false,
        };
      }
    } else if (this.isTsumoDobon && this.lastDiscardPlayerId && this.lastDiscardPlayerName) {
      this.loser = {
        playerId: this.lastDiscardPlayerId,
        playerName: this.lastDiscardPlayerName,
        isTsumoDobon: true,
      };
    } else if (this.dobonTriggerPlayerId) {
      const triggerPlayer = this.findPlayer(this.dobonTriggerPlayerId);
      if (triggerPlayer) {
        this.loser = {
          playerId: this.dobonTriggerPlayerId,
          playerName: triggerPlayer.playerName,
          isTsumoDobon: false,
        };
      }
    }
  }

  // ドボン演出フェーズを進める
  advanceDobonPhase(playerId: string): { success: boolean; error?: string } {
    if (!this.dobonPhase) {
      return { success: false, error: 'ドボン演出中ではありません' };
    }

    const isWinner = this.pendingDobonWinners.some(w => w.playerId === playerId);
    if (!isWinner) {
      return { success: false, error: 'ドボン成功者のみ操作できます' };
    }

    if (this.dobonPhase === 'success') {
      // ドボン成功 → ラストドロー実行 → カードめくりフェーズへ直行
      this.performLastDraw();
      this.calculateFinalScores();
      this.dobonPhase = 'result';
      this.revealedLastDrawCount = 0;
      return { success: true };
    }

    if (this.dobonPhase === 'result') {
      this.dobonPhase = undefined;
      this.pendingDobonWinners = [];
      this.pendingDobonIsGaeshi = false;
      this.pendingGaeshiTotalMultiplier = undefined;
      this.dobonTriggerCard = undefined;
      this.playersWhoDoboned.clear();
      this.playersWhoSkippedDobon.clear();
      this.dobonTriggerPlayerId = undefined;
      this.dobonCardValue = undefined;
      return { success: true };
    }

    return { success: false, error: '不明なフェーズです' };
  }

  // スコア計算
  private calculateFinalScores(): void {
    const lastNonJokerCard = this.gameMode === 'uno'
      ? this.lastDrawCards.find(c => !isWildCard(c))
      : this.lastDrawCards.find(c => !isJokerCard(c));
    const lastDrawValue = lastNonJokerCard
      ? (this.gameMode === 'uno' ? this.getLastDrawCardValue(lastNonJokerCard) : this.getCardValue(lastNonJokerCard))
      : 0;

    if (this.pendingDobonIsGaeshi && this.pendingGaeshiTotalMultiplier !== undefined) {
      const gaeshiWinner = this.pendingDobonWinners[0];
      const score = this.rate * lastDrawValue * this.pendingGaeshiTotalMultiplier;
      this.winners = [{
        playerId: gaeshiWinner.playerId,
        playerName: gaeshiWinner.playerName,
        handCount: gaeshiWinner.handCount,
        finalScore: score,
        isDobonGaeshi: true,
        gaeshiMultiplier: this.pendingGaeshiTotalMultiplier,
      }];
    } else {
      this.winners = [];
      for (const dobonInfo of this.pendingDobonWinners) {
        const handCountMultiplier = this.getHandCountMultiplier(dobonInfo.handCount);
        const score = this.rate * lastDrawValue * handCountMultiplier;
        this.winners.push({
          playerId: dobonInfo.playerId,
          playerName: dobonInfo.playerName,
          handCount: dobonInfo.handCount,
          finalScore: score,
        });
      }
    }
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

    let totalMultiplier = this.getHandCountMultiplier(player.hand.length);
    for (const [, dobonInfo] of this.playersWhoDoboned) {
      totalMultiplier += this.getHandCountMultiplier(dobonInfo.handCount);
    }

    this.dobonGaeshiEligiblePlayerIds.clear();

    this.pendingDobonWinners = [{
      playerId: player.playerId,
      playerName: player.playerName,
      handCount: player.hand.length,
    }];
    this.pendingGaeshiTotalMultiplier = totalMultiplier;
    this.enterDobonPhase(true);

    return { success: true };
  }

  // ドボン返しをスキップ
  skipDobonGaeshi(playerId: string): { success: boolean; error?: string } {
    if (!this.dobonGaeshiEligiblePlayerIds.has(playerId)) {
      return { success: false, error: 'ドボン返しの権利がありません' };
    }

    this.dobonGaeshiEligiblePlayerIds.delete(playerId);

    if (this.dobonGaeshiEligiblePlayerIds.size === 0) {
      this.enterDobonPhase(false);
    }

    return { success: true };
  }

  // ラストドロー実行
  private performLastDraw(): void {
    this.lastDrawCards = [];

    this.refillDeckIfNeeded();

    let lastDrawCard = this.deck.draw();
    while (lastDrawCard) {
      this.lastDrawCards.push(lastDrawCard);

      const isJokerLike = this.gameMode === 'uno' ? isWildCard(lastDrawCard) : isJokerCard(lastDrawCard);

      if (isJokerLike) {
        // ジョーカー/ワイルドならレート*2してもう一枚引く
        this.rate *= 2;
        this.refillDeckIfNeeded();
        lastDrawCard = this.deck.draw();
      } else {
        break;
      }
    }
  }

  // 手札枚数に応じた倍率を取得
  private getHandCountMultiplier(handCount: number): number {
    if (handCount === 1) return 2;
    if (handCount === 2) return 1;
    return handCount;
  }

  getWinner(): { winnerId?: string; winnerName?: string; winners?: WinnerInfo[] } {
    if (this.winners.length === 0) {
      return {};
    }
    const firstWinner = this.winners[0];
    return {
      winnerId: firstWinner.playerId,
      winnerName: firstWinner.playerName,
      winners: this.winners,
    };
  }

  isGameOver(): boolean {
    return this.winners.length > 0 && !this.dobonPhase;
  }

  isWaitingForDobon(): boolean {
    return this.dobonablePlayerIds.size > 0;
  }

  isWaitingForDobonGaeshi(): boolean {
    return this.dobonGaeshiEligiblePlayerIds.size > 0;
  }

  isInDobonPhase(): boolean {
    return this.dobonPhase !== undefined;
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
    for (const winner of this.pendingDobonWinners) {
      if (winner.playerId === oldPlayerId) {
        winner.playerId = newPlayerId;
      }
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
