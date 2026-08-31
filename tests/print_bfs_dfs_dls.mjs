/**
 * print_bfs_dfs_dls.mjs
 */

import fs from 'fs';

const data = JSON.parse(fs.readFileSync('tests/challenge_benchmark_results.json', 'utf8'));

for (const item of data.slice(0, 5)) {
    console.log(`\n======================================================`);
    console.log(`ALGORITHM: ${item.name} (${item.algo})`);
    console.log(`Status: ${item.summary.success ? 'SUCCESS (5/5)' : 'PARTIAL/FAILED (' + item.summary.netsRouted + '/5)'}`);
    console.log(`Total Explored: ${item.summary.totalNodesExplored} | Conflicts: ${item.summary.totalConflicts} | Rip-Ups: ${item.summary.totalRipups}`);
    console.log(`Total Wire Length: ${item.summary.totalWireLengthMm} mm | Time: ${item.executionTimeMs.toFixed(3)} ms`);
    console.log(`Step Events:`);
    for (const ev of item.stepEvents) {
        if (ev.type === 'net_routed') {
            console.log(`  ✓ Routed [${ev.netName}] (Length: ${(ev.pathLength-1)*5}mm, cost: ${ev.cost})`);
        } else if (ev.type === 'conflict_detected') {
            console.log(`  ⚠ Conflict on [${ev.netName}] (Attempt ${ev.attempt}): ${ev.reason}`);
        } else if (ev.type === 'ripup_performed') {
            console.log(`  🔄 Rip-Up #${ev.ripUpCount}: Erased [${ev.rippedNetName}] to clear way for blocked [${ev.blockedNetName}]`);
        } else if (ev.type === 'net_unroutable') {
            console.log(`  ❌ Unroutable: [${ev.netName}] - ${ev.reason}`);
        }
    }
    console.log(`Final Routed Nets:`);
    for (const r of item.summary.routedNets) {
        console.log(`  - ${r.name}: ${r.wireLengthMm} mm (${r.pathLength} nodes) | Nodes Explored in Search: ${r.nodesExplored}`);
        console.log(`    Path: ${r.pathCoords}`);
    }
    if (item.summary.unroutedNets.length > 0) {
        console.log(`Unrouted Nets:`);
        for (const u of item.summary.unroutedNets) {
            console.log(`  - ${u.name}: ${u.reason}`);
        }
    }
}
