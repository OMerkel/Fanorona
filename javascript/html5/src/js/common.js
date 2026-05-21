// Copyright (c) 2016,2026 Oliver Merkel. All rights reserved.
// @author Oliver Merkel, <Merkel(dot)Oliver(at)web(dot)de>
// SPDX-License-Identifier: MIT

export const COLUMNS = 9;
export const ROWS = 5;
export const EMPTY = 0;
export const SOUTH = 1;
export const NORTH = 2;
export const SOUTH_KING = 3;
export const NORTH_KING = 4;
export const PLAYERS = Object.freeze({ HUMAN: 'Human', AI: 'AI' });
export const VARIANTS = Object.freeze({ FANORONA: 'Fanorona', VELA: 'Vela' });

export const actionToKey = (action) =>
  `${action.from.row}:${action.from.column}:${action.to.row}:${action.to.column}:${action.type}:${action.captureMode ?? 'none'}`;
