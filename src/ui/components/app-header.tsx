import { useState } from 'react';
import { isMuted, play, setMuted } from '../sound';
import { SubIcon, UsersIcon } from './icons';

/** Top bar: identity, which table this is, and how many divers are aboard. */
function SoundToggle() {
  const [muted, setLocalMuted] = useState(isMuted);

  return (
    <button
      className={`sound-toggle${muted ? ' sound-toggle-off' : ''}`}
      onClick={() => {
        const next = !muted;
        setMuted(next);
        setLocalMuted(next);
        // Confirm the choice audibly, which also unlocks audio on first use.
        if (!next) play('scoop');
      }}
      title={muted ? 'Turn sound on' : 'Turn sound off'}
      aria-pressed={!muted}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

export function AppHeader({
  subtitle,
  code,
  divers,
}: {
  subtitle: string;
  code: string;
  divers: number;
}) {
  return (
    <header className="app-header">
      <div className="logo-group">
        <span className="logo-mark">
          <SubIcon size={20} />
        </span>
        <span className="logo-title">
          <strong>DEEP SEA ADVENTURE</strong>
          <small>{subtitle}</small>
        </span>
      </div>

      <div className="lobby-stats">
        <SoundToggle />
        <div className="stat-item">
          <span className="stat-label">TABLE:</span>
          <span className="code-badge">{code}</span>
        </div>
        <div className="stat-item stat-muted">
          <UsersIcon size={16} />
          <span>{divers} diving</span>
        </div>
      </div>
    </header>
  );
}
