import type { GameAction } from '../engine';
import type { GameView } from './view';

export const WS_PATH = '/ws';

/** A signed-in account, as everyone outside the password check sees it. */
export interface AuthUser {
  id: string;
  username: string;
}

/** What the account endpoints answer with on success. */
export interface AuthResponse {
  user: AuthUser;
  token: string;
  /** A table this account is still seated at, offered on the way back in. */
  activeRoom: string | null;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

/**
 * Every way in carries the session token when the player is signed in. The
 * server takes the name from the account rather than the message, so a client
 * cannot seat itself under someone else's name.
 */
export type ClientMessage =
  | { type: 'create'; name: string; session?: string }
  | { type: 'join'; code: string; name: string; session?: string }
  /** Reclaim a seat after a refresh, a dropped connection, or a closed tab. */
  | { type: 'resume'; code: string; token?: string; session?: string }
  | { type: 'start'; seed?: string }
  | { type: 'action'; action: GameAction }
  | { type: 'leave' };

export type ServerMessage =
  | { type: 'seated'; code: string; token: string; seatId: string }
  | { type: 'lobby'; code: string; players: LobbyPlayer[]; hostId: string; canStart: boolean }
  | { type: 'state'; view: GameView }
  | { type: 'error'; message: string };
