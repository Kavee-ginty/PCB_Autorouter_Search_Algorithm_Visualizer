/**
 * engine.js - Unified Search Algorithm Engine
 */

import { searchBFS, searchDFS, searchDLS, searchIDS, searchUCS } from './uninformed.js';
import { searchGreedy, searchAStar, searchBidirectional } from './informed.js';

export const ALGORITHMS = {
    bfs: {
        id: 'bfs',
        name: 'Breadth-First Search (BFS)',
        category: 'uninformed',
        description: 'Explores level by level. Guarantees shortest path in unweighted grid.'
    },
    dfs: {
        id: 'dfs',
        name: 'Depth-First Search (DFS)',
        category: 'uninformed',
        description: 'Explores deep paths first. Non-optimal trace lengths, low memory.'
    },
    dls: {
        id: 'dls',
        name: 'Depth-Limited Search (DLS)',
        category: 'uninformed',
        description: 'Depth-bounded DFS with configurable max cutoff limit to prevent infinite loops.'
    },
    ids: {
        id: 'ids',
        name: 'Iterative Deepening Search (IDS)',
        category: 'uninformed',
        description: 'Sequentially increases depth limit. Combines BFS optimality with DFS space efficiency.'
    },
    ucs: {
        id: 'ucs',
        name: 'Uniform Cost Search (UCS)',
        category: 'uninformed',
        description: 'Dijkstra-based pathfinding optimizing total cumulative trace length and turn costs.'
    },
    bidirectional: {
        id: 'bidirectional',
        name: 'Bidirectional Search (BDS)',
        category: 'uninformed',
        description: 'Simultaneously explores from Source pin and Target pin until frontiers meet.'
    },
    greedy: {
        id: 'greedy',
        name: 'Greedy Best-First Search',
        category: 'informed',
        description: 'Fast heuristic-guided search prioritized purely by Euclidean/Manhattan distance to target.'
    },
    astar: {
        id: 'astar',
        name: 'A* Search',
        category: 'informed',
        description: 'Optimal informed search evaluating f(n) = g(n) + h(n), balancing cost and goal distance.'
    }
};

export class SearchEngine {
    constructor(bridge) {
        this.bridge = bridge;
    }

    /**
     * Create an algorithm step generator
     * @param {string} algorithmKey - 'bfs'|'dfs'|'dls'|'ids'|'ucs'|'bidirectional'|'greedy'|'astar'
     * @param {number} startNodeId - Start node ID
     * @param {number} goalNodeId - Target node ID
     * @param {string} netId - Net identifier
     * @param {string} targetPinId - Target pin designator
     * @param {object} options - { depthLimit, heuristicType, maxDepth }
     * @returns {Generator}
     */
    createSearchGenerator(algorithmKey, startNodeId, goalNodeId, netId, targetPinId, options = {}) {
        const { depthLimit = 10, heuristicType = 'euclidean', maxDepth = 30 } = options;

        switch (algorithmKey.toLowerCase()) {
            case 'bfs':
                return searchBFS(this.bridge, startNodeId, goalNodeId, netId, targetPinId);
            case 'dfs':
                return searchDFS(this.bridge, startNodeId, goalNodeId, netId, targetPinId);
            case 'dls':
                return searchDLS(this.bridge, startNodeId, goalNodeId, netId, targetPinId, depthLimit);
            case 'ids':
                return searchIDS(this.bridge, startNodeId, goalNodeId, netId, targetPinId, maxDepth);
            case 'ucs':
                return searchUCS(this.bridge, startNodeId, goalNodeId, netId, targetPinId);
            case 'bidirectional':
                return searchBidirectional(this.bridge, startNodeId, goalNodeId, netId, targetPinId);
            case 'greedy':
                return searchGreedy(this.bridge, startNodeId, goalNodeId, netId, targetPinId, heuristicType);
            case 'astar':
                return searchAStar(this.bridge, startNodeId, goalNodeId, netId, targetPinId, heuristicType);
            default:
                throw new Error(`Unsupported algorithm: ${algorithmKey}`);
        }
    }

    /**
     * Synchronously execute search algorithm to completion
     */
    runSearchSync(algorithmKey, startNodeId, goalNodeId, netId, targetPinId, options = {}) {
        const gen = this.createSearchGenerator(algorithmKey, startNodeId, goalNodeId, netId, targetPinId, options);
        let finalResult = null;
        while (true) {
            const step = gen.next();
            if (step.done) {
                finalResult = step.value;
                break;
            }
            if (step.value.type === 'finish') {
                finalResult = step.value;
            }
        }
        return finalResult;
    }
}
