import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
} from '../src/types/socket';
import { roomStore } from './store/RoomStore';
import { Player } from '../src/types/room';
import { GameManager } from './game/GameManager';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // 部屋を作成
    socket.on('room:create', ({ roomId, playerName, jokerCount, rate, myMark }) => {
      try {
        const host: Player = {
          id: socket.id,
          name: playerName,
          isHost: true,
          myMark,
        };

        // jokerCountが未定義または無効な場合はデフォルト値(2)を使用
        const validJokerCount = typeof jokerCount === 'number' && jokerCount >= 0 && jokerCount <= 4
          ? jokerCount
          : 2;
        // rateが未定義または無効な場合はデフォルト値(100)を使用
        const validRate = typeof rate === 'number' && rate > 0 ? rate : 100;
        const room = roomStore.createRoom(roomId, host, validJokerCount, validRate);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.playerId = socket.id;
        socket.data.playerName = playerName;

        socket.emit('room:created', { room, playerId: socket.id });
        console.log(`Room created: ${roomId} by ${playerName} (jokers: ${room.jokerCount}, rate: ${room.rate})`);
      } catch (error) {
        socket.emit('room:error', {
          message: error instanceof Error ? error.message : '部屋の作成に失敗しました'
        });
      }
    });

    // 部屋に参加
    socket.on('room:join', ({ roomId, playerName, myMark }) => {
      try {
        const player: Player = {
          id: socket.id,
          name: playerName,
          isHost: false,
          myMark,
        };

        const room = roomStore.addPlayer(roomId, player);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.playerId = socket.id;
        socket.data.playerName = playerName;

        socket.emit('room:joined', { room, playerId: socket.id });
        socket.to(roomId).emit('room:playerJoined', { player });
        io.to(roomId).emit('room:updated', { room });
        console.log(`${playerName} joined room: ${roomId}`);
      } catch (error) {
        socket.emit('room:error', {
          message: error instanceof Error ? error.message : '部屋への参加に失敗しました'
        });
      }
    });

    // 部屋を退出
    socket.on('room:leave', ({ roomId }) => {
      handleLeaveRoom(socket, roomId);
    });

    // ゲーム開始
    socket.on('game:start', ({ roomId }) => {
      try {
        const room = roomStore.getRoom(roomId);
        if (!room) {
          socket.emit('game:error', { message: '部屋が見つかりません' });
          return;
        }

        if (room.hostId !== socket.id) {
          socket.emit('game:error', { message: 'ホストのみがゲームを開始できます' });
          return;
        }

        if (room.players.length < room.minPlayers) {
          socket.emit('game:error', { message: `${room.minPlayers}人以上でゲームを開始できます` });
          return;
        }

        const game = roomStore.createGame(roomId);
        roomStore.setRoomStatus(roomId, 'playing');

        // 各プレイヤーに個別の状態を送信
        for (const player of room.players) {
          const playerSocket = io.sockets.sockets.get(player.id);
          if (playerSocket) {
            const gameState = game.getStateForPlayer(player.id);
            playerSocket.emit('game:started', { gameState });
          }
        }

        console.log(`Game started in room: ${roomId}`);
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'ゲームの開始に失敗しました'
        });
      }
    });

    // カードを出す（複数枚対応）
    socket.on('game:playCard', ({ roomId, cardIds }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.playCards(socket.id, cardIds);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'カードを出せませんでした' });
          return;
        }

        // 全プレイヤーに状態を送信
        broadcastGameState(io, roomId, game);

        // 勝利判定
        if (game.isGameOver()) {
          const { winnerId, winnerName } = game.getWinner();
          if (winnerId && winnerName) {
            io.to(roomId).emit('game:finished', { winnerId, winnerName });
            roomStore.setRoomStatus(roomId, 'finished');
          }
        }
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // カードを引く
    socket.on('game:drawCard', ({ roomId }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.drawCard(socket.id);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'カードを引けませんでした' });
          return;
        }

        // 全プレイヤーに状態を送信
        broadcastGameState(io, roomId, game);
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // パス
    socket.on('game:pass', ({ roomId }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.pass(socket.id);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'パスできませんでした' });
          return;
        }

        // 全プレイヤーに状態を送信
        broadcastGameState(io, roomId, game);
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // ドボン
    socket.on('game:dobon', ({ roomId }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.dobon(socket.id);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'ドボンできませんでした' });
          return;
        }

        // 全プレイヤーに状態を送信
        broadcastGameState(io, roomId, game);

        // 勝利通知
        const { winnerId, winnerName } = game.getWinner();
        if (winnerId && winnerName) {
          io.to(roomId).emit('game:finished', { winnerId, winnerName });
          roomStore.setRoomStatus(roomId, 'finished');
        }

        console.log(`Dobon! ${socket.data.playerName} won in room: ${roomId}`);
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // ドボンをスキップ
    socket.on('game:skipDobon', ({ roomId }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.skipDobon(socket.id);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'スキップできませんでした' });
          return;
        }

        // 全プレイヤーに状態を送信
        broadcastGameState(io, roomId, game);
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // 待機画面に戻る
    socket.on('game:backToLobby', ({ roomId }) => {
      try {
        const room = roomStore.getRoom(roomId);
        if (!room) {
          socket.emit('game:error', { message: '部屋が見つかりません' });
          return;
        }

        // ゲームを削除して待機状態に戻す
        roomStore.setRoomStatus(roomId, 'waiting');

        // 全プレイヤーに通知
        io.to(roomId).emit('game:backToLobby');
        io.to(roomId).emit('room:updated', { room: { ...room, status: 'waiting' } });

        console.log(`Game ended, back to lobby: ${roomId}`);
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // 切断時
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      if (socket.data.roomId) {
        handleLeaveRoom(socket, socket.data.roomId);
      }
    });
  });

  function handleLeaveRoom(socket: any, roomId: string) {
    // 退出前に部屋のプレイヤーリストを取得
    const roomBefore = roomStore.getRoom(roomId);
    const otherPlayerIds = roomBefore?.players
      .filter(p => p.id !== socket.id)
      .map(p => p.id) ?? [];

    const room = roomStore.removePlayer(roomId, socket.id);
    socket.leave(roomId);

    if (room) {
      // 部屋がまだ存在する場合
      io.to(roomId).emit('room:playerLeft', { playerId: socket.id });
      io.to(roomId).emit('room:updated', { room });
    } else if (otherPlayerIds.length > 0) {
      // 部屋が削除された場合、残っていたプレイヤーに通知
      for (const playerId of otherPlayerIds) {
        const playerSocket = io.sockets.sockets.get(playerId);
        if (playerSocket) {
          playerSocket.emit('room:deleted');
        }
      }
    }

    socket.data.roomId = undefined;
    console.log(`Player left room: ${roomId}`);
  }

  function broadcastGameState(io: Server, roomId: string, game: GameManager) {
    const room = roomStore.getRoom(roomId);
    if (!room) return;

    for (const player of room.players) {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        const gameState = game.getStateForPlayer(player.id);
        playerSocket.emit('game:stateUpdate', { gameState });
      }
    }
  }

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
