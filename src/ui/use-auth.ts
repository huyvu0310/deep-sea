import { useCallback, useEffect, useState } from 'react';
import type { AuthResponse, AuthUser } from '../net/protocol';
import { apiUrl } from './server-url';

/** Where the signed-in session lives between visits. */
const AUTH_KEY = 'deep-sea-auth';

interface Stored {
  user: AuthUser;
  token: string;
}

function remember(stored: Stored | null): void {
  try {
    if (stored) localStorage.setItem(AUTH_KEY, JSON.stringify(stored));
    else localStorage.removeItem(AUTH_KEY);
  } catch {
    // Private browsing can refuse storage; the session then lasts this visit.
  }
}

function recall(): Stored | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as Stored) : null;
  } catch {
    return null;
  }
}

export interface Auth {
  /** Null until the first check with the server comes back. */
  ready: boolean;
  /** False on a server running without a database, where online play is open. */
  accountsEnabled: boolean;
  user: AuthUser | null;
  token: string | null;
  /** A table this account is still seated at, if any. */
  activeRoom: string | null;
  busy: boolean;
  error: string | null;
  signUp: (username: string, password: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  clearError: () => void;
  /** Re-check with the server, so a stale rejoin offer does not linger. */
  refresh: () => void;
}

async function post(path: string, body: unknown): Promise<AuthResponse> {
  const response = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<AuthResponse> & {
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error ?? 'Could not reach the surface');
  return payload as AuthResponse;
}

/**
 * Holds who is signed in. The session token is a bearer credential, so it is
 * sent on the Authorization header and never put in a URL.
 */
export function useAuth(): Auth {
  const [stored, setStored] = useState<Stored | null>(() => recall());
  const [accountsEnabled, setAccountsEnabled] = useState(true);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Ask the server who we are. One call settles both questions — whether this
   * server has accounts at all, and whether the session we kept is still good
   * for one — and brings back the table we are still seated at.
   */
  const probe = useCallback(async (token: string | null) => {
    try {
      const response = await fetch(apiUrl('/api/auth/me'), {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });

      if (response.status === 503) {
        setAccountsEnabled(false);
        return;
      }
      setAccountsEnabled(true);

      if (response.ok) {
        const payload = (await response.json()) as {
          user: AuthUser | null;
          activeRoom: string | null;
        };
        if (payload.user) {
          const user = payload.user;
          setStored((held) => (held ? { ...held, user } : held));
          setActiveRoom(payload.activeRoom);
          return;
        }
      }

      // Nobody home: either we never had a session, or the one we kept has
      // expired. Either way there is nothing worth holding on to.
      setStored(null);
      remember(null);
      setActiveRoom(null);
    } catch {
      // Offline, or the server is asleep. The sign-in form will say so when it
      // is used; nothing here should wipe a session over a blip.
    }
  }, []);

  useEffect(() => {
    void probe(recall()?.token ?? null).finally(() => setReady(true));
  }, [probe]);

  const enter = useCallback(
    async (path: string, username: string, password: string) => {
      setBusy(true);
      setError(null);
      try {
        const result = await post(path, { username, password });
        const next = { user: result.user, token: result.token };
        setStored(next);
        remember(next);
        setActiveRoom(result.activeRoom);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not sign in');
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const signUp = useCallback(
    (username: string, password: string) => enter('/api/auth/signup', username, password),
    [enter],
  );

  const signIn = useCallback(
    (username: string, password: string) => enter('/api/auth/login', username, password),
    [enter],
  );

  const signOut = useCallback(() => {
    const token = stored?.token;
    setStored(null);
    setActiveRoom(null);
    remember(null);
    if (token) {
      void fetch(apiUrl('/api/auth/logout'), {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      }).catch(() => {
        // The session is already gone from this browser either way.
      });
    }
  }, [stored]);

  return {
    ready,
    accountsEnabled,
    user: stored?.user ?? null,
    token: stored?.token ?? null,
    activeRoom,
    busy,
    error,
    signUp,
    signIn,
    signOut,
    clearError: useCallback(() => setError(null), []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refresh: useCallback(() => void probe(stored?.token ?? null), [probe, stored]),
  };
}
