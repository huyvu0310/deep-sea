import type { GameAction } from '../engine';
import type { GameView } from './view';

export const WS_PATH = '/ws';

export interface LobbyPlayer {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

export type ClientMessage =
  | { type: 'create'; name: string }
  | { type: 'join'; code: string; name: string }
  /** Reclaim a seat after a refresh or a dropped connection. */
  | { type: 'resume'; code: string; token: string }
  | { type: 'start'; seed?: string }
  | { type: 'action'; action: GameAction }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'seated'; code: string; token: string; seatId: string }
  | { type: 'lobby'; code: string; players: LobbyPlayer[]; hostId: string; canStart: boolean }
  | { type: 'state'; view: GameView }
  | { type: 'error'; message: string };
