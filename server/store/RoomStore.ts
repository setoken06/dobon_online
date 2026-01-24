import { Room, Player, DEFAULT_ROOM_CONFIG } from '../../src/types/room';
import { GameManager } from '../game/GameManager';

export class RoomStore {
  private rooms: Map<string, Room> = new Map();
  private games: Map<string, GameManager> = new Map();

  createRoom(
    roomId: string,
    host: Player,
    jokerCount: number = DEFAULT_ROOM_CONFIG.jokerCount,
    rate: number = DEFAULT_ROOM_CONFIG.rate
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
      jokerCount: Math.max(0, Math.min(4, jokerCount)), // 0-4に制限
      rate: Math.max(1, rate), // 最低1
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

  createGame(roomId: string): GameManager {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('部屋が見つかりません');
    }

    const game = new GameManager(roomId, room.players, room.jokerCount, room.rate);
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
}

export const roomStore = new RoomStore();
