import { Card, Suit, GameMode, UnoColor } from './card';
import { Room, Player } from './room';
import { GameState } from './game';

// クライアント → サーバー
export interface ClientToServerEvents {
  'room:create': (data: { roomId: string; playerName: string; sessionId: string; jokerCount?: number; rate?: number; myMark: Suit; gameMode?: GameMode }) => void;
  'room:join': (data: { roomId: string; playerName: string; sessionId: string; myMark: Suit }) => void;
  'room:rejoin': (data: { roomId: string; sessionId: string; playerName: string }) => void;
  'room:leave': (data: { roomId: string }) => void;
  'game:start': (data: { roomId: string }) => void;
  'game:playCard': (data: { roomId: string; cardIds: string[] }) => void;
  'game:drawCard': (data: { roomId: string }) => void;
  'game:pass': (data: { roomId: string }) => void;
  'game:dobon': (data: { roomId: string }) => void;
  'game:skipDobon': (data: { roomId: string }) => void;
  'game:dobonGaeshi': (data: { roomId: string }) => void;
  'game:skipDobonGaeshi': (data: { roomId: string }) => void;
  'game:backToLobby': (data: { roomId: string }) => void;
  'game:confirmInitialRate': (data: { roomId: string }) => void;
  'game:advanceDobonPhase': (data: { roomId: string }) => void;
  'game:chooseColor': (data: { roomId: string; color: UnoColor }) => void;
  'game:revealLastDrawCard': (data: { roomId: string }) => void;
}

// サーバー → クライアント
export interface ServerToClientEvents {
  'room:created': (data: { room: Room; playerId: string }) => void;
  'room:joined': (data: { room: Room; playerId: string }) => void;
  'room:rejoined': (data: { room: Room; playerId: string; gameState?: GameState }) => void;
  'room:rejoinFailed': (data: { message: string }) => void;
  'room:updated': (data: { room: Room }) => void;
  'room:playerJoined': (data: { player: Player }) => void;
  'room:playerLeft': (data: { playerId: string }) => void;
  'room:playerDisconnected': (data: { playerId: string; playerName: string }) => void;
  'room:playerReconnected': (data: { playerId: string; playerName: string }) => void;
  'room:deleted': () => void;
  'room:error': (data: { message: string }) => void;
  'game:started': (data: { gameState: GameState }) => void;
  'game:stateUpdate': (data: { gameState: GameState }) => void;
  'game:cardPlayed': (data: { playerId: string; card: Card }) => void;
  'game:cardDrawn': (data: { playerId: string; card?: Card }) => void;
  'game:finished': (data: { winnerId: string; winnerName: string }) => void;
  'game:backToLobby': () => void;
  'game:error': (data: { message: string }) => void;
}

// Socket.ioの型付きソケット用
export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  roomId?: string;
  playerId?: string;
  playerName?: string;
}
