import { Room, Player, DEFAULT_ROOM_CONFIG, GameHistoryEntry } from '../../src/types/room';
import { GameManager } from '../game/GameManager';
import { GameMode } from '../../src/types/card';

export class RoomStore {
  private rooms: Map<string, Room> = new Map();
  private games: Map<string, GameManager> = new Map();
  // 履歴を記録済みのゲームインスタンス（多重記録防止）
  private recordedGames: WeakSet<GameManager> = new WeakSet();

  createRoom(
    roomId: string,
    host: Player,
    jokerCount: number = DEFAULT_ROOM_CONFIG.jokerCount,
    rate: number = DEFAULT_ROOM_CONFIG.rate,
    gameMode: GameMode = 'classic'
  ): Room {
    if (this.rooms.has(roomId)) {
      throw new Error('この部屋IDは既に使用されています');
    }

    const room: Room = {
      id: roomId,
      status: 'waiting',
      players: [host],
      hostId: host.id,
      maxPlayers: DEFAULT_ROOM_CONFIG.maxPlayers,
      minPlayers: DEFAULT_ROOM_CONFIG.minPlayers,
      jokerCount: Math.max(0, Math.min(4, jokerCount)),
      rate: Math.max(1, rate),
      gameMode,
    };

    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  addPlayer(roomId: string, player: Player): Room {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('部屋が見つかりません');
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('部屋が満員です');
    }

    if (room.status !== 'waiting') {
      throw new Error('ゲームが既に開始されています');
    }

    room.players.push(player);
    return room;
  }

  removePlayer(roomId: string, playerId: string): Room | null {
    const room = this.rooms.get(roomId);
    if (!room) {
      return null;
    }

    room.players = room.players.filter(p => p.id !== playerId);

    // プレイヤーがいなくなったら部屋を削除
    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      this.games.delete(roomId);
      return null;
    }

    // ホストが抜けた場合、次のプレイヤーをホストにする
    if (playerId === room.hostId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }

    return room;
  }

  setRoomStatus(roomId: string, status: Room['status']): void {
    const room = this.rooms.get(roomId);
    if (room) {
      room.status = status;
    }
  }

  createGame(roomId: string, startPlayerIndex?: number): GameManager {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('部屋が見つかりません');
    }

    const game = new GameManager(roomId, room.players, room.jokerCount, room.rate, room.gameMode, startPlayerIndex);
    this.games.set(roomId, game);
    return game;
  }

  getGame(roomId: string): GameManager | undefined {
    return this.games.get(roomId);
  }

  deleteRoom(roomId: string): void {
    this.rooms.delete(roomId);
    this.games.delete(roomId);
  }

  // 対戦履歴を記録（メモリ上のみ、部屋削除で消失）
  // 同一ゲームに対して複数の終了経路（advanceDobonPhase / backToLobby）から
  // 呼ばれても多重記録しないよう冪等にしている。
  recordGameHistory(roomId: string, game: GameManager): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    if (this.recordedGames.has(game)) return; // 記録済みならスキップ
    const winnerInfo = game.getWinner();
    const winners = winnerInfo.winners;
    if (!winners || winners.length === 0) return;
    const loser = game.getLoser();
    const totalScore = winners.reduce((s, w) => s + w.finalScore, 0);
    const isOnanii = !!(loser?.isTsumoDobon && winners.length > 0 && loser.playerId === winners[0].playerId);
    const entry: GameHistoryEntry = {
      winners: winners.map(w => ({ playerName: w.playerName, score: w.finalScore })),
      loserName: loser?.playerName ?? null,
      totalScore,
      timestamp: Date.now(),
      playerNames: room.players.map(p => p.name),
      isDobonGaeshi: winners.some(w => w.isDobonGaeshi),
      isWorst: winners.some(w => w.isWorst),
      isOnanii,
    };
    if (!room.gameHistory) room.gameHistory = [];
    room.gameHistory.push(entry);
    this.recordedGames.add(game);
  }

  // セッションIDでプレイヤーを検索
  findPlayerBySessionId(roomId: string, sessionId: string): Player | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    return room.players.find(p => p.sessionId === sessionId);
  }

  // プレイヤーのsocket.idを更新（再接続時）
  updatePlayerSocketId(roomId: string, sessionId: string, newSocketId: string): Player | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const player = room.players.find(p => p.sessionId === sessionId);
    if (player) {
      const oldId = player.id;
      player.id = newSocketId;
      player.isDisconnected = false;

      // ホストIDも更新
      if (room.hostId === oldId) {
        room.hostId = newSocketId;
      }
    }
    return player;
  }

  // プレイヤーを切断状態にする
  markPlayerDisconnected(roomId: string, playerId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.isDisconnected = true;
    }
  }

  // 全プレイヤーが切断中かチェック
  areAllPlayersDisconnected(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return true;
    return room.players.every(p => p.isDisconnected === true);
  }
}

export const roomStore = new RoomStore();
