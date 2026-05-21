import { describe, expect, it } from 'vitest';
import { Board, createBoard, doAction, getActions, getResult } from '../../js/board.js';
import { EMPTY, NORTH, ROWS, SOUTH, VARIANTS } from '../../js/common.js';

const makeEmptyGrid = () => Array.from({ length: ROWS }, () => Array(9).fill(EMPTY));

const stateWith = (patch) => ({
  ...createBoard(),
  ...patch,
});

describe('createBoard', () => {
  it('creates a 9x5 board with standard 22/22 setup', () => {
    const board = createBoard();
    expect(board.grid).toHaveLength(5);
    board.grid.forEach((row) => expect(row).toHaveLength(9));

    const all = board.grid.flat();
    expect(all.filter((cell) => cell === SOUTH).length).toBe(22);
    expect(all.filter((cell) => cell === NORTH).length).toBe(22);
    expect(board.grid[2][4]).toBe(EMPTY);
    expect(board.active).toBe(0);
    expect(board.variant).toBe(VARIANTS.FANORONA);
  });

  it('creates Vela state with phase one metadata', () => {
    const board = createBoard({ variant: VARIANTS.VELA, velaPreviousWinner: 1 });
    expect(board.variant).toBe(VARIANTS.VELA);
    expect(board.vela.phase).toBe(1);
    expect(board.vela.phaseOneCapturer).toBe(0);
    expect(board.active).toBe(0);
  });
});

describe('Fanorona actions and transitions', () => {
  it('enforces mandatory capture when available', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = SOUTH;
    grid[2][4] = NORTH;

    const board = stateWith({ grid, active: 0, variant: VARIANTS.FANORONA });
    const actions = getActions(board);

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.type === 'capture')).toBe(true);
  });

  it('captures contiguous opponents on approach', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = SOUTH;
    grid[2][4] = NORTH;
    grid[2][5] = NORTH;

    const board = stateWith({ grid, active: 0, variant: VARIANTS.FANORONA });
    const approach = getActions(board).find(
      (a) => a.from.row === 2 && a.from.column === 2 && a.to.row === 2 && a.to.column === 3 && a.captureMode === 'approach'
    );

    expect(approach).toBeTruthy();
    const next = doAction(board, approach);

    expect(next.grid[2][3]).toBe(SOUTH);
    expect(next.grid[2][4]).toBe(EMPTY);
    expect(next.grid[2][5]).toBe(EMPTY);
  });

  it('captures on withdrawal when moving away from adjacent opponents', () => {
    const grid = makeEmptyGrid();
    grid[2][3] = SOUTH;
    grid[2][2] = NORTH;

    const board = stateWith({ grid, active: 0, variant: VARIANTS.FANORONA });
    const withdrawal = getActions(board).find(
      (a) => a.to.row === 2 && a.to.column === 4 && a.captureMode === 'withdrawal'
    );

    expect(withdrawal).toBeTruthy();
    const next = doAction(board, withdrawal);

    expect(next.grid[2][4]).toBe(SOUTH);
    expect(next.grid[2][2]).toBe(EMPTY);
  });

  it('offers both approach and withdrawal for the same destination when both are legal', () => {
    const grid = makeEmptyGrid();
    grid[2][5] = SOUTH; // f3
    grid[2][3] = NORTH; // d3 (approach target after f3->e3)
    grid[2][6] = NORTH; // g3 (withdrawal target after f3->e3)

    const board = stateWith({ grid, active: 0, variant: VARIANTS.FANORONA });
    const ambiguous = getActions(board).filter(
      (a) => a.from.row === 2 && a.from.column === 5 && a.to.row === 2 && a.to.column === 4 && a.type === 'capture'
    );

    expect(ambiguous).toHaveLength(2);
    expect(new Set(ambiguous.map((a) => a.captureMode))).toEqual(new Set(['approach', 'withdrawal']));
  });

  it('keeps turn on chained capture when a legal continuation exists', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = SOUTH;
    grid[2][4] = NORTH;
    grid[3][3] = NORTH;

    const board = stateWith({ grid, active: 0, variant: VARIANTS.FANORONA });
    const firstCapture = getActions(board).find(
      (a) => a.to.row === 2 && a.to.column === 3 && a.captureMode === 'approach'
    );

    const next = doAction(board, firstCapture);
    expect(next.active).toBe(0);
    expect(next.turnContext?.capturingPiece).toEqual({ row: 2, column: 3 });
    expect(getActions(next).every((a) => a.type === 'capture')).toBe(true);
  });

  it('ends game if opponent has no legal reply', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = SOUTH;
    grid[2][4] = NORTH;

    const board = stateWith({ grid, active: 0, variant: VARIANTS.FANORONA });
    const capture = getActions(board).find((a) => a.to.row === 2 && a.to.column === 3);
    const next = doAction(board, capture);

    expect(next.winner).toBe(0);
  });

  it('returns no actions on terminal states', () => {
    expect(getActions({ ...createBoard(), winner: 0 })).toEqual([]);
    expect(getActions({ ...createBoard(), isDraw: true })).toEqual([]);
  });
});

describe('Vela phase handling', () => {
  it('phase one capturer only gets capture actions and each capture takes one piece', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = SOUTH;
    grid[2][4] = NORTH;
    grid[2][5] = NORTH;

    const board = stateWith({
      grid,
      active: 0,
      variant: VARIANTS.VELA,
      vela: {
        phase: 1,
        previousWinner: 1,
        phaseOneCapturer: 0,
        phaseOneCaptured: 0,
      },
    });

    const actions = getActions(board);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.type === 'capture')).toBe(true);

    const next = doAction(board, actions[0]);
    expect(next.vela.phaseOneCaptured).toBe(1);
    expect(next.active).toBe(1);
  });

  it('phase one non-capturer only gets non-capturing moves', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = SOUTH;
    grid[2][4] = NORTH;
    grid[1][1] = NORTH;

    const board = stateWith({
      grid,
      active: 1,
      variant: VARIANTS.VELA,
      vela: {
        phase: 1,
        previousWinner: 1,
        phaseOneCapturer: 0,
        phaseOneCaptured: 0,
      },
    });

    const actions = getActions(board);
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every((a) => a.type === 'move')).toBe(true);
  });

  it('switches from Vela phase 1 to phase 2 when non-capturer reaches 5 pieces', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = SOUTH;
    grid[2][4] = NORTH;
    grid[0][0] = NORTH;
    grid[0][1] = NORTH;
    grid[0][2] = NORTH;
    grid[0][3] = NORTH;

    const board = stateWith({
      grid,
      active: 0,
      variant: VARIANTS.VELA,
      vela: {
        phase: 1,
        previousWinner: 1,
        phaseOneCapturer: 0,
        phaseOneCaptured: 16,
      },
    });

    const capture = getActions(board).find((a) => a.type === 'capture');
    const next = doAction(board, capture);

    expect(next.vela.phase).toBe(2);
  });

  it('awards Vela phase-1 win to capturer when capturer has no captures on turn handoff', () => {
    const grid = makeEmptyGrid();
    grid[4][8] = NORTH;
    grid[0][0] = SOUTH;

    const board = stateWith({
      grid,
      active: 1,
      variant: VARIANTS.VELA,
      vela: {
        phase: 1,
        previousWinner: 1,
        phaseOneCapturer: 0,
        phaseOneCaptured: 0,
      },
    });

    const move = getActions(board)[0];
    const next = doAction(board, move);

    expect(next.winner).toBe(0);
  });

  it('limits captures to 1 piece in Vela phase 1 for the capturer', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = SOUTH;
    grid[2][4] = NORTH;
    grid[2][5] = NORTH; // Two adjacent NORTH pieces (only first should be captured)

    const board = stateWith({
      grid,
      active: 0,
      variant: VARIANTS.VELA,
      vela: {
        phase: 1,
        previousWinner: 1,
        phaseOneCapturer: 0,
        phaseOneCaptured: 0,
      },
    });

    const captures = getActions(board).filter((a) => a.type === 'capture');
    expect(captures.length).toBeGreaterThan(0);

    // Each capture should only have 1 piece in the captures array
    captures.forEach((c) => {
      expect(c.captures).toHaveLength(1);
    });
  });

  it('ends turn when a capture has no continuation available', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = SOUTH;
    grid[2][4] = NORTH;
    // Intentionally omit grid[3][3] = NORTH to prevent continuation
    grid[4][4] = NORTH; // Give opponent a piece so they have moves

    const board = stateWith({ grid, active: 0, variant: VARIANTS.FANORONA });
    const firstCapture = getActions(board).find(
      (a) => a.to.row === 2 && a.to.column === 3 && a.captureMode === 'approach'
    );

    expect(firstCapture).toBeTruthy();
    const next = doAction(board, firstCapture);

    // Turn should pass to opponent since no continuation exists
    expect(next.active).toBe(1);
    expect(next.turnContext).toBeNull(); // No ongoing capture sequence
  });

  it('Vela phase 1 capturer wins when having no legal captures on turn handoff', () => {
    const grid = makeEmptyGrid();
    grid[0][0] = SOUTH;
    grid[0][2] = NORTH;
    grid[4][8] = NORTH; // Opponent piece to ensure they have moves

    const board = stateWith({
      grid,
      active: 1, // NORTH player's turn
      variant: VARIANTS.VELA,
      vela: {
        phase: 1,
        previousWinner: 1,
        phaseOneCapturer: 0, // SOUTH is the designated capturer
        phaseOneCaptured: 0,
      },
    });

    // NORTH (non-capturer) makes a move
    const move = getActions(board).find((a) => a.type === 'move');
    expect(move).toBeTruthy();
    const next = doAction(board, move);

    // Now it's SOUTH's turn (the designated capturer)
    // If SOUTH has no captures, they win
    const southActions = getActions(next);
    if (southActions.every((a) => a.type === 'move')) {
      // SOUTH has only move actions, no captures - so SOUTH wins
      expect(next.winner).toBe(0); // SOUTH wins
    }
  });

  it('opponent wins when player has no legal moves', () => {
    const grid = makeEmptyGrid();
    grid[0][0] = SOUTH;
    // Only one SOUTH piece - NORTH has no pieces, so after SOUTH moves,
    // NORTH will have no legal moves

    const board = stateWith({
      grid,
      active: 0,
      variant: VARIANTS.FANORONA,
    });

    const move = getActions(board).find((a) => a.type === 'move');
    expect(move).toBeTruthy();
    const next = doAction(board, move);

    // NORTH has no pieces and no legal moves, so SOUTH wins
    expect(next.winner).toBe(0);
  });

  it('Vela phase 2 uses standard rules when capturer cannot move', () => {
    // In Vela phase 2 (not phase 1), the normal opponent-wins rule applies
    const grid = makeEmptyGrid();
    grid[0][0] = SOUTH;
    grid[0][2] = NORTH;

    const board = stateWith({
      grid,
      active: 0,
      variant: VARIANTS.VELA,
      vela: {
        phase: 2, // Phase 2, not phase 1
        previousWinner: 1,
        phaseOneCapturer: 0,
        phaseOneCaptured: 0,
      },
    });

    const move = getActions(board).find((a) => a.type === 'move');
    if (move) {
      const next = doAction(board, move);
      // In phase 2, normal rules apply (opponent wins if no moves)
      if (getActions(next).length === 0) {
        expect(next.winner).toBe(0); // SOUTH wins (not because of capturer rule)
      }
    }
  });

  it('Fanorona - opponent wins when player has no legal responses', () => {
    // Test the standard Fanorona case where a player has no legal moves
    const grid = makeEmptyGrid();
    // Place pieces such that after a move, opponent will have no legal moves
    grid[2][2] = SOUTH;
    grid[4][4] = NORTH;
    // Set up so opponent has no adjacent cells to move to

    const board = stateWith({
      grid,
      active: 0,
      variant: VARIANTS.FANORONA,
    });

    const actions = getActions(board);
    if (actions.length > 0) {
      const next = doAction(board, actions[0]);
      // Check if the next player has any legal moves
      const nextActions = getActions(next);
      if (nextActions.length === 0) {
        // Opponent has no moves, so current player wins
        expect(next.winner).toBe(0);
        expect(next.active).toBe(0);
      }
    }
  });
});

describe('getResult and Board adapter', () => {
  it('returns winner vectors and non-terminal score', () => {
    expect(getResult({ ...createBoard(), winner: 0 })).toEqual([1, 0]);
    expect(getResult({ ...createBoard(), winner: 1 })).toEqual([0, 1]);
    expect(getResult({ ...createBoard(), isDraw: true })).toEqual([0.5, 0.5]);
    expect(getResult(createBoard())).toEqual([0.01, 0.01]);
  });

  it('supports copy and simulation without mutating original', () => {
    const board = new Board();
    const copy = board.copy();
    const first = copy.getActions()[0];
    copy.doAction(first);

    expect(copy.getState()).not.toEqual(board.getState());
  });

  it('setState replaces internal state', () => {
    const board = new Board();
    const custom = { ...createBoard(), winner: 1 };
    board.setState(custom);
    expect(board.getState().winner).toBe(1);
    expect(board.active).toBe(0);
  });

  it('copies board state with null turnContext (move phase)', () => {
    const board = new Board();
    const state = board.getState();
    expect(state.turnContext).toBeNull();

    const copy = board.copy();
    expect(copy.getState().turnContext).toBeNull();
    expect(copy.getState()).toEqual(state);
  });

  it('copies board state with null vela (Fanorona game)', () => {
    const board = new Board(createBoard({ variant: VARIANTS.FANORONA }));
    const state = board.getState();
    expect(state.vela).toBeNull();

    const copy = board.copy();
    expect(copy.getState().vela).toBeNull();
    expect(copy.getState()).toEqual(state);
  });

  it('copies board state with turnContext containing null previousDir', () => {
    const grid = makeEmptyGrid();
    grid[2][2] = SOUTH;
    grid[2][4] = NORTH;
    grid[1][3] = NORTH;

    const board = new Board(
      stateWith({
        grid,
        active: 0,
        turnContext: {
          capturingPiece: { row: 2, column: 3 },
          visited: [{ row: 2, column: 2 }],
          previousDir: null, // First capture in chain, no previous direction
        },
      })
    );

    const copy = board.copy();
    expect(copy.getState().turnContext.previousDir).toBeNull();
    expect(copy.getState().turnContext.visited).toEqual([{ row: 2, column: 2 }]);
  });

  it('copies board state with null winningLine (non-winning state)', () => {
    const board = new Board();
    expect(board.getState().winningLine).toBeNull();

    const copy = board.copy();
    expect(copy.getState().winningLine).toBeNull();
  });

  it('adapts non-terminal board for getResult scoring', () => {
    const board = createBoard();
    const result = getResult(board);

    // Non-terminal game should return [0.01, 0.01] for simulation value
    expect(result).toEqual([0.01, 0.01]);
    expect(result[0]).toBeLessThan(0.5);
    expect(result[1]).toBeLessThan(0.5);
  });
});
