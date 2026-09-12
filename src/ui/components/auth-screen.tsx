import { useState, type FormEvent } from 'react';
import type { Auth } from '../use-auth';

/**
 * Sign in or open an account. Username and password only — there is no email
 * on file, so there is nothing to send a reset to and nothing to verify.
 */
export function AuthScreen({ auth, onBack }: { auth: Auth; onBack: () => void }) {
  const [joining, setJoining] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const ready = username.trim().length >= 3 && password.length >= 8 && !auth.busy;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    void (joining ? auth.signUp(username.trim(), password) : auth.signIn(username.trim(), password));
  };

  const swap = () => {
    setJoining((was) => !was);
    auth.clearError();
  };

  return (
    <div className="setup">
      <form className="setup-card" onSubmit={submit}>
        <h1>{joining ? 'New diver' : 'Sign in'}</h1>
        <p className="setup-blurb">
          {joining
            ? 'Pick a name the other divers will see, and a password to keep the seat yours.'
            : 'Sign back in to return to a dive you left.'}
        </p>

        <label className="setup-seed">
          <span>Username</span>
          <input
            id="diver-username"
            name="username"
            value={username}
            maxLength={16}
            autoComplete="username"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="ama"
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className="setup-seed">
          <span>Password</span>
          <input
            id="diver-password"
            name="password"
            type="password"
            value={password}
            autoComplete={joining ? 'new-password' : 'current-password'}
            placeholder="at least 8 characters"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {auth.error && <p className="auth-error">{auth.error}</p>}

        <button type="submit" className="btn btn-primary btn-lg" disabled={!ready}>
          {auth.busy ? 'Just a moment…' : joining ? 'Create account' : 'Sign in'}
        </button>

        <div className="or">{joining ? 'already have an account?' : 'new here?'}</div>

        <button type="button" className="btn" onClick={swap}>
          {joining ? 'Sign in instead' : 'Create an account'}
        </button>

        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          Back
        </button>
      </form>
    </div>
  );
}
