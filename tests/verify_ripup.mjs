/**
 * verify_ripup.mjs - Automated Verification for Rip-Up & Reroute Conflict Resolution
 */

import { PcbGrid, GRID_COLS, GRID_ROWS, PITCH_MM } from '../js/core/grid.js';
import { ComponentInstance } from '../js/core/components.js';
import { GridGraphBridge } from '../js/core/bridge.js';
import { SearchEngine } from '../js/algorithms/engine.js';
import { RipUpRouter } from '../js/router/ripup.js';

console.log('=== Running Rip-Up & Reroute Conflict Engine Verification ===\n');

const grid = new PcbGrid(GRID_COLS, GRID_ROWS, PITCH_MM);
const bridge = new GridGraphBridge(grid);
const engine = new SearchEngine(bridge);
const router = new RipUpRouter(grid, bridge, engine);

// 5 Components
const components = [
    new ComponentInstance('bat_1', 'battery', 1, 1, 'horizontal'),
    new ComponentInstance('sw_1', 'switch', 5, 1, 'horizontal'),
    new ComponentInstance('ldr_1', 'sensor', 8, 3, 'vertical'),
    new ComponentInstance('res_1', 'resistor', 5, 6, 'horizontal'),
    new ComponentInstance('led_1', 'led', 1, 5, 'vertical')
];

// Register components on grid
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

// 5 Nets in series loop
const netlist = [
    { id: 'net_1', name: 'Net 1 (VCC)', source: 'B+', target: 'S1-A', color: '#ef4444' },
    { id: 'net_2', name: 'Net 2 (Switched)', source: 'S1-B', target: 'L-in', color: '#f59e0b' },
    { id: 'net_3', name: 'Net 3 (Sensor Out)', source: 'L-out', target: 'R-in', color: '#10b981' },
    { id: 'net_4', name: 'Net 4 (LED Anode)', source: 'R-out', target: 'D-A', color: '#3b82f6' },
    { id: 'net_5', name: 'Net 5 (GND Return)', source: 'D-K', target: 'B-', color: '#8b5cf6' }
];

console.log(`Starting sequential multi-net routing for ${netlist.length} nets using A* Search...`);

const routeGen = router.routeAllNets(netlist, pinLookup, 'astar', { maxRipUpIterations: 5 });
let summary = null;

while (true) {
    const iter = routeGen.next();
    if (iter.done) {
        summary = iter.value;
        break;
    }
    const step = iter.value;
    if (step.type === 'net_routed') {
        console.log(`  ✓ Net Routed: [${step.net.name}] (${step.path.length} cells, cost: ${step.cost.toFixed(1)}mm)`);
    } else if (step.type === 'conflict_detected') {
        console.log(`  ⚠ Conflict Detected: [${step.net.name}]`);
    } else if (step.type === 'ripup_performed') {
        console.log(`  🔄 Rip-Up: Erased [${step.rippedNet.name}] to route [${step.blockedNet.name}]`);
    }
}

console.log('\n--- Routing Summary ---');
console.log(`Nets Total: ${summary.netsTotal}`);
console.log(`Nets Successfully Routed: ${summary.netsRouted}`);
console.log(`Total Nodes Explored: ${summary.totalNodesExplored}`);
console.log(`Total Wire Length: ${summary.totalWireLengthMm} mm`);
console.log(`Rip-Ups Performed: ${summary.totalRipups}`);

if (summary.netsRouted === summary.netsTotal) {
    console.log('\n✓ Multi-Net Routing & Rip-Up Engine Verified Successfully (100% Routed)!\n');
} else {
    console.log(`\n⚠ Partial routing: ${summary.netsRouted}/${summary.netsTotal} routed.`);
}
