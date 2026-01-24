'use client';

import { useEffect, useState, useCallback } from 'react';
import { getSocket, connectSocket, disconnectSocket, TypedSocket } from '../lib/socket';
import { Room, Player } from '../types/room';
import { GameState } from '../types/game';
import { Suit } from '../types/card';

interface UseSocketReturn {
  socket: TypedSocket | null;
  isConnected: boolean;
  room: Room | null;
  playerId: string | null;
  gameState: GameState | null;
  error: string | null;
  createRoom: (roomId: string, playerName: string, jokerCount: number, rate: number, myMark: Suit) => void;
  joinRoom: (roomId: string, playerName: string, myMark: Suit) => void;
  leaveRoom: () => void;
  startGame: () => void;
  playCards: (cardIds: string[]) => void;
  drawCard: () => void;
  pass: () => void;
  dobon: () => void;
  skipDobon: () => void;
  backToLobby: () => void;
  clearError: () => void;
}

export function useSocket(): UseSocketReturn {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const s = connectSocket();
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    // 部屋イベント
    s.on('room:created', ({ room, playerId }) => {
      setRoom(room);
      setPlayerId(playerId);
    });

    s.on('room:joined', ({ room, playerId }) => {
      setRoom(room);
      setPlayerId(playerId);
    });

    s.on('room:updated', ({ room }) => {
      setRoom(room);
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
      setError('部屋が削除されました');
    });

    return () => {
      disconnectSocket();
    };
  }, []);

  const createRoom = useCallback((roomId: string, playerName: string, jokerCount: number, rate: number, myMark: Suit) => {
    socket?.emit('room:create', { roomId, playerName, jokerCount, rate, myMark });
  }, [socket]);

  const joinRoom = useCallback((roomId: string, playerName: string, myMark: Suit) => {
    socket?.emit('room:join', { roomId, playerName, myMark });
  }, [socket]);

  const leaveRoom = useCallback(() => {
    if (room) {
      socket?.emit('room:leave', { roomId: room.id });
      setRoom(null);
      setGameState(null);
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

  const backToLobby = useCallback(() => {
    if (room) {
      socket?.emit('game:backToLobby', { roomId: room.id });
    }
  }, [socket, room]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    socket,
    isConnected,
    room,
    playerId,
    gameState,
    error,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    playCards,
    drawCard,
    pass,
    dobon,
    skipDobon,
    backToLobby,
    clearError,
  };
}
