import { useCallback, useMemo, useState } from 'react';
import type { NewGameOptions } from '../engine';
import { toView } from '../net/view';
import { Table } from './components/table';
import { JoinScreen, Lobby } from './components/lobby';
import { SetupScreen, type SetupResult } from './components/setup-screen';
import { useIdentity, type Identity } from './use-identity';
import { useGame } from './use-game';
import { recallSeat, useOnlineGame, type JoinIntent } from './use-online-game';

type Screen =
  | { kind: 'menu' }
  | { kind: 'hotseat'; setup: SetupResult }
  /**
   * The identity token travels with the intent rather than being read back off
   * the hook: it is claimed in the same breath as opening the table, and React
   * state would not have settled by then.
   */
  | { kind: 'online'; intent: JoinIntent; session: string | null };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  // Held above the screens, so the identity survives walking in and out of a table.
  const identity = useIdentity();
  const { refresh } = identity;

  const toMenu = useCallback(() => {
    setScreen({ kind: 'menu' });
    // Leaving may have given up the seat, so ask again rather than go on
    // offering a table that is no longer ours.
    refresh();
  }, [refresh]);

  switch (screen.kind) {
    case 'menu':
      return <Menu identity={identity} onScreen={setScreen} />;
    case 'hotseat':
      return <HotSeatTable setup={screen.setup} onLeave={toMenu} />;
    case 'online':
      return (
        <OnlineTable
          // A fresh connection per intent, so rejoining never reuses a dead socket.
          key={JSON.stringify(screen.intent)}
          intent={screen.intent}
          session={screen.session}
          onLeave={toMenu}
        />
      );
  }
}

function Menu({
  identity,
  onScreen,
}: {
  identity: Identity;
  onScreen: (screen: Screen) => void;
}) {
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

  // Claim the name, then open the table with the token that came back. On a
  // server that remembers nobody this simply answers null and play carries on
  // under the typed name.
  const enter = (name: string, intent: JoinIntent) => {
    void identity.claim(name).then((session) => onScreen({ kind: 'online', intent, session }));
  };

  // The server knows which table is still ours. With nothing remembered, the
  // only record is the seat this browser kept for itself.
  const resumable = identity.activeRoom
    ? { code: identity.activeRoom }
    : seat
      ? { code: seat.code }
      : null;

  return (
    <JoinScreen
      knownAs={identity.player?.name ?? null}
      onCreate={(name) => enter(name, { kind: 'create', name })}
      onJoin={(code, name) => enter(name, { kind: 'join', code, name })}
      onBack={toSetup}
      resumable={resumable}
      onResume={() =>
        resumable &&
        onScreen({
          kind: 'online',
          session: identity.token,
          intent: {
            kind: 'resume',
            code: resumable.code,
            // The token only helps for the seat this browser took itself.
            ...(seat?.code === resumable.code ? { token: seat.token } : {}),
          },
        })
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
        banner={
          status === 'reconnecting' ? 'Connection lost — getting you back to the table…' : null
        }
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
        banner={
          status === 'reconnecting' ? 'Connection lost — getting you back to the table…' : null
        }
      />
    );
  }

  const reconnecting = status === 'reconnecting';
  return (
    <div className="setup">
      <div className="setup-card">
        <h1>{reconnecting ? 'Connection lost' : 'Surfacing…'}</h1>
        <p className="setup-blurb">
          {error ??
            (reconnecting
              ? 'Trying to reach the table again. Your seat is being held.'
              : 'Contacting the table.')}
        </p>
        <button className="btn btn-lg" onClick={onLeave}>
          Back to the menu
        </button>
      </div>
    </div>
  );
}
