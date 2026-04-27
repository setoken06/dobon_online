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
const hostname = '0.0.0.0';  // 本番環境では0.0.0.0にバインド
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
    socket.on('room:create', ({ roomId, playerName, sessionId, jokerCount, rate, myMark, gameMode, oyakoRule }) => {
      try {
        const host: Player = {
          id: socket.id,
          sessionId,
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
        const validGameMode = gameMode === 'uno' ? 'uno' as const : 'classic' as const;
        const validOyakoRule = oyakoRule === true;
        const room = roomStore.createRoom(roomId, host, validJokerCount, validRate, validGameMode, validOyakoRule);
        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.playerId = socket.id;
        socket.data.playerName = playerName;

        socket.emit('room:created', { room, playerId: socket.id });
        console.log(`Room created: ${roomId} by ${playerName} (mode: ${room.gameMode}, jokers: ${room.jokerCount}, rate: ${room.rate})`);
      } catch (error) {
        socket.emit('room:error', {
          message: error instanceof Error ? error.message : '部屋の作成に失敗しました'
        });
      }
    });

    // 部屋に参加
    socket.on('room:join', ({ roomId, playerName, sessionId, myMark }) => {
      try {
        const player: Player = {
          id: socket.id,
          sessionId,
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

    // 部屋に再参加
    socket.on('room:rejoin', ({ roomId, sessionId, playerName }) => {
      try {
        const room = roomStore.getRoom(roomId);
        if (!room) {
          socket.emit('room:rejoinFailed', { message: '部屋が見つかりません' });
          return;
        }

        const player = roomStore.findPlayerBySessionId(roomId, sessionId);
        if (!player) {
          socket.emit('room:rejoinFailed', { message: 'セッションが見つかりません' });
          return;
        }

        // socket.idを更新
        const updatedPlayer = roomStore.updatePlayerSocketId(roomId, sessionId, socket.id);
        if (!updatedPlayer) {
          socket.emit('room:rejoinFailed', { message: '復帰に失敗しました' });
          return;
        }

        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.playerId = socket.id;
        socket.data.playerName = playerName;

        // ゲーム中の場合はGameManagerのプレイヤーIDも更新
        const game = roomStore.getGame(roomId);
        if (game) {
          game.updatePlayerId(sessionId, socket.id);
        }

        // 最新の部屋情報を取得
        const updatedRoom = roomStore.getRoom(roomId);
        const gameState = game?.getStateForPlayer(socket.id);

        socket.emit('room:rejoined', {
          room: updatedRoom!,
          playerId: socket.id,
          gameState,
        });

        // 他のプレイヤーに復帰を通知
        socket.to(roomId).emit('room:playerReconnected', {
          playerId: socket.id,
          playerName,
        });
        io.to(roomId).emit('room:updated', { room: updatedRoom! });

        console.log(`${playerName} rejoined room: ${roomId}`);
      } catch (error) {
        socket.emit('room:rejoinFailed', {
          message: error instanceof Error ? error.message : '復帰に失敗しました',
        });
      }
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

        let startPlayerIndex: number | undefined;

        // 親子ルール: ラウンド初期化
        if (room.oyakoRule) {
          const oyaIndex = Math.floor(Math.random() * room.players.length);
          startPlayerIndex = oyaIndex;
          const roundState = {
            currentOyaIndex: oyaIndex,
            currentGameNumber: 1,
            totalGames: room.players.length,
            playerScores: room.players.map((p, i) => ({
              playerId: p.id,
              playerName: p.name,
              cumulativeScore: 0,
              wasOya: i === oyaIndex,
            })),
            isRoundComplete: false,
            oyaPlayerId: room.players[oyaIndex].id,
            oyaPlayerName: room.players[oyaIndex].name,
          };
          roomStore.setRoundState(roomId, roundState);
        }

        const game = roomStore.createGame(roomId, startPlayerIndex);
        roomStore.setRoomStatus(roomId, 'playing');

        // 親子ルール: ゲームに親情報をセット
        if (room.oyakoRule) {
          const roundState = roomStore.getRoundState(roomId)!;
          game.setOyaPlayerId(roundState.oyaPlayerId);
          game.setOyakoRoundState(roundState);
        }

        // 各プレイヤーに個別の状態を送信
        for (const player of room.players) {
          const playerSocket = io.sockets.sockets.get(player.id);
          if (playerSocket) {
            const gameState = game.getStateForPlayer(player.id);
            playerSocket.emit('game:started', { gameState });
          }
        }

        console.log(`Game started in room: ${roomId}${room.oyakoRule ? ' (oyako rule)' : ''}`);
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

        // 全員が選択完了した場合、勝利通知（ドボン返しがなければ）
        if (result.allResponded && game.isGameOver()) {
          const { winnerId, winnerName, winners } = game.getWinner();
          if (winnerId && winnerName) {
            io.to(roomId).emit('game:finished', { winnerId, winnerName });
            roomStore.setRoomStatus(roomId, 'finished');
            const winnerNames = winners?.map(w => w.playerName).join(', ') || winnerName;
            console.log(`Dobon! ${winnerNames} won in room: ${roomId}`);
          }
        }
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

        // 全員が選択完了した場合、勝利通知（ドボン返しがなければ）
        if (result.allResponded && game.isGameOver()) {
          const { winnerId, winnerName, winners } = game.getWinner();
          if (winnerId && winnerName) {
            io.to(roomId).emit('game:finished', { winnerId, winnerName });
            roomStore.setRoomStatus(roomId, 'finished');
            const winnerNames = winners?.map(w => w.playerName).join(', ') || winnerName;
            console.log(`Dobon! ${winnerNames} won in room: ${roomId}`);
          }
        }
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // ドボン返し
    socket.on('game:dobonGaeshi', ({ roomId }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.dobonGaeshi(socket.id);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'ドボン返しできませんでした' });
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

        console.log(`Dobon Gaeshi! ${socket.data.playerName} won in room: ${roomId}`);
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // ドボン返しをスキップ
    socket.on('game:skipDobonGaeshi', ({ roomId }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.skipDobonGaeshi(socket.id);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'スキップできませんでした' });
          return;
        }

        // 全プレイヤーに状態を送信
        broadcastGameState(io, roomId, game);

        // ドボン返しがスキップされて元のドボンが成立した場合、勝利通知
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

    // ドボン演出フェーズを進める
    socket.on('game:advanceDobonPhase', ({ roomId }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.advanceDobonPhase(socket.id);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'フェーズを進められませんでした' });
          return;
        }

        // 全プレイヤーに状態を送信
        broadcastGameState(io, roomId, game);

        // ゲーム終了判定（resultフェーズ完了後）
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

    // 初期レートボーナス確認
    socket.on('game:confirmInitialRate', ({ roomId }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.confirmInitialRate(socket.id);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || '確認できませんでした' });
          return;
        }

        // 全プレイヤーに状態を送信
        broadcastGameState(io, roomId, game);

        console.log(`Initial rate confirmed in room: ${roomId}`);
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // ラストドローカード公開
    socket.on('game:revealLastDrawCard', ({ roomId }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.revealLastDrawCard(socket.id);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || 'カードを公開できませんでした' });
          return;
        }

        broadcastGameState(io, roomId, game);
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // ワイルド使用後の色選択
    socket.on('game:chooseColor', ({ roomId, color }) => {
      try {
        const game = roomStore.getGame(roomId);
        if (!game) {
          socket.emit('game:error', { message: 'ゲームが見つかりません' });
          return;
        }

        const result = game.chooseColor(socket.id, color);
        if (!result.success) {
          socket.emit('game:error', { message: result.error || '色を選択できませんでした' });
          return;
        }

        broadcastGameState(io, roomId, game);
      } catch (error) {
        socket.emit('game:error', {
          message: error instanceof Error ? error.message : 'エラーが発生しました'
        });
      }
    });

    // 親子ルール: 次の局へ進む
    socket.on('game:nextRoundGame', ({ roomId }) => {
      try {
        const room = roomStore.getRoom(roomId);
        if (!room || !room.oyakoRule) return;

        const roundState = roomStore.getRoundState(roomId);
        if (!roundState || roundState.isRoundComplete) return;

        // スコアはGameManager.calculateFinalScores()で既に加算済み

        // 次の親へ
        roundState.currentOyaIndex = (roundState.currentOyaIndex + 1) % room.players.length;
        roundState.currentGameNumber += 1;
        roundState.oyaPlayerId = room.players[roundState.currentOyaIndex].id;
        roundState.oyaPlayerName = room.players[roundState.currentOyaIndex].name;
        roundState.playerScores[roundState.currentOyaIndex].wasOya = true;

        if (roundState.currentGameNumber > roundState.totalGames) {
          roundState.isRoundComplete = true;
          roomStore.setRoundState(roomId, roundState);

          // 最終局: 待機画面に戻す
          roomStore.clearRoundState(roomId);
          roomStore.setRoomStatus(roomId, 'waiting');
          io.to(roomId).emit('game:backToLobby');
          io.to(roomId).emit('room:updated', { room: { ...room, status: 'waiting' } });
          console.log(`Oyako round complete, back to lobby: ${roomId}`);
          return;
        }

        roomStore.setRoundState(roomId, roundState);

        // 新しいゲームを作成
        const game = roomStore.createGame(roomId, roundState.currentOyaIndex);
        game.setOyaPlayerId(roundState.oyaPlayerId);
        game.setOyakoRoundState(roundState);

        // 各プレイヤーに新しいゲーム状態を送信
        for (const player of room.players) {
          const playerSocket = io.sockets.sockets.get(player.id);
          if (playerSocket) {
            playerSocket.emit('game:started', { gameState: game.getStateForPlayer(player.id) });
          }
        }

        console.log(`Next round game ${roundState.currentGameNumber}/${roundState.totalGames} in room: ${roomId}`);
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

        // 親子ルール: ラウンド状態をクリア（スコアはGameManager側で既に加算済み）
        if (room.oyakoRule) {
          roomStore.clearRoundState(roomId);
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

    // 切断時（タブ切り替えなど）- 復帰可能な離席扱い
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      if (socket.data.roomId) {
        handleDisconnect(socket, socket.data.roomId);
      }
    });
  });

  // 切断処理（復帰可能）
  function handleDisconnect(socket: any, roomId: string) {
    const room = roomStore.getRoom(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    const playerName = player.name;

    // プレイヤーを離席状態にする
    roomStore.markPlayerDisconnected(roomId, socket.id);
    socket.leave(roomId);

    // 全員が離席した場合は部屋を削除
    if (roomStore.areAllPlayersDisconnected(roomId)) {
      console.log(`All players disconnected, deleting room: ${roomId}`);
      roomStore.deleteRoom(roomId);
      return;
    }

    // 他のプレイヤーに離席を通知
    const updatedRoom = roomStore.getRoom(roomId);
    if (updatedRoom) {
      io.to(roomId).emit('room:playerDisconnected', { playerId: socket.id, playerName });
      io.to(roomId).emit('room:updated', { room: updatedRoom });
    }

    console.log(`Player disconnected (can rejoin): ${playerName} in room ${roomId}`);
  }

  // 完全退出処理（room:leave時）
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

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
