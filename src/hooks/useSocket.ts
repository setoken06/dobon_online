'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket, connectSocket, disconnectSocket, TypedSocket } from '../lib/socket';
import { Room, Player } from '../types/room';
import { GameState } from '../types/game';
import { Suit, GameMode, UnoColor } from '../types/card';

// セッション管理用のlocalStorageキー
const SESSION_KEYS = {
  sessionId: 'dobon_sessionId',
  roomId: 'dobon_currentRoomId',
  playerName: 'dobon_currentPlayerName',
};

// UUIDを生成
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// セッション情報を取得または生成
function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return generateSessionId();

  let sessionId = localStorage.getItem(SESSION_KEYS.sessionId);
  if (!sessionId) {
    sessionId = generateSessionId();
    localStorage.setItem(SESSION_KEYS.sessionId, sessionId);
  }
  return sessionId;
}

// セッション情報を保存
function saveSessionInfo(roomId: string, playerName: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SESSION_KEYS.roomId, roomId);
  localStorage.setItem(SESSION_KEYS.playerName, playerName);
}

// セッション情報をクリア
function clearSessionInfo(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_KEYS.roomId);
  localStorage.removeItem(SESSION_KEYS.playerName);
}

// セッション情報を取得
function getSessionInfo(): { roomId: string | null; playerName: string | null; sessionId: string } {
  if (typeof window === 'undefined') {
    return { roomId: null, playerName: null, sessionId: generateSessionId() };
  }
  return {
    roomId: localStorage.getItem(SESSION_KEYS.roomId),
    playerName: localStorage.getItem(SESSION_KEYS.playerName),
    sessionId: getOrCreateSessionId(),
  };
}

interface UseSocketReturn {
  socket: TypedSocket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  canRejoin: boolean;
  rejoinInfo: { roomId: string; playerName: string } | null;
  room: Room | null;
  playerId: string | null;
  gameState: GameState | null;
  error: string | null;
  disconnectedPlayers: Map<string, string>;
  createRoom: (roomId: string, playerName: string, jokerCount: number, rate: number, myMark: Suit, gameMode?: GameMode, oyakoRule?: boolean) => void;
  joinRoom: (roomId: string, playerName: string, myMark: Suit) => void;
  rejoinRoom: () => void;
  cancelRejoin: () => void;
  leaveRoom: () => void;
  startGame: () => void;
  playCards: (cardIds: string[]) => void;
  drawCard: () => void;
  pass: () => void;
  dobon: () => void;
  skipDobon: () => void;
  dobonGaeshi: () => void;
  skipDobonGaeshi: () => void;
  backToLobby: () => void;
  nextRoundGame: () => void;
  confirmInitialRate: () => void;
  advanceDobonPhase: () => void;
  chooseColor: (color: UnoColor) => void;
  revealLastDrawCard: () => void;
  clearError: () => void;
}

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [canRejoin, setCanRejoin] = useState(false);
  const [rejoinInfo, setRejoinInfo] = useState<{ roomId: string; playerName: string } | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<Map<string, string>>(new Map());
  const lastSocketIdRef = useRef<string | null>(null);

  useEffect(() => {
    const s = connectSocket();
    setSocket(s);

    // 復帰可能かチェックする関数
    const checkCanRejoin = () => {
      const { roomId, playerName } = getSessionInfo();
      if (roomId && playerName) {
        setCanRejoin(true);
        setRejoinInfo({ roomId, playerName });
      }
    };

    s.on('connect', () => {
      setIsConnected(true);
      const currentSocketId = s.id;

      // セッション情報があり、socket.idが変わっている場合は復帰可能状態に
      if (currentSocketId !== lastSocketIdRef.current) {
        checkCanRejoin();
      }
      lastSocketIdRef.current = currentSocketId ?? null;
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    // タブがアクティブになった時に復帰可能かチェック
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && s.connected) {
        checkCanRejoin();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 部屋イベント
    s.on('room:created', ({ room, playerId }) => {
      setRoom(room);
      setPlayerId(playerId);
    });

    s.on('room:joined', ({ room, playerId }) => {
      setRoom(room);
      setPlayerId(playerId);
    });

    // 再接続成功
    s.on('room:rejoined', ({ room, playerId, gameState }) => {
      setIsReconnecting(false);
      setCanRejoin(false);
      setRejoinInfo(null);
      setRoom(room);
      setPlayerId(playerId);
      if (gameState) {
        setGameState(gameState);
      }
      // 離席中プレイヤーリストを更新
      const disconnected = new Map<string, string>();
      room.players.forEach(p => {
        if (p.isDisconnected) {
          disconnected.set(p.id, p.name);
        }
      });
      setDisconnectedPlayers(disconnected);
      console.log('Rejoin successful');
    });

    // 再接続失敗
    s.on('room:rejoinFailed', ({ message }) => {
      setIsReconnecting(false);
      setCanRejoin(false);
      setRejoinInfo(null);
      clearSessionInfo();
      setError('復帰に失敗しました: ' + message);
      console.log('Rejoin failed:', message);
    });

    s.on('room:updated', ({ room }) => {
      setRoom(room);
      // 離席中プレイヤーリストを更新
      const disconnected = new Map<string, string>();
      room.players.forEach(p => {
        if (p.isDisconnected) {
          disconnected.set(p.id, p.name);
        }
      });
      setDisconnectedPlayers(disconnected);
    });

    s.on('room:playerJoined', ({ player }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: [...prev.players, player],
        };
      });
    });

    s.on('room:playerLeft', ({ playerId }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.filter(p => p.id !== playerId),
        };
      });
      // 離席リストからも削除
      setDisconnectedPlayers(prev => {
        const next = new Map(prev);
        next.delete(playerId);
        return next;
      });
    });

    // プレイヤーが離席
    s.on('room:playerDisconnected', ({ playerId, playerName }) => {
      setDisconnectedPlayers(prev => {
        const next = new Map(prev);
        next.set(playerId, playerName);
        return next;
      });
    });

    // プレイヤーが復帰
    s.on('room:playerReconnected', ({ playerId, playerName }) => {
      setDisconnectedPlayers(prev => {
        const next = new Map(prev);
        next.delete(playerId);
        return next;
      });
    });

    s.on('room:error', ({ message }) => {
      setError(message);
    });

    // ゲームイベント
    s.on('game:started', ({ gameState }) => {
      setGameState(gameState);
      setRoom(prev => prev ? { ...prev, status: 'playing' } : null);
    });

    s.on('game:stateUpdate', ({ gameState }) => {
      setGameState(gameState);
    });

    s.on('game:finished', ({ winnerId, winnerName }) => {
      setGameState(prev => prev ? {
        ...prev,
        status: 'finished',
        winnerId,
        winnerName,
      } : null);
      setRoom(prev => prev ? { ...prev, status: 'finished' } : null);
    });

    s.on('game:error', ({ message }) => {
      setError(message);
    });

    s.on('game:backToLobby', () => {
      setGameState(null);
      setRoom(prev => prev ? { ...prev, status: 'waiting' } : null);
    });

    // 部屋が削除された場合
    s.on('room:deleted', () => {
      setRoom(null);
      setGameState(null);
      clearSessionInfo();
      setDisconnectedPlayers(new Map());
      setError('部屋が削除されました');
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      disconnectSocket();
    };
  }, []);

  const createRoom = useCallback((roomId: string, playerName: string, jokerCount: number, rate: number, myMark: Suit, gameMode?: GameMode, oyakoRule?: boolean) => {
    const sessionId = getOrCreateSessionId();
    saveSessionInfo(roomId, playerName);
    socket?.emit('room:create', { roomId, playerName, sessionId, jokerCount, rate, myMark, gameMode, oyakoRule });
  }, [socket]);

  const joinRoom = useCallback((roomId: string, playerName: string, myMark: Suit) => {
    const sessionId = getOrCreateSessionId();
    saveSessionInfo(roomId, playerName);
    socket?.emit('room:join', { roomId, playerName, sessionId, myMark });
  }, [socket]);

  const rejoinRoom = useCallback(() => {
    const { roomId, playerName, sessionId } = getSessionInfo();
    if (roomId && playerName && socket?.connected) {
      console.log('Attempting rejoin...', { roomId, sessionId, socketId: socket.id });
      setIsReconnecting(true);
      socket.emit('room:rejoin', { roomId, sessionId, playerName });
    }
  }, [socket]);

  const cancelRejoin = useCallback(() => {
    setCanRejoin(false);
    setRejoinInfo(null);
    clearSessionInfo();
  }, []);

  const leaveRoom = useCallback(() => {
    if (room) {
      socket?.emit('room:leave', { roomId: room.id });
      setRoom(null);
      setGameState(null);
      clearSessionInfo();
      setDisconnectedPlayers(new Map());
    }
  }, [socket, room]);

  const startGame = useCallback(() => {
    if (room) {
      socket?.emit('game:start', { roomId: room.id });
    }
  }, [socket, room]);

  const playCards = useCallback((cardIds: string[]) => {
    if (room) {
      socket?.emit('game:playCard', { roomId: room.id, cardIds });
    }
  }, [socket, room]);

  const drawCard = useCallback(() => {
    if (room) {
      socket?.emit('game:drawCard', { roomId: room.id });
    }
  }, [socket, room]);

  const pass = useCallback(() => {
    if (room) {
      socket?.emit('game:pass', { roomId: room.id });
    }
  }, [socket, room]);

  const dobon = useCallback(() => {
    if (room) {
      socket?.emit('game:dobon', { roomId: room.id });
    }
  }, [socket, room]);

  const skipDobon = useCallback(() => {
    if (room) {
      socket?.emit('game:skipDobon', { roomId: room.id });
    }
  }, [socket, room]);

  const dobonGaeshi = useCallback(() => {
    if (room) {
      socket?.emit('game:dobonGaeshi', { roomId: room.id });
    }
  }, [socket, room]);

  const skipDobonGaeshi = useCallback(() => {
    if (room) {
      socket?.emit('game:skipDobonGaeshi', { roomId: room.id });
    }
  }, [socket, room]);

  const backToLobby = useCallback(() => {
    if (room) {
      socket?.emit('game:backToLobby', { roomId: room.id });
    }
  }, [socket, room]);

  const nextRoundGame = useCallback(() => {
    if (room) {
      socket?.emit('game:nextRoundGame', { roomId: room.id });
    }
  }, [socket, room]);

  const confirmInitialRate = useCallback(() => {
    if (room) {
      socket?.emit('game:confirmInitialRate', { roomId: room.id });
    }
  }, [socket, room]);

  const advanceDobonPhase = useCallback(() => {
    if (room) {
      socket?.emit('game:advanceDobonPhase', { roomId: room.id });
    }
  }, [socket, room]);

  const chooseColor = useCallback((color: UnoColor) => {
    if (room) {
      socket?.emit('game:chooseColor', { roomId: room.id, color });
    }
  }, [socket, room]);

  const revealLastDrawCard = useCallback(() => {
    if (room) {
      socket?.emit('game:revealLastDrawCard', { roomId: room.id });
    }
  }, [socket, room]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    socket,
    isConnected,
    isReconnecting,
    canRejoin,
    rejoinInfo,
    room,
    playerId,
    gameState,
    error,
    disconnectedPlayers,
    createRoom,
    joinRoom,
    rejoinRoom,
    cancelRejoin,
    leaveRoom,
    startGame,
    playCards,
    drawCard,
    pass,
    dobon,
    skipDobon,
    dobonGaeshi,
    skipDobonGaeshi,
    backToLobby,
    nextRoundGame,
    confirmInitialRate,
    advanceDobonPhase,
    chooseColor,
    revealLastDrawCard,
    clearError,
  };
}
