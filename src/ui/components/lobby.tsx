import { useState } from 'react';
import type { LobbyPlayer } from '../../net/protocol';
import { MIN_PLAYERS } from '../../engine';
import { diverColor } from '../theme';

/** Waiting room: share the code, watch divers arrive, host casts off. */
export function Lobby({
  code,
  players,
  hostId,
  canStart,
  youId,
  onStart,
  onLeave,
}: {
  code: string;
  players: LobbyPlayer[];
  hostId: string;
  canStart: boolean;
  youId: string | null;
  onStart: (seed: string) => void;
  onLeave: () => void;
}) {
  const [seed, setSeed] = useState('');
  const [copied, setCopied] = useState(false);
  const youAreHost = youId === hostId;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be blocked; the code is on screen regardless.
    }
  };

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>Table {code}</h1>
        <p className="setup-blurb">
          Share this code with the other divers. Everyone plays from their own device.
        </p>
        <button className="btn code-copy" onClick={copy}>
          <span className="code">{code}</span>
          {copied ? 'copied' : 'copy code'}
        </button>

        <h2>Divers ({players.length})</h2>
        <ul className="setup-players">
          {players.map((player, index) => (
            <li key={player.id}>
              <span className="player-dot" style={{ background: diverColor(index) }} />
              <span className="lobby-name">
                {player.name}
                {player.id === youId && <span className="tag tag-you">you</span>}
                {player.id === hostId && <span className="tag tag-up">host</span>}
                {!player.connected && <span className="tag">away</span>}
              </span>
            </li>
          ))}
        </ul>

        {youAreHost ? (
          <>
            <label className="setup-seed">
              <span>Seed (optional)</span>
              <input
                value={seed}
                placeholder="leave blank for a random route"
                onChange={(e) => setSeed(e.target.value)}
              />
            </label>
            <button className="btn btn-primary btn-lg" disabled={!canStart} onClick={() => onStart(seed)}>
              {canStart ? 'Cast off' : `Waiting for ${MIN_PLAYERS} divers`}
            </button>
          </>
        ) : (
          <p className="muted lobby-wait">Waiting for the host to cast off…</p>
        )}

        <button className="btn btn-ghost btn-sm" onClick={onLeave}>
          Leave table
        </button>
      </div>
    </div>
  );
}

/**
 * Entry screen for online play: start a table or join one by code.
 *
 * A name and a code is all it takes. Where the server remembers players, the
 * name is prefilled from last time and claiming it is what quietly keeps the
 * chair findable later; where it does not, this is exactly the screen it has
 * always been.
 */
export function JoinScreen({
  knownAs,
  onCreate,
  onJoin,
  onBack,
  resumable,
  onResume,
}: {
  knownAs: string | null;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onBack: () => void;
  resumable: { code: string } | null;
  onResume: () => void;
}) {
  const [name, setName] = useState(knownAs ?? '');
  const [code, setCode] = useState('');
  const ready = name.trim().length > 0;

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>Play online</h1>

        {resumable && (
          <button className="btn btn-lg resume" onClick={onResume}>
            Rejoin table {resumable.code}
          </button>
        )}

        <label className="setup-seed">
          <span>Your name</span>
          <input
            value={name}
            maxLength={16}
            placeholder="Ama"
            onChange={(e) => setName(e.target.value)}
          />
        </label>

        <button
          className="btn btn-primary btn-lg"
          disabled={!ready}
          onClick={() => onCreate(name.trim())}
        >
          Start a new table
        </button>

        <div className="or">or join with a code</div>

        <div className="join-row">
          <input
            className="join-code"
            value={code}
            maxLength={4}
            placeholder="ABCD"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <button
            className="btn"
            disabled={!ready || code.trim().length !== 4}
            onClick={() => onJoin(code, name.trim())}
          >
            Join
          </button>
        </div>

        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          Back
        </button>
      </div>
    </div>
  );
}
