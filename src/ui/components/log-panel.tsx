import { useEffect, useRef } from 'react';
import { logTone } from './log-tone';

/**
 * Running commentary, newest last and auto-scrolled into view.
 *
 * Timestamps are stamped here rather than in the engine: engine state has to
 * stay deterministic so a game can be replayed from its seed, and a clock time
 * is a property of watching the game, not of the game itself.
 */
export function LogPanel({ lines }: { lines: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const stamps = useRef<string[]>([]);

  if (stamps.current.length < lines.length) {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    while (stamps.current.length < lines.length) stamps.current.push(now);
  }

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lines.length]);

  const visible = lines.slice(-40);
  const offset = lines.length - visible.length;

  return (
    <section className="game-log">
      <h2 className="deck-title">GAME REGISTER &amp; LOG</h2>
      <div className="log-list" aria-live="polite">
        {visible.map((line, i) => (
          <p key={offset + i} className={`log-entry log-${logTone(line)}`}>
            <time>{stamps.current[offset + i]}</time>
            <span>{line}</span>
          </p>
        ))}
        <div ref={endRef} />
      </div>
    </section>
  );
}
