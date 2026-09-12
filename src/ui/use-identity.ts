import { useCallback, useEffect, useState } from 'react';
import type { IdentityResponse, PlayerIdentity } from '../net/protocol';
import { apiUrl } from './server-url';

/** Where this browser's identity lives between visits. */
const IDENTITY_KEY = 'deep-sea-player';

interface Stored {
  player: PlayerIdentity;
  token: string;
}

function remember(stored: Stored | null): void {
  try {
    if (stored) localStorage.setItem(IDENTITY_KEY, JSON.stringify(stored));
    else localStorage.removeItem(IDENTITY_KEY);
  } catch {
    // Private browsing can refuse storage; the identity then lasts this visit.
  }
}

function recall(): Stored | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export interface Identity {
  /** False until the first word from the server, so screens do not flicker. */
  ready: boolean;
  /** False on a server with no database, where nothing is remembered. */
  remembered: boolean;
  player: PlayerIdentity | null;
  token: string | null;
  /** A table this player is still seated at, if any. */
  activeRoom: string | null;
  /**
   * Claim this name and make sure the browser has an identity behind it,
   * answering with the token to play under. Called on the way into a table.
   */
  claim: (name: string) => Promise<string | null>;
  /** Re-check with the server, so a stale rejoin offer does not linger. */
  refresh: () => void;
}

/**
 * Holds who this browser is playing as.
 *
 * There is no sign-in: the first time someone gives a name the server issues an
 * identity and the browser keeps it. That is enough to hand a chair back after
 * a closed tab or a restarted server, and it costs the player no extra step.
 */
export function useIdentity(): Identity {
  const [stored, setStored] = useState<Stored | null>(() => recall());
  const [remembered, setRemembered] = useState(true);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * Ask the server who this browser is. One call settles both questions —
   * whether this server remembers players at all, and whether the identity we
   * kept is still good — and brings back the table we are still seated at.
   */
  const probe = useCallback(async (token: string | null) => {
    try {
      const response = await fetch(apiUrl('/api/player'), {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });

      if (response.status === 503) {
        setRemembered(false);
        return;
      }
      setRemembered(true);

      if (response.ok) {
        const payload = (await response.json()) as IdentityResponse;
        if (payload.player && payload.token) {
          const next = { player: payload.player, token: payload.token };
          setStored(next);
          remember(next);
          setActiveRoom(payload.activeRoom);
          return;
        }
      }

      // Nobody yet, or the identity we kept has lapsed. Either way there is
      // nothing worth holding on to, and a new one costs only a name.
      setStored(null);
      remember(null);
      setActiveRoom(null);
    } catch {
      // Offline, or the server is asleep. Nothing here should throw away an
      // identity over a blip; play falls back to the name as typed.
    }
  }, []);

  useEffect(() => {
    void probe(recall()?.token ?? null).finally(() => setReady(true));
  }, [probe]);

  const claim = useCallback(
    async (name: string): Promise<string | null> => {
      const held = stored?.token ?? null;
      try {
        const response = await fetch(apiUrl('/api/player'), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(held ? { authorization: `Bearer ${held}` } : {}),
          },
          body: JSON.stringify({ name }),
        });
        if (!response.ok) return held;

        const payload = (await response.json()) as IdentityResponse;
        if (!payload.player || !payload.token) return held;

        const next = { player: payload.player, token: payload.token };
        setStored(next);
        remember(next);
        setActiveRoom(payload.activeRoom);
        return payload.token;
      } catch {
        // A server that cannot be reached for an identity is about to fail the
        // socket too, and that is where the player will be told.
        return held;
      }
    },
    [stored],
  );

  return {
    ready,
    remembered,
    player: stored?.player ?? null,
    token: stored?.token ?? null,
    activeRoom,
    claim,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refresh: useCallback(() => void probe(stored?.token ?? null), [probe, stored]),
  };
}
