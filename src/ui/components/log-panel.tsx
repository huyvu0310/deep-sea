import { useEffect, useRef } from 'react';
import type { LogEntry } from '../../engine';
import { diverColor } from '../theme';
import { logTone } from './log-tone';

/**
 * Running commentary, newest last and auto-scrolled into view. Each line is
 * tagged with the diver who caused it, so a glance tells you who acted rather
 * than requiring you to read the sentence.
 *
 * Timestamps are stamped here rather than in the engine: engine state has to
 * stay deterministic so a game can be replayed from its seed, and a clock time
 * is a property of watching the game, not of the game itself.
 */
export function LogPanel({
  entries,
  colorOf,
}: {
  entries: LogEntry[];
  colorOf: (actorId: string) => string | null;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const stamps = useRef<string[]>([]);

  if (stamps.current.length < entries.length) {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    while (stamps.current.length < entries.length) stamps.current.push(now);
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  const visible = entries.slice(-40);
  const offset = entries.length - visible.length;

  return (
    <section className="game-log">
      <h2 className="deck-title">GAME REGISTER &amp; LOG</h2>
      <div className="log-list" aria-live="polite">
        {visible.map((entry, i) => {
          const color = entry.actorId ? colorOf(entry.actorId) : null;
          return (
            <p key={offset + i} className={`log-entry log-${logTone(entry.text)}`}>
              <time>{stamps.current[offset + i]}</time>
              {color && <i className="log-actor" style={{ background: color }} />}
              <span>{entry.text}</span>
            </p>
          );
        })}
        <div ref={endRef} />
      </div>
    </section>
  );
}

/** Maps a diver id to their seat colour, for anything that renders log entries. */
export function makeColorOf(players: { id: string }[]): (actorId: string) => string | null {
  return (actorId) => {
    const index = players.findIndex((player) => player.id === actorId);
    return index === -1 ? null : diverColor(index);
  };
}
