/**
 * verify_algorithms.mjs - Automated Verification for all 8 AI Search Algorithms
 */

import { PcbGrid, GRID_COLS, GRID_ROWS, PITCH_MM } from '../js/core/grid.js';
import { ComponentInstance } from '../js/core/components.js';
import { GridGraphBridge } from '../js/core/bridge.js';
import { SearchEngine } from '../js/algorithms/engine.js';

console.log('=== Running PCB AutoRoute Algorithm Verification Suite ===\n');

const grid = new PcbGrid(GRID_COLS, GRID_ROWS, PITCH_MM);
const bridge = new GridGraphBridge(grid);
const engine = new SearchEngine(bridge);

// Place an obstacle in the center (e.g. (4,3), (4,4), (4,5))
grid.setObstacle(grid.toId(4, 3), { type: 'body' });
grid.setObstacle(grid.toId(4, 4), { type: 'body' });
grid.setObstacle(grid.toId(4, 5), { type: 'body' });

const startNodeId = grid.toId(1, 4); // (1,4)
const goalNodeId = grid.toId(7, 4);  // (7,4)

const algosToTest = ['bfs', 'dfs', 'dls', 'ids', 'ucs', 'bidirectional', 'greedy', 'astar'];
let passedCount = 0;

for (const algo of algosToTest) {
    process.stdout.write(`Testing [${algo.toUpperCase().padEnd(14)}] `);
    const result = engine.runSearchSync(algo, startNodeId, goalNodeId, 'net_test', 'pin_goal', {
        heuristicType: 'euclidean',
        depthLimit: 15,
        maxDepth: 25
    });

    if (result && result.success && result.path.length > 0) {
        const pathCoords = result.path.map(id => {
            const c = grid.toCoord(id);
            return `(${c.x},${c.y})`;
        }).join(' -> ');

        // Verify start and goal
        const first = result.path[0];
        const last = result.path[result.path.length - 1];
        if (first === startNodeId && last === goalNodeId) {
            console.log(`✓ PASS | Steps: ${result.path.length.toString().padStart(2)} | Explored: ${result.nodesExplored.toString().padStart(2)} | Cost: ${result.cost.toFixed(1)}mm`);
            passedCount++;
        } else {
            console.log(`✗ FAIL | Path endpoints mismatch`);
        }
    } else {
        console.log(`✗ FAIL | No path found: ${JSON.stringify(result)}`);
    }
}

console.log(`\nResults: ${passedCount}/${algosToTest.length} algorithms passed.`);
if (passedCount === algosToTest.length) {
    console.log('✓ All 8 AI Search Algorithms Verified Successfully!\n');
} else {
    process.exit(1);
}
