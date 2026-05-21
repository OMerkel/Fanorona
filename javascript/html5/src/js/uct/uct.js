// Copyright (c) 2016,2026 Oliver Merkel. All rights reserved.
// @author Oliver Merkel, <Merkel(dot)Oliver(at)web(dot)de>
// SPDX-License-Identifier: MIT
//
// UCT (Upper Confidence Bound applied to Trees) – MCTS engine.
//

import { UctNode } from './uctnode.js';

export class Uct {
  /**
   * Run MCTS and return the best action together with diagnostic info.
   *
   * @param {Board}  board                - current board (Board adapter instance)
   * @param {number} maxIterations        - hard cap on simulation iterations
   * @param {number} maxTime             - wall-clock budget in milliseconds
   * @param {number} maxDepthSimulation  - max random-playout depth per iteration
   * @param {number} maxLookAhead        - max total depth (selection + simulation)
   * @returns {{ action: number|null, info: string }}
   */
  getActionInfo(board, maxIterations, maxTime, maxDepthSimulation, maxLookAhead) {
    const root = new UctNode(null, board, null);

    if (root.unexamined.length === 0) {
      return { action: null, info: 'No action available.' };
    }
    if (root.unexamined.length === 1) {
      return { action: root.unexamined[0], info: 'Just 1 action available.' };
    }

    const startTime = Date.now();
    const timeLimit  = startTime + maxTime;
    const blockSize  = 50;
    let nodesVisited = 0;
    let blocksSkipped = 0;

    for (
      let iterations = 0;
      iterations < maxIterations && Date.now() < timeLimit;
      iterations += blockSize
    ) {
      // Defensive check: on fast hardware, Date.now() may not advance between loop iterations.
      // This early exit prevents wasting remaining iterations if time budget is exhausted.
      if (Date.now() >= timeLimit) {
        blocksSkipped++;
        break;
      }
      const remainingIterations = maxIterations - iterations;
      const batchIterations = Math.min(blockSize, remainingIterations);
      for (let i = 0; i < batchIterations; i++) {
        let node              = root;
        const variantBoard    = board.copy();
        let lookAhead         = maxLookAhead;

        /* Selection */
        while (
          node.unexamined.length === 0 &&
          node.children.length > 0 &&
          lookAhead > 0
        ) {
          node = node.selectChild();
          variantBoard.doAction(node.action);
          lookAhead--;
        }

        /* Expansion */
        if (node.unexamined.length > 0) {
          const j = Math.floor(Math.random() * node.unexamined.length);
          variantBoard.doAction(node.unexamined[j]);
          node = node.addChild(variantBoard, j);
        }

        /* Simulation (random playout) */
        let actions = variantBoard.getActions();
        let depth   = maxDepthSimulation;
        while (actions.length > 0 && depth > 0 && lookAhead > 0) {
          variantBoard.doAction(actions[Math.floor(Math.random() * actions.length)]);
          nodesVisited++;
          actions = variantBoard.getActions();
          depth--;
          lookAhead--;
        }

        /* Backpropagation */
        const result = variantBoard.getResult();
        let backNode = node;
        while (backNode) {
          backNode.update(result);
          backNode = backNode.parentNode;
        }
      }
    }

    const duration = Math.max(Date.now() - startTime, 1);
    const mostVisited = root.mostVisitedChild();
    if (!mostVisited) {
      return {
        action: root.unexamined[0],
        info: 'Search budget exhausted before expansion; fallback action selected.',
      };
    }

    const info = blocksSkipped > 0
      ? `${Math.floor(nodesVisited * 1000 / duration)} nodes/sec (${blocksSkipped} blocks timed out).`
      : `${Math.floor(nodesVisited * 1000 / duration)} nodes/sec examined.`;

    return {
      action: mostVisited.action,
      info,
    };
  }
}
