import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameAction } from '../engine';
import type { ClientMessage, LobbyPlayer, ServerMessage } from '../net/protocol';
import { WS_PATH } from '../net/protocol';
import type { GameView } from '../net/view';

export type JoinIntent =
  | { kind: 'create'; name: string }
  | { kind: 'join'; code: string; name: string }
  | { kind: 'resume'; code: string; token: string };

export type ConnectionStatus = 'connecting' | 'ready' | 'closed';

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

/** Where a seat is remembered so a refresh does not forfeit a game in progress. */
const SEAT_KEY = 'deep-sea-seat';

export function rememberSeat(code: string, token: string): void {
  try {
    sessionStorage.setItem(SEAT_KEY, JSON.stringify({ code, token }));
  } catch {
    // Private browsing can refuse storage; reconnecting is a convenience only.
  }
}

export function recallSeat(): { code: string; token: string } | null {
  try {
    const raw = sessionStorage.getItem(SEAT_KEY);
    return raw ? (JSON.parse(raw) as { code: string; token: string }) : null;
  } catch {
    return null;
  }
}

function socketUrl(): string {
  const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${location.host}${WS_PATH}`;
}

/**
 * Holds one table connection. The server owns the game, so this hook only
 * forwards intents and renders back whatever view arrives.
 */
export function useOnlineGame(intent: JoinIntent): OnlineController {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [code, setCode] = useState<string | null>(null);
  const [seatId, setSeatId] = useState<string | null>(null);
  const [lobby, setLobby] = useState<OnlineController['lobby']>(null);
  const [view, setView] = useState<GameView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = new WebSocket(socketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('ready');
      const hello: ClientMessage =
        intent.kind === 'create'
          ? { type: 'create', name: intent.name }
          : intent.kind === 'join'
            ? { type: 'join', code: intent.code, name: intent.name }
            : { type: 'resume', code: intent.code, token: intent.token };
      socket.send(JSON.stringify(hello));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as ServerMessage;
      switch (message.type) {
        case 'seated':
          setCode(message.code);
          setSeatId(message.seatId);
          setError(null);
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

    socket.onclose = () => setStatus('closed');
    socket.onerror = () => setError('Lost contact with the surface.');

    return () => {
      socket.onclose = null;
      // Closing mid-handshake logs a browser warning, so a socket that has not
      // finished opening yet is closed once it does.
      if (socket.readyState === WebSocket.OPEN) socket.close();
      else socket.addEventListener('open', () => socket.close(), { once: true });
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
