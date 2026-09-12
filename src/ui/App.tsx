import { useCallback, useMemo, useState } from 'react';
import type { NewGameOptions } from '../engine';
import { toView } from '../net/view';
import { Table } from './components/table';
import { JoinScreen, Lobby } from './components/lobby';
import { SetupScreen, type SetupResult } from './components/setup-screen';
import { useGame } from './use-game';
import { recallSeat, useOnlineGame, type JoinIntent } from './use-online-game';

type Screen =
  | { kind: 'menu' }
  | { kind: 'hotseat'; setup: SetupResult }
  | { kind: 'online'; intent: JoinIntent };

export function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const toMenu = useCallback(() => setScreen({ kind: 'menu' }), []);

  switch (screen.kind) {
    case 'menu':
      return <Menu onScreen={setScreen} />;
    case 'hotseat':
      return <HotSeatTable setup={screen.setup} onLeave={toMenu} />;
    case 'online':
      return (
        <OnlineTable
          // A fresh connection per intent, so rejoining never reuses a dead socket.
          key={JSON.stringify(screen.intent)}
          intent={screen.intent}
          onLeave={toMenu}
        />
      );
  }
}

function Menu({ onScreen }: { onScreen: (screen: Screen) => void }) {
  const [online, setOnline] = useState(false);
  const seat = useMemo(() => recallSeat(), []);

  if (!online) {
    return (
      <SetupScreen
        onStart={(setup) => onScreen({ kind: 'hotseat', setup })}
        onPlayOnline={() => setOnline(true)}
      />
    );
  }

  return (
    <JoinScreen
      onCreate={(name) => onScreen({ kind: 'online', intent: { kind: 'create', name } })}
      onJoin={(code, name) => onScreen({ kind: 'online', intent: { kind: 'join', code, name } })}
      onBack={() => setOnline(false)}
      resumable={seat ? { code: seat.code } : null}
      onResume={() =>
        seat && onScreen({ kind: 'online', intent: { kind: 'resume', ...seat } })
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
function OnlineTable({ intent, onLeave }: { intent: JoinIntent; onLeave: () => void }) {
  const { status, code, seatId, lobby, view, error, dispatch, start } = useOnlineGame(intent);

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
