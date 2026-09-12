import { useEffect, useRef, useState } from 'react';
import type { LogEntry } from '../../engine';

/** How long a notice stays on screen, and how many stack up at once. */
const NOTICE_MS = 5200;
const MAX_VISIBLE = 4;

interface Notice {
  id: number;
  text: string;
  color: string | null;
  /**
   * Each notice carries its own deadline. Cancelling timers from the effect
   * cleanup would cancel the *previous* batch's expiry every time a new action
   * arrived, leaving older notices stuck on screen forever.
   */
  expiresAt: number;
}

/** How often expired notices are swept away. */
const SWEEP_MS = 250;

/**
 * Transient notices for what the rest of the table just did.
 *
 * At an online table you cannot see anyone else's hands, so a move by another
 * diver would otherwise only appear as a new line in a side panel that is easy
 * to miss. Your own moves are left out — you just made them.
 */
export function ActionFeed({
  entries,
  youId,
  colorOf,
}: {
  entries: LogEntry[];
  /** The seat this browser controls. Null at a hot-seat table, where the feed is pointless. */
  youId: string | null;
  colorOf: (actorId: string) => string | null;
}) {
  const [notices, setNotices] = useState<Notice[]>([]);
  // Start from the current end of the log: joining or reconnecting mid-game
  // must not replay the whole history as a burst of notices.
  const seen = useRef(entries.length);
  const nextId = useRef(0);

  useEffect(() => {
    if (youId === null) return;
    if (entries.length <= seen.current) {
      // The log can shrink only if a different game replaced this one.
      seen.current = Math.min(seen.current, entries.length);
      return;
    }

    const fresh = entries
      .slice(seen.current)
      .filter((entry) => entry.actorId !== null && entry.actorId !== youId)
      .map((entry) => ({
        id: nextId.current++,
        text: entry.text,
        color: entry.actorId ? colorOf(entry.actorId) : null,
        expiresAt: Date.now() + NOTICE_MS,
      }));

    seen.current = entries.length;
    if (fresh.length === 0) return;

    setNotices((current) => [...current, ...fresh].slice(-MAX_VISIBLE));
  }, [entries, youId, colorOf]);

  // One sweep for all notices, so each lives exactly its own lifetime no matter
  // how many actions land while it is showing.
  useEffect(() => {
    if (notices.length === 0) return;
    const sweep = setInterval(() => {
      const now = Date.now();
      setNotices((current) => current.filter((notice) => notice.expiresAt > now));
    }, SWEEP_MS);
    return () => clearInterval(sweep);
  }, [notices.length]);

  if (youId === null || notices.length === 0) return null;

  return (
    <div className="action-feed" aria-live="polite">
      {notices.map((notice) => (
        <p key={notice.id} className="notice">
          {notice.color && <i className="notice-dot" style={{ background: notice.color }} />}
          {notice.text}
        </p>
      ))}
    </div>
  );
}
