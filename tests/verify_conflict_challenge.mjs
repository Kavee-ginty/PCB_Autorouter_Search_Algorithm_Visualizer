/**
 * verify_conflict_challenge.mjs - Verifies Rip-Up & Reroute when traces cross
 */

import { PcbGrid, GRID_COLS, GRID_ROWS, PITCH_MM } from '../js/core/grid.js';
import { ComponentInstance } from '../js/core/components.js';
import { GridGraphBridge } from '../js/core/bridge.js';
import { SearchEngine } from '../js/algorithms/engine.js';
import { RipUpRouter } from '../js/router/ripup.js';

console.log('=== Testing Conflict Trigger & Rip-Up Rerouting on Crossing Net Challenge ===\n');

const grid = new PcbGrid(GRID_COLS, GRID_ROWS, PITCH_MM);
const bridge = new GridGraphBridge(grid);
const engine = new SearchEngine(bridge);
const router = new RipUpRouter(grid, bridge, engine);

// Challenge layout
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

const routeGen = router.routeAllNets(netlist, pinLookup, 'astar', { maxRipUpIterations: 6 });
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
        console.log(`  ⚠ CONFLICT DETECTED: [${step.net.name}] is blocked!`);
    } else if (step.type === 'ripup_performed') {
        console.log(`  🔄 RIP-UP PERFORMED: Erased [${step.rippedNet.name}] trace, penalized corridor, re-queueing to reroute!`);
    }
}

console.log('\n--- Challenge Results ---');
console.log(`Nets Total: ${summary.netsTotal}`);
console.log(`Nets Successfully Routed: ${summary.netsRouted}`);
console.log(`Rip-Ups Triggered: ${summary.totalRipups}`);
console.log(`Total Wire Length: ${summary.totalWireLengthMm} mm`);
