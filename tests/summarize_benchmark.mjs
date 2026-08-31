/**
 * summarize_benchmark.mjs
 */

import { PcbGrid, GRID_COLS, GRID_ROWS, PITCH_MM } from '../js/core/grid.js';
import { ComponentInstance } from '../js/core/components.js';
import { GridGraphBridge } from '../js/core/bridge.js';
import { SearchEngine } from '../js/algorithms/engine.js';
import { RipUpRouter } from '../js/router/ripup.js';
import { performance } from 'perf_hooks';
import fs from 'fs';

function setupChallengeCircuit() {
    const grid = new PcbGrid(GRID_COLS, GRID_ROWS, PITCH_MM);
    const bridge = new GridGraphBridge(grid);
    const engine = new SearchEngine(bridge);
    const router = new RipUpRouter(grid, bridge, engine);

    const components = [
        new ComponentInstance('bat_1', 'battery', 1, 2, 'horizontal'),
        new ComponentInstance('sw_1', 'switch', 7, 5, 'horizontal'),
        new ComponentInstance('ldr_1', 'sensor', 7, 1, 'horizontal'),
        new ComponentInstance('res_1', 'resistor', 1, 5, 'horizontal'),
        new ComponentInstance('led_1', 'led', 4, 3, 'horizontal')
    ];

    for (const comp of components) {
        const cells = comp.getOccupiedCells(grid);
        for (const cell of cells) {
            if (cell.isPin && cell.pin) {
                grid.setPin(cell.id, {
                    type: 'pin',
                    componentId: comp.id,
                    pinId: cell.pin.id,
                    pinType: cell.pin.type
                });
            } else {
                grid.setObstacle(cell.id, {
                    type: 'body',
                    componentId: comp.id
                });
            }
        }
    }

    const pinLookup = new Map();
    for (const comp of components) {
        for (const pin of comp.getPins()) {
            pinLookup.set(pin.id, {
                ...pin,
                nodeId: grid.toId(pin.x, pin.y)
            });
        }
    }

    const netlist = [
        { id: 'net_1', name: 'Net 1 (VCC Cross)', source: 'B+', target: 'S1-A', color: '#ef4444' },
        { id: 'net_2', name: 'Net 2 (Sensor Cross)', source: 'S1-B', target: 'L-in', color: '#f59e0b' },
        { id: 'net_3', name: 'Net 3 (Sensor Out)', source: 'L-out', target: 'R-in', color: '#10b981' },
        { id: 'net_4', name: 'Net 4 (LED Anode)', source: 'R-out', target: 'D-A', color: '#3b82f6' },
        { id: 'net_5', name: 'Net 5 (GND Return)', source: 'D-K', target: 'B-', color: '#8b5cf6' }
    ];

    return { grid, bridge, engine, router, components, pinLookup, netlist };
}

const configs = [
    { algo: 'bfs', name: 'Breadth-First Search (BFS)', options: {} },
    { algo: 'dfs', name: 'Depth-First Search (DFS)', options: {} },
    { algo: 'dls', name: 'Depth-Limited Search (DLS, limit=10)', options: { depthLimit: 10 } },
    { algo: 'dls', name: 'Depth-Limited Search (DLS, limit=15)', options: { depthLimit: 15 } },
    { algo: 'dls', name: 'Depth-Limited Search (DLS, limit=20)', options: { depthLimit: 20 } },
    { algo: 'ids', name: 'Iterative Deepening Search (IDS, maxDepth=25)', options: { maxDepth: 25 } },
    { algo: 'ucs', name: 'Uniform Cost Search (UCS)', options: {} },
    { algo: 'bidirectional', name: 'Bidirectional Search (BDS)', options: {} },
    { algo: 'greedy', name: 'Greedy Best-First (Euclidean)', options: { heuristicType: 'euclidean' } },
    { algo: 'greedy', name: 'Greedy Best-First (Manhattan)', options: { heuristicType: 'manhattan' } },
    { algo: 'astar', name: 'A* Search (Euclidean)', options: { heuristicType: 'euclidean' } },
    { algo: 'astar', name: 'A* Search (Manhattan)', options: { heuristicType: 'manhattan' } }
];

const results = [];

for (const cfg of configs) {
    const { grid, bridge, engine, router, pinLookup, netlist } = setupChallengeCircuit();

    const t0 = performance.now();
    const routeGen = router.routeAllNets(netlist, pinLookup, cfg.algo, {
        ...cfg.options,
        maxRipUpIterations: 6
    });

    const stepEvents = [];
    let summary = null;

    while (true) {
        const iter = routeGen.next();
        if (iter.done) {
            summary = iter.value;
            break;
        }
        const step = iter.value;
        if (step.type === 'net_routed') {
            stepEvents.push({
                type: 'net_routed',
                net: step.net.id,
                netName: step.net.name,
                pathLength: step.path.length,
                cost: step.cost
            });
        } else if (step.type === 'conflict_detected') {
            stepEvents.push({
                type: 'conflict_detected',
                net: step.net.id,
                netName: step.net.name,
                attempt: step.attempt,
                reason: step.reason
            });
        } else if (step.type === 'ripup_performed') {
            stepEvents.push({
                type: 'ripup_performed',
                rippedNet: step.rippedNet.id,
                rippedNetName: step.rippedNet.name,
                blockedNet: step.blockedNet.id,
                blockedNetName: step.blockedNet.name,
                ripUpCount: step.ripUpCount
            });
        } else if (step.type === 'net_unroutable') {
            stepEvents.push({
                type: 'net_unroutable',
                net: step.net.id,
                netName: step.net.name,
                reason: step.reason
            });
        }
    }
    const t1 = performance.now();
    const executionTimeMs = t1 - t0;

    const cleanSummary = {
        success: summary.success,
        netsTotal: summary.netsTotal,
        netsRouted: summary.netsRouted,
        netsUnrouted: summary.netsUnrouted,
        totalNodesExplored: summary.totalNodesExplored,
        totalConflicts: summary.totalConflicts,
        totalRipups: summary.totalRipups,
        totalWireLengthMm: summary.totalWireLengthMm,
        unroutedNets: summary.unroutedNets.map(u => ({ id: u.net.id, name: u.net.name, reason: u.reason })),
        routedNets: summary.routedNets.map(r => ({
            id: r.net.id,
            name: r.net.name,
            pathLength: r.path.length,
            cost: r.cost,
            nodesExplored: r.nodesExplored,
            wireLengthMm: (r.path.length - 1) * grid.pitch,
            pathCoords: r.path.map(id => `(${grid.toCoord(id).x},${grid.toCoord(id).y})`).join('->')
        }))
    };

    results.push({
        algo: cfg.algo,
        name: cfg.name,
        options: cfg.options,
        executionTimeMs: executionTimeMs,
        summary: cleanSummary,
        stepEvents
    });
}

fs.writeFileSync('tests/challenge_benchmark_results.json', JSON.stringify(results, null, 2));

console.log('\n============================= RIP-UP & REROUTE CHALLENGE CIRCUIT BENCHMARK =============================\n');
console.log('| Algorithm | Status | Routed | Explored | Conflicts | Rip-Ups | Wire Length | Time (ms) |');
console.log('| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |');
for (const r of results) {
    const s = r.summary;
    const successStr = s.success ? '✅ Pass (100%)' : `❌ Fail (${s.netsRouted}/${s.netsTotal})`;
    console.log(`| ${r.name.padEnd(42)} | ${successStr.padEnd(14)} | ${s.netsRouted}/${s.netsTotal} | ${s.totalNodesExplored.toString().padStart(8)} | ${s.totalConflicts.toString().padStart(9)} | ${s.totalRipups.toString().padStart(7)} | ${(s.totalWireLengthMm + ' mm').padStart(11)} | ${r.executionTimeMs.toFixed(2).padStart(7)} ms |`);
}
console.log('\n========================================================================================================\n');
