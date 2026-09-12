import { useCallback, useMemo, useState } from 'react';
import type { NewGameOptions } from '../engine';
import { toView } from '../net/view';
import { Table } from './components/table';
import { AuthScreen } from './components/auth-screen';
import { JoinScreen, Lobby } from './components/lobby';
import { SetupScreen, type SetupResult } from './components/setup-screen';
import { useAuth, type Auth } from './use-auth';
import { useGame } from './use-game';
import { forgetSeat, recallSeat, useOnlineGame, type JoinIntent } from './use-online-game';

type Screen =
  | { kind: 'menu' }
  | { kind: 'hotseat'; setup: SetupResult }
  | { kind: 'online'; intent: JoinIntent };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  // Held above the screens, so signing in survives walking in and out of a table.
  const auth = useAuth();
  const { refresh } = auth;

  const toMenu = useCallback(() => {
    setScreen({ kind: 'menu' });
    // Leaving may have given up the seat, so ask again rather than go on
    // offering a table that is no longer ours.
    refresh();
  }, [refresh]);

  switch (screen.kind) {
    case 'menu':
      return <Menu auth={auth} onScreen={setScreen} />;
    case 'hotseat':
      return <HotSeatTable setup={screen.setup} onLeave={toMenu} />;
    case 'online':
      return (
        <OnlineTable
          // A fresh connection per intent, so rejoining never reuses a dead socket.
          key={JSON.stringify(screen.intent)}
          intent={screen.intent}
          session={auth.token}
          onLeave={toMenu}
        />
      );
  }
}

function Menu({ auth, onScreen }: { auth: Auth; onScreen: (screen: Screen) => void }) {
  const [online, setOnline] = useState(false);
  const seat = useMemo(() => recallSeat(), []);
  const toSetup = useCallback(() => setOnline(false), []);

  if (!online) {
    return (
      <SetupScreen
        onStart={(setup) => onScreen({ kind: 'hotseat', setup })}
        onPlayOnline={() => setOnline(true)}
      />
    );
  }

  // Which of these screens is right depends on the server's answer, so wait
  // for it rather than flash a sign-in form at a server that has no accounts.
  if (!auth.ready) {
    return (
      <div className="setup">
        <div className="setup-card">
          <h1>Surfacing…</h1>
          <p className="setup-blurb">Contacting the expedition office.</p>
          <button className="btn btn-ghost btn-sm" onClick={toSetup}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (auth.accountsEnabled && !auth.user) {
    return <AuthScreen auth={auth} onBack={toSetup} />;
  }

  // Signed in, the server knows which table is still ours. Without accounts the
  // only record is the seat this browser kept.
  const resumable = auth.activeRoom
    ? { code: auth.activeRoom }
    : seat
      ? { code: seat.code }
      : null;

  return (
    <JoinScreen
      account={auth.user}
      onCreate={(name) => onScreen({ kind: 'online', intent: { kind: 'create', name } })}
      onJoin={(code, name) => onScreen({ kind: 'online', intent: { kind: 'join', code, name } })}
      onBack={toSetup}
      resumable={resumable}
      onResume={() =>
        resumable &&
        onScreen({
          kind: 'online',
          intent: {
            kind: 'resume',
            code: resumable.code,
            // The token only helps for the seat this browser took itself.
            ...(seat?.code === resumable.code ? { token: seat.token } : {}),
          },
        })
      }
      onSignOut={
        auth.accountsEnabled
          ? () => {
              // The seat belongs to the account that just left, not to whoever
              // signs in next on this browser.
              forgetSeat();
              auth.signOut();
            }
          : null
      }
    />
  );
}

function toOptions(setup: SetupResult): NewGameOptions {
  return {
    players: setup.names.map((name, i) => ({ id: `p${i + 1}`, name })),
    ...(setup.seed.trim() ? { seed: setup.seed.trim() } : {}),
  };
}

/** Everyone shares one screen; the engine runs right here in the browser. */
function HotSeatTable({ setup, onLeave }: { setup: SetupResult; onLeave: () => void }) {
  const { state, error, dispatch, restart } = useGame(toOptions(setup));
  const view = useMemo(() => toView(state), [state]);

  return (
    <Table
      view={view}
      dispatch={dispatch}
      error={error}
      youId={null}
      onRestart={() => restart(toOptions({ ...setup, seed: '' }))}
      onLeave={onLeave}
      leaveLabel="LEAVE EXPEDITION"
      tableCode="LOCAL TABLE"
      mode="HOT-SEAT"
    />
  );
}

/** One browser, one seat; the server runs the game and sends back a redacted view. */
function OnlineTable({
  intent,
  session,
  onLeave,
}: {
  intent: JoinIntent;
  session: string | null;
  onLeave: () => void;
}) {
  const { status, code, seatId, lobby, view, error, dispatch, start } = useOnlineGame(
    intent,
    session,
  );

  if (view) {
    return (
      <Table
        view={view}
        dispatch={dispatch}
        error={error}
        youId={seatId}
        onRestart={null}
        onLeave={onLeave}
        leaveLabel="LEAVE TABLE"
        tableCode={code ?? '----'}
        mode="ONLINE TABLE"
        banner={status === 'closed' ? 'Disconnected — rejoin from the menu.' : null}
      />
    );
  }

  if (lobby && code) {
    return (
      <Lobby
        code={code}
        players={lobby.players}
        hostId={lobby.hostId}
        canStart={lobby.canStart}
        youId={seatId}
        onStart={start}
        onLeave={onLeave}
      />
    );
  }

  return (
    <div className="setup">
      <div className="setup-card">
        <h1>{status === 'closed' ? 'Connection lost' : 'Surfacing…'}</h1>
        <p className="setup-blurb">
          {error ?? (status === 'closed' ? 'The table could not be reached.' : 'Contacting the table.')}
        </p>
        <button className="btn btn-lg" onClick={onLeave}>
          Back to the menu
        </button>
      </div>
    </div>
  );
}
