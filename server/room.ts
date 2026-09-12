import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { GameAction, GameState } from '../src/engine';
import { IllegalActionError, MAX_PLAYERS, MIN_PLAYERS, applyAction, createGame } from '../src/engine';
import { toView } from '../src/net/view';
import type { LobbyPlayer, ServerMessage } from '../src/net/protocol';

interface Seat {
  id: string;
  name: string;
  /** Secret handed to the client so it can reclaim this seat after a refresh. */
  token: string;
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

  /** Seat a new player. Rejected once the dive has begun or the table is full. */
  join(name: string, socket: WebSocket): Seat {
    if (this.game) throw new Error('That expedition has already set off');
    if (this.seats.length >= MAX_PLAYERS) throw new Error('That table is full');

    const seat: Seat = {
      id: `p${this.seats.length + 1}`,
      name: name.trim().slice(0, 16) || `Diver ${this.seats.length + 1}`,
      token: randomUUID(),
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
    seat.socket?.close();
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
}
