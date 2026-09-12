import type { GameAction } from '../engine';
import type { GameView } from './view';

export const WS_PATH = '/ws';

/**
 * Who a browser is playing as. Issued by the server the first time someone
 * gives a name, and kept from then on — there is no password, so this is an
 * identity rather than an account: it says which chairs are yours, not who
 * you are.
 */
export interface PlayerIdentity {
  id: string;
  name: string;
}

/** What the identity endpoints answer with. */
export interface IdentityResponse {
  player: PlayerIdentity | null;
  /** The secret this browser keeps to prove it is the same player. */
  token: string | null;
  /** A table this player is still seated at, offered on the way back in. */
  activeRoom: string | null;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
}

/**
 * Every way in carries the browser's identity token. The server takes the name
 * from the identity rather than the message, so a client cannot seat itself
 * under a name the server did not give it.
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
