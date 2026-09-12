import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameAction } from '../engine';
import type { ClientMessage, LobbyPlayer, ServerMessage } from '../net/protocol';
import type { GameView } from '../net/view';
import { socketUrl } from './server-url';

export type JoinIntent =
  | { kind: 'create'; name: string }
  | { kind: 'join'; code: string; name: string }
  /** A seat to reclaim. The token covers a refresh; a signed-in player is
   *  recognised by their account and needs no token at all. */
  | { kind: 'resume'; code: string; token?: string };

export type ConnectionStatus = 'connecting' | 'ready' | 'reconnecting' | 'closed';

/**
 * How long to wait between attempts to get back in, growing so a server that
 * is restarting or asleep gets room to come back. The last value repeats for
 * as long as it takes; the seat is being held, so there is no reason to stop
 * trying while the player is still looking at the table.
 */
const RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 15_000];

export interface OnlineController {
  status: ConnectionStatus;
  code: string | null;
  seatId: string | null;
  lobby: { players: LobbyPlayer[]; hostId: string; canStart: boolean } | null;
  view: GameView | null;
  error: string | null;
  dispatch: (action: GameAction) => void;
  start: (seed: string) => void;
}

/**
 * Where a seat is remembered so leaving does not forfeit a game in progress.
 *
 * This is local rather than per-tab storage, so closing the tab and coming
 * back still finds the seat. For a signed-in player it is only a shortcut —
 * the account is what actually holds the chair — but it is the whole of the
 * mechanism on a server running without a database.
 */
const SEAT_KEY = 'deep-sea-seat';

export function rememberSeat(code: string, token: string): void {
  try {
    localStorage.setItem(SEAT_KEY, JSON.stringify({ code, token }));
  } catch {
    // Private browsing can refuse storage; reconnecting is a convenience only.
  }
}

export function recallSeat(): { code: string; token: string } | null {
  try {
    const raw = localStorage.getItem(SEAT_KEY);
    return raw ? (JSON.parse(raw) as { code: string; token: string }) : null;
  } catch {
    return null;
  }
}

/**
 * Holds one table connection. The server owns the game, so this hook only
 * forwards intents and renders back whatever view arrives.
 */
export function useOnlineGame(intent: JoinIntent, session: string | null): OnlineController {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [code, setCode] = useState<string | null>(null);
  const [seatId, setSeatId] = useState<string | null>(null);
  const [lobby, setLobby] = useState<OnlineController['lobby']>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  /**
   * The chair this connection was given. On a second attempt it is what gets
   * asked for: reconnecting with the original intent would open a whole new
   * table for someone who only meant to come back to this one.
   */
  const heldSeat = useRef<{ code: string; token: string } | null>(null);

  useEffect(() => {
    let abandoned = false;
    let socket: WebSocket | null = null;
    let retry: number | undefined;
    let attempt = 0;

    const connect = () => {
      const live = new WebSocket(socketUrl());
      socket = live;
      socketRef.current = live;

      live.onopen = () => {
        attempt = 0;
        setStatus('ready');
        // The session rides along on the way in: where the server remembers
        // players, it is what proves the seat is this one's.
        const credentials = session ? { session } : {};
        const held = heldSeat.current;
        const hello: ClientMessage = held
          ? { type: 'resume', code: held.code, token: held.token, ...credentials }
          : intent.kind === 'create'
            ? { type: 'create', name: intent.name, ...credentials }
            : intent.kind === 'join'
              ? { type: 'join', code: intent.code, name: intent.name, ...credentials }
              : { type: 'resume', code: intent.code, token: intent.token, ...credentials };
        live.send(JSON.stringify(hello));
      };

      live.onmessage = (event) => {
        const message = JSON.parse(String(event.data)) as ServerMessage;
        switch (message.type) {
          case 'seated':
            setCode(message.code);
            setSeatId(message.seatId);
            setError(null);
            heldSeat.current = { code: message.code, token: message.token };
            rememberSeat(message.code, message.token);
            break;
          case 'lobby':
            setCode(message.code);
            setLobby({
              players: message.players,
              hostId: message.hostId,
              canStart: message.canStart,
            });
            break;
          case 'state':
            setView(message.view);
            break;
          case 'error':
            setError(message.message);
            break;
        }
      };

      // A dropped connection is not the end of the game — the seat is held
      // open for exactly this. Keep trying, backing off so a server that is
      // asleep or restarting is not hammered, and say so rather than sending
      // the player back to the menu to do it by hand.
      live.onclose = () => {
        if (abandoned) return;
        setStatus('reconnecting');
        const wait = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)] ?? 15_000;
        attempt += 1;
        retry = window.setTimeout(connect, wait);
      };

      live.onerror = () => setError('Lost contact with the surface.');
    };

    connect();

    return () => {
      abandoned = true;
      window.clearTimeout(retry);
      const last = socket;
      if (!last) return;
      last.onclose = null;
      // Closing mid-handshake logs a browser warning, so a socket that has not
      // finished opening yet is closed once it does.
      if (last.readyState === WebSocket.OPEN) last.close();
      else last.addEventListener('open', () => last.close(), { once: true });
      socketRef.current = null;
    };
    // The intent is fixed for the life of this table; changing it means a new table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  const dispatch = useCallback(
    (action: GameAction) => {
      setError(null);
      send({ type: 'action', action });
    },
    [send],
  );

  const start = useCallback(
    (seed: string) => {
      setError(null);
      send(seed.trim() ? { type: 'start', seed: seed.trim() } : { type: 'start' });
    },
    [send],
  );

  return { status, code, seatId, lobby, view, error, dispatch, start };
}
