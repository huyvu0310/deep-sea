import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../engine';
import { diverColor } from '../theme';

const DEFAULT_NAMES = ['Ama', 'Bo', 'Cass', 'Dev', 'Eli', 'Fen'];

export interface SetupResult {
  names: string[];
  seed: string;
}

/** Roster screen: name the divers, optionally pin a seed for a repeatable run. */
export function SetupScreen({
  onStart,
  onPlayOnline,
}: {
  onStart: (result: SetupResult) => void;
  onPlayOnline: () => void;
}) {
  const [names, setNames] = useState<string[]>(DEFAULT_NAMES.slice(0, 3));
  const [seed, setSeed] = useState('');

  const rename = (index: number, value: string) =>
    setNames((current) => current.map((n, i) => (i === index ? value : n)));

  const add = () =>
    setNames((current) =>
      current.length >= MAX_PLAYERS
        ? current
        : [...current, DEFAULT_NAMES[current.length] ?? `Diver ${current.length + 1}`],
    );

  const remove = (index: number) =>
    setNames((current) =>
      current.length <= MIN_PLAYERS ? current : current.filter((_, i) => i !== index),
    );

  const ready = names.every((n) => n.trim().length > 0);

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>Deep Sea Adventure</h1>
        <p className="setup-blurb">
          One submarine, one shared tank of air, and a trail of ruins that gets richer the deeper
          you go. Every treasure you carry burns an extra air each turn and slows your swim. When
          the air runs out, anyone still down there loses the lot.
        </p>

        <h2>Divers</h2>
        <ul className="setup-players">
          {names.map((name, index) => (
            <li key={index}>
              <span className="player-dot" style={{ background: diverColor(index) }} />
              <input
                value={name}
                maxLength={16}
                aria-label={`Diver ${index + 1} name`}
                onChange={(e) => rename(index, e.target.value)}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => remove(index)}
                disabled={names.length <= MIN_PLAYERS}
                aria-label={`Remove ${name}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        <div className="setup-row">
          <button className="btn btn-sm" onClick={add} disabled={names.length >= MAX_PLAYERS}>
            + Add diver
          </button>
          <span className="muted">
            {MIN_PLAYERS}–{MAX_PLAYERS} players, passing one device
          </span>
        </div>

        <label className="setup-seed">
          <span>Seed (optional)</span>
          <input
            value={seed}
            placeholder="leave blank for a random route"
            onChange={(e) => setSeed(e.target.value)}
          />
        </label>

        <button
          className="btn btn-primary btn-lg"
          disabled={!ready}
          onClick={() => onStart({ names: names.map((n) => n.trim()), seed })}
        >
          Dive in
        </button>

        <div className="or">or</div>

        <button className="btn btn-lg" onClick={onPlayOnline}>
          Play online with a room code
        </button>
      </div>
    </div>
  );
}
