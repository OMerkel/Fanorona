// Copyright (c) 2016,2026 Oliver Merkel. All rights reserved.
// @author Oliver Merkel, <Merkel(dot)Oliver(at)web(dot)de>
// SPDX-License-Identifier: MIT

import {
  actionToKey,
  COLUMNS,
  EMPTY,
  NORTH,
  ROWS,
  SOUTH,
  VARIANTS,
} from './common.js';
import {
  VELA_PHASE2_TRIGGER_CAPTURE_COUNT,
  VELA_PHASE2_TRIGGER_PIECE_COUNT,
  TERMINAL_STATE_SCORE,
} from './config.js';

const DIRS_4 = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const DIRS_8 = [
  ...DIRS_4,
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const inBounds = (row, col) => row >= 0 && row < ROWS && col >= 0 && col < COLUMNS;
const sameCell = (a, b) => a.row === b.row && a.column === b.column;
const posKey = (row, col) => `${row}:${col}`;

const cloneGrid = (grid) => grid.map((line) => [...line]);

const createGrid = () => Array.from({ length: ROWS }, () => Array(COLUMNS).fill(EMPTY));

const neighborsFor = (row, col) => {
  const dirs = ((row + col) % 2 === 0) ? DIRS_8 : DIRS_4;
  return dirs
    .map(([dr, dc]) => ({ row: row + dr, column: col + dc, dr, dc }))
    .filter((next) => inBounds(next.row, next.column));
};

const initialGrid = () => {
  const grid = createGrid();

  // Top two rows are NORTH, bottom two rows are SOUTH.
  for (let col = 0; col < COLUMNS; col++) {
    grid[0][col] = NORTH;
    grid[1][col] = NORTH;
    grid[ROWS - 1][col] = SOUTH;
    grid[ROWS - 2][col] = SOUTH;
  }

  // Center row alternates and center point is empty.
  grid[2] = [NORTH, SOUTH, NORTH, SOUTH, EMPTY, NORTH, SOUTH, NORTH, SOUTH];

  return grid;
};

const pieceOwner = (piece) => {
  if (piece === SOUTH) return 0;
  if (piece === NORTH) return 1;
  return null;
};

const pieceCounts = (grid) => {
  let south = 0;
  let north = 0;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      if (grid[row][col] === SOUTH) south++;
      else if (grid[row][col] === NORTH) north++;
    }
  }
  return [south, north];
};

const contiguousOpponentLine = (grid, row, col, dr, dc, opponent, maxCaptured = Infinity) => {
  const cells = [];
  let r = row;
  let c = col;
  while (inBounds(r, c) && grid[r][c] === opponent && cells.length < maxCaptured) {
    cells.push({ row: r, column: c });
    r += dr;
    c += dc;
  }
  return cells;
};

const actionFromCapture = (from, to, dr, dc, captures, captureMode) => ({
  from: { ...from },
  to: { ...to },
  type: 'capture',
  captureMode,
  captures,
  direction: { dr, dc },
});

const movementAction = (from, to, dr, dc) => ({
  from: { ...from },
  to: { ...to },
  type: 'move',
  direction: { dr, dc },
});

const uniqueActions = (actions) => {
  const map = new Map();
  actions.forEach((action) => {
    map.set(actionToKey(action), action);
  });
  return [...map.values()];
};

const captureActionsForPiece = (grid, row, col, maxCaptured = Infinity, constraints = null) => {
  const owner = pieceOwner(grid[row][col]);
  if (owner === null) return [];

  const opponent = 1 - owner === 0 ? SOUTH : NORTH;
  const visited = constraints?.visited ?? null;
  const previousDir = constraints?.previousDir ?? null;
  const actions = [];

  for (const n of neighborsFor(row, col)) {
    const { dr, dc } = n;

    if (previousDir && previousDir.dr === dr && previousDir.dc === dc) {
      continue;
    }

    const to = { row: row + dr, column: col + dc };
    if (!inBounds(to.row, to.column) || grid[to.row][to.column] !== EMPTY) continue;
    if (visited && visited.has(posKey(to.row, to.column))) continue;

    const approachCells = contiguousOpponentLine(
      grid,
      to.row + dr,
      to.column + dc,
      dr,
      dc,
      opponent,
      maxCaptured
    );
    if (approachCells.length > 0) {
      actions.push(actionFromCapture({ row, column: col }, to, dr, dc, approachCells, 'approach'));
    }

    const withdrawalCells = contiguousOpponentLine(
      grid,
      row - dr,
      col - dc,
      -dr,
      -dc,
      opponent,
      maxCaptured
    );
    if (withdrawalCells.length > 0) {
      actions.push(actionFromCapture({ row, column: col }, to, dr, dc, withdrawalCells, 'withdrawal'));
    }
  }

  return uniqueActions(actions);
};

const paikaActionsForPiece = (grid, row, col) => {
  const actions = [];
  for (const n of neighborsFor(row, col)) {
    if (grid[n.row][n.column] !== EMPTY) continue;
    actions.push(movementAction({ row, column: col }, { row: n.row, column: n.column }, n.dr, n.dc));
  }
  return actions;
};

const legalActionsForPlayer = (state, player, overrides = {}) => {
  const { grid } = state;
  const variant = state.variant;
  const phase = state.vela?.phase ?? 2;
  const capturer = state.vela?.phaseOneCapturer ?? 0;

  const restrictCaptureOnly = overrides.captureOnly === true;
  const restrictMoveOnly = overrides.moveOnly === true;
  const specificPiece = overrides.specificPiece ?? null;
  const captureConstraints = overrides.captureConstraints ?? null;

  const captureMax = variant === VARIANTS.VELA && phase === 1 ? 1 : Infinity;

  const captureActions = [];
  const paikaActions = [];

  const scan = () => {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLUMNS; col++) {
        if (pieceOwner(grid[row][col]) !== player) continue;
        if (specificPiece && (specificPiece.row !== row || specificPiece.column !== col)) continue;

        const captures = captureActionsForPiece(
          grid,
          row,
          col,
          captureMax,
          captureConstraints && specificPiece && sameCell(specificPiece, { row, column: col })
            ? captureConstraints
            : null
        );
        if (captures.length > 0) captureActions.push(...captures);

        if (!restrictCaptureOnly) {
          paikaActions.push(...paikaActionsForPiece(grid, row, col));
        }
      }
    }
  };

  scan();

  if (restrictMoveOnly) return uniqueActions(paikaActions);
  if (restrictCaptureOnly) return uniqueActions(captureActions);

  if (variant === VARIANTS.VELA && phase === 1) {
    if (player === capturer) return uniqueActions(captureActions);
    return uniqueActions(paikaActions);
  }

  return captureActions.length > 0 ? uniqueActions(captureActions) : uniqueActions(paikaActions);
};

/**
 * Create a new board state initialized with pieces in their starting positions.
 * @param {Object} [options={}] - Configuration options.
 * @param {string} [options.variant='Fanorona'] - Game variant ('Fanorona' or 'Vela').
 * @param {number} [options.velaPreviousWinner=1] - For Vela: the previous game's winner (0 or 1).
 * @returns {BoardState} A new board state ready for play.
 */
export const createBoard = (options = {}) => {
  const variant = options.variant ?? VARIANTS.FANORONA;
  const previousWinner = options.velaPreviousWinner ?? 1;
  const phaseOneCapturer = 1 - previousWinner;

  return {
    active: variant === VARIANTS.VELA ? phaseOneCapturer : 0,
    grid: initialGrid(),
    winner: null,
    isDraw: false,
    latestMove: null,
    winningLine: null,
    variant,
    turnContext: null,
    vela: variant === VARIANTS.VELA
      ? {
          phase: 1,
          previousWinner,
          phaseOneCapturer,
          phaseOneCaptured: 0,
        }
      : null,
  };
};

const findAction = (actions, action) => {
  const wanted = actionToKey(action);
  return actions.find((candidate) => actionToKey(candidate) === wanted) ?? null;
};

const applyActionToGrid = (grid, action) => {
  const next = cloneGrid(grid);
  const piece = next[action.from.row][action.from.column];
  next[action.from.row][action.from.column] = EMPTY;
  next[action.to.row][action.to.column] = piece;
  if (action.type === 'capture' && Array.isArray(action.captures)) {
    for (const captured of action.captures) {
      next[captured.row][captured.column] = EMPTY;
    }
  }
  return next;
};

const shouldSwitchVelaToPhaseTwo = (stateAfterMove, mover, capturedByMove) => {
  if (stateAfterMove.variant !== VARIANTS.VELA || stateAfterMove.vela?.phase !== 1) return false;

  const capturer = stateAfterMove.vela.phaseOneCapturer;
  if (mover !== capturer) return false;

  const phaseCaptured = stateAfterMove.vela.phaseOneCaptured + capturedByMove;
  const [southCount, northCount] = pieceCounts(stateAfterMove.grid);
  const nonCapturer = 1 - capturer;
  const nonCapturerCount = nonCapturer === 0 ? southCount : northCount;

  return phaseCaptured >= VELA_PHASE2_TRIGGER_CAPTURE_COUNT || nonCapturerCount <= VELA_PHASE2_TRIGGER_PIECE_COUNT;
};

const terminalByPieceExhaustion = (grid) => {
  const [southCount, northCount] = pieceCounts(grid);
  if (southCount === 0) return 1;
  if (northCount === 0) return 0;
  return null;
};

const finalizeTurn = (state, nextActive) => {
  const legalForNext = legalActionsForPlayer(state, nextActive);
  if (legalForNext.length > 0) return { ...state, active: nextActive };

  // Vela phase 1 special condition: if the designated capturer cannot capture, that side wins.
  if (state.variant === VARIANTS.VELA && state.vela?.phase === 1 && nextActive === state.vela.phaseOneCapturer) {
    return {
      ...state,
      winner: nextActive,
      active: nextActive,
      winningLine: null,
    };
  }

  return {
    ...state,
    winner: 1 - nextActive,
    active: nextActive,
    winningLine: null,
  };
};

export const getActions = (board) => {
  if (board.winner !== null || board.isDraw) return [];

  if (board.turnContext?.capturingPiece) {
    return legalActionsForPlayer(board, board.active, {
      captureOnly: true,
      specificPiece: board.turnContext.capturingPiece,
      captureConstraints: {
        visited: new Set(board.turnContext.visited ?? []),
        previousDir: board.turnContext.previousDir ?? null,
      },
    });
  }

  return legalActionsForPlayer(board, board.active);
};

/**
 * Apply a move (action) to the board state.
 * Returns a new state with the move applied, or the original state if the action is illegal.
 * Handles capture sequences, phase transitions (Vela), and game termination.
 * @param {BoardState} board - Current board state.
 * @param {Action} action - The move to apply.
 * @returns {BoardState} Updated board state after the move, or original if action is illegal.
 */
export const doAction = (board, action) => {
  const legal = findAction(getActions(board), action);
  if (!legal) return board;

  const mover = board.active;
  const nextGrid = applyActionToGrid(board.grid, legal);
  const capturedByMove = legal.type === 'capture' ? legal.captures.length : 0;

  let nextState = {
    ...board,
    grid: nextGrid,
    latestMove: {
      from: { ...legal.from },
      to: { ...legal.to },
      player: mover,
      type: legal.type,
      captureMode: legal.captureMode ?? null,
      capturedCount: capturedByMove,
    },
    winningLine: null,
    isDraw: false,
  };

  const immediateWinner = terminalByPieceExhaustion(nextGrid);
  if (immediateWinner !== null) {
    return { ...nextState, winner: immediateWinner, active: mover, turnContext: null };
  }

  if (nextState.variant === VARIANTS.VELA && nextState.vela?.phase === 1) {
    const phaseOneCaptured = nextState.vela.phaseOneCaptured + capturedByMove;
    nextState = {
      ...nextState,
      vela: {
        ...nextState.vela,
        phaseOneCaptured,
      },
    };

    if (shouldSwitchVelaToPhaseTwo(nextState, mover, 0)) {
      nextState = {
        ...nextState,
        vela: {
          ...nextState.vela,
          phase: 2,
        },
      };
    }
  }

  const sequenceAllowed =
    legal.type === 'capture' &&
    !(nextState.variant === VARIANTS.VELA && nextState.vela?.phase === 1);

  if (sequenceAllowed) {
    const priorVisited = new Set(board.turnContext?.visited ?? [posKey(legal.from.row, legal.from.column)]);
    priorVisited.add(posKey(legal.to.row, legal.to.column));

    const continuation = legalActionsForPlayer(nextState, mover, {
      captureOnly: true,
      specificPiece: legal.to,
      captureConstraints: {
        visited: priorVisited,
        previousDir: legal.direction ?? null,
      },
    });

    if (continuation.length > 0) {
      return {
        ...nextState,
        active: mover,
        turnContext: {
          capturingPiece: { ...legal.to },
          visited: [...priorVisited],
          previousDir: legal.direction ?? null,
        },
      };
    }
  }

  nextState = {
    ...nextState,
    turnContext: null,
  };

  return finalizeTurn(nextState, 1 - mover);
};
/**
 * Get all legal actions available to the active player.
 * If the board is in a terminal state or the active player has no moves, returns empty array.
 * @param {BoardState} board - The current board state.
 * @returns {Action[]} Array of legal actions, or empty array if game is over.
 */export const getResult = (board) => {
  if (board.winner === 0) return [1, 0];
  if (board.winner === 1) return [0, 1];
  if (board.isDraw) return [0.5, 0.5];
  return [TERMINAL_STATE_SCORE, TERMINAL_STATE_SCORE];
};

export class Board {
  constructor(state) {
    this._state = state ?? createBoard();
  }

  get active() { return this._state.active; }

  getActions() { return getActions(this._state); }
  getResult() { return getResult(this._state); }

  doAction(action) { this._state = doAction(this._state, action); }

  copy() {
    return new Board({
      ...this._state,
      grid: cloneGrid(this._state.grid),
      latestMove: this._state.latestMove
        ? {
            ...this._state.latestMove,
            from: { ...this._state.latestMove.from },
            to: { ...this._state.latestMove.to },
          }
        : null,
      winningLine: this._state.winningLine
        ? this._state.winningLine.map((cell) => ({ ...cell }))
        : null,
      turnContext: this._state.turnContext
        ? {
            ...this._state.turnContext,
            capturingPiece: this._state.turnContext.capturingPiece
              ? { ...this._state.turnContext.capturingPiece }
              : null,
            visited: [...(this._state.turnContext.visited ?? [])],
            previousDir: this._state.turnContext.previousDir
              ? { ...this._state.turnContext.previousDir }
              : null,
          }
        : null,
      vela: this._state.vela ? { ...this._state.vela } : null,
    });
  }

  getState() { return this._state; }
  setState(state) { this._state = state; }
}
