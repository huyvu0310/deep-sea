import { useCallback, useMemo, useState } from 'react';
import type { GameAction, GameState, NewGameOptions } from '../engine';
import { IllegalActionError, applyAction, createGame } from '../engine';

export interface GameController {
  state: GameState;
  error: string | null;
  dispatch: (action: GameAction) => void;
  restart: (options: NewGameOptions) => void;
}

/**
 * Holds the game in React state and funnels every move through the engine, so
 * the UI can never produce a position the rules would not allow. Illegal moves
 * surface as a message instead of throwing into the render tree.
 */
export function useGame(initial: NewGameOptions): GameController {
  const [state, setState] = useState<GameState>(() => createGame(initial));
  const [error, setError] = useState<string | null>(null);

  const dispatch = useCallback((action: GameAction) => {
    setError(null);
    setState((current) => {
      try {
        return applyAction(current, action);
      } catch (err) {
        if (err instanceof IllegalActionError) {
          setError(err.message);
          return current;
        }
        throw err;
      }
    });
  }, []);

  const restart = useCallback((options: NewGameOptions) => {
    setError(null);
    setState(createGame(options));
  }, []);

  return useMemo(() => ({ state, error, dispatch, restart }), [state, error, dispatch, restart]);
}
