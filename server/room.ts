import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { GameAction, GameState } from '../src/engine';
import { IllegalActionError, MAX_PLAYERS, MIN_PLAYERS, applyAction, createGame } from '../src/engine';
import { toView } from '../src/net/view';
import type { LobbyPlayer, ServerMessage } from '../src/net/protocol';
import type { RoomSnapshot } from './store';

interface Seat {
  id: string;
  name: string;
  /** Secret handed to the client so it can reclaim this seat after a refresh. */
  token: string;
  /** The account sitting here, when the server has a database to know accounts. */
  userId: string | null;
  socket: WebSocket | null;
}

/**
 * One table. The room owns the authoritative game state: clients send actions
 * and receive a redacted view back, so a client can neither move out of turn
 * nor read a face-down chip.
 */
export class Room {
  readonly code: string;
  private seats: Seat[] = [];
  private hostId: string | null = null;
  private game: GameState | null = null;

  constructor(code: string) {
    this.code = code;
  }

  get isEmpty(): boolean {
    return this.seats.length === 0;
  }

  get started(): boolean {
    return this.game !== null;
  }

  get playerCount(): number {
    return this.seats.length;
  }

  /** The game as it stands, for writing to storage. */
  get state(): GameState | null {
    return this.game;
  }

  /** Nobody is looking at this table right now. */
  get idle(): boolean {
    return this.seats.every((seat) => seat.socket === null);
  }

  /** Seat a new player. Rejected once the dive has begun or the table is full. */
  join(name: string, socket: WebSocket, userId: string | null = null): Seat {
    if (this.game) throw new Error('That expedition has already set off');
    if (this.seats.length >= MAX_PLAYERS) throw new Error('That table is full');
    if (userId && this.seats.some((seat) => seat.userId === userId)) {
      throw new Error('You are already at this table');
    }

    const seat: Seat = {
      id: `p${this.seats.length + 1}`,
      name: name.trim().slice(0, 16) || `Diver ${this.seats.length + 1}`,
      token: randomUUID(),
      userId,
      socket,
    };
    this.seats.push(seat);
    this.hostId ??= seat.id;
    return seat;
  }

  /** Reconnect to an existing seat using the token issued when it was taken. */
  resume(token: string, socket: WebSocket): Seat {
    const seat = this.seats.find((s) => s.token === token);
    if (!seat) throw new Error('That seat is no longer held');
    return this.reattach(seat, socket);
  }

  /** The chair this account already holds here, if it holds one. */
  seatFor(userId: string): Seat | undefined {
    return this.seats.find((s) => s.userId === userId);
  }

  /**
   * Reconnect by account. This is what survives closing the tab: the seat is
   * owned by a signed-in user, so coming back needs nothing the browser had to
   * keep hold of.
   */
  resumeAs(userId: string, socket: WebSocket): Seat {
    const seat = this.seats.find((s) => s.userId === userId);
    if (!seat) throw new Error('You do not have a seat at that table');
    return this.reattach(seat, socket);
  }

  private reattach(seat: Seat, socket: WebSocket): Seat {
    // A second connection for one seat would leave a ghost receiving updates
    // that can no longer act, so the older socket is let go.
    if (seat.socket && seat.socket !== socket) seat.socket.close();
    seat.socket = socket;
    return seat;
  }

  /** Drop the socket but keep the seat, so a refresh does not forfeit a game. */
  disconnect(socket: WebSocket): void {
    const seat = this.seats.find((s) => s.socket === socket);
    if (!seat) return;
    seat.socket = null;

    // Before the dive starts an empty chair is just removed; mid-game the seat
    // is held open because the diver still has treasure and a position.
    if (!this.game) {
      this.seats = this.seats.filter((s) => s !== seat);
      if (this.hostId === seat.id) this.hostId = this.seats[0]?.id ?? null;
    }
  }

  start(seed: string | undefined, seatId: string): void {
    if (this.game) throw new Error('Already under way');
    if (seatId !== this.hostId) throw new Error('Only the host can start the dive');
    if (this.seats.length < MIN_PLAYERS) throw new Error(`Needs at least ${MIN_PLAYERS} divers`);

    this.game = createGame({
      players: this.seats.map((s) => ({ id: s.id, name: s.name })),
      ...(seed?.trim() ? { seed: seed.trim() } : {}),
    });
  }

  /**
   * Apply a move on behalf of a seat. Only the diver whose turn it is may act;
   * advancing past a round break is open to anyone at the table.
   */
  apply(seatId: string, action: GameAction): void {
    const game = this.game;
    if (!game) throw new Error('The dive has not started');

    if (action.type === 'continue') {
      if (game.phase !== 'roundEnd') return; // someone else already clicked through
      this.game = applyAction(game, action);
      return;
    }

    const active = game.players[game.currentPlayerIndex];
    if (!active || active.id !== seatId) throw new Error('It is not your turn');

    try {
      this.game = applyAction(game, action);
    } catch (err) {
      if (err instanceof IllegalActionError) throw new Error(err.message);
      throw err;
    }
  }

  lobby(): ServerMessage {
    const players: LobbyPlayer[] = this.seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      connected: seat.socket !== null,
      isHost: seat.id === this.hostId,
    }));
    return {
      type: 'lobby',
      code: this.code,
      players,
      hostId: this.hostId ?? '',
      canStart: this.seats.length >= MIN_PLAYERS,
    };
  }

  /** Push the current lobby or board to everyone still connected. */
  broadcast(): void {
    const message: ServerMessage = this.game
      ? { type: 'state', view: toView(this.game) }
      : this.lobby();
    const payload = JSON.stringify(message);
    for (const seat of this.seats) {
      if (seat.socket?.readyState === 1) seat.socket.send(payload);
    }
  }

  seatOf(socket: WebSocket): Seat | undefined {
    return this.seats.find((s) => s.socket === socket);
  }

  /** Write the table down, so it can be rebuilt after a restart. */
  snapshot(): RoomSnapshot {
    return {
      code: this.code,
      hostId: this.hostId,
      game: this.game,
      seats: this.seats.map((seat, ordinal) => ({
        id: seat.id,
        name: seat.name,
        userId: seat.userId,
        ordinal,
      })),
    };
  }

  /**
   * Rebuild a table from storage. Seats come back with nobody connected and a
   * fresh reclaim token — the old one was never written down, because an
   * account is what proves ownership of a chair.
   */
  static restore(snapshot: RoomSnapshot): Room {
    const room = new Room(snapshot.code);
    room.hostId = snapshot.hostId;
    room.game = snapshot.game;
    room.seats = snapshot.seats.map((seat) => ({
      id: seat.id,
      name: seat.name,
      token: randomUUID(),
      userId: seat.userId,
      socket: null,
    }));
    return room;
  }
}
