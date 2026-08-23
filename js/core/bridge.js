/**
 * bridge.js - Grid-to-Graph Bridge & Heuristics
 * Translates 2D PCB space into 1D graph nodes, dynamically omitting obstacles.
 */

import { DIR_LIST, PITCH_MM } from './grid.js';

export class GridGraphBridge {
    constructor(grid) {
        this.grid = grid;
    }

    /**
     * Compute heuristic distance between two nodes
     * @param {number} nodeA - start node id
     * @param {number} nodeB - goal node id
     * @param {string} type - 'euclidean' | 'manhattan'
     * @returns {number}
     */
    heuristic(nodeA, nodeB, type = 'euclidean') {
        const a = this.grid.toCoord(nodeA);
        const b = this.grid.toCoord(nodeB);
        if (!a || !b) return 0;

        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);

        if (type === 'manhattan') {
            return (dx + dy) * this.grid.pitch;
        } else {
            // Euclidean
            return Math.sqrt(dx * dx + dy * dy) * this.grid.pitch;
        }
    }

    /**
     * Get valid passable neighbors for a node given the routing context
     * @param {number} nodeId - Current node ID
     * @param {string} netId - ID of net being routed
     * @param {string} targetPinId - ID of goal pin
     * @param {number|null} fromNodeId - Previous node in path (to compute turn penalties)
     * @returns {Array<{ id: number, x: number, y: number, cost: number, dir: string }>}
     */
    getNeighbors(nodeId, netId = null, targetPinId = null, fromNodeId = null) {
        const coord = this.grid.toCoord(nodeId);
        if (!coord) return [];

        const neighbors = [];

        // Determine incoming direction if available
        let inDir = null;
        if (fromNodeId !== null && fromNodeId !== undefined) {
            const prev = this.grid.toCoord(fromNodeId);
            if (prev) {
                inDir = { dx: coord.x - prev.x, dy: coord.y - prev.y };
            }
        }

        for (const dir of DIR_LIST) {
            const nx = coord.x + dir.dx;
            const ny = coord.y + dir.dy;

            if (this.grid.isPassable(nx, ny, netId, targetPinId)) {
                const neighborId = this.grid.toId(nx, ny);
                
                // Base edge cost = pitch in mm (5mm)
                let edgeCost = this.grid.pitch;

                // Turn penalty: small penalty if changing direction to encourage straight traces
                if (inDir && (inDir.dx !== dir.dx || inDir.dy !== dir.dy)) {
                    edgeCost += 1.5; // Turn penalty (mm equivalent cost)
                }

                // Apply congestion/hazard penalty multiplier from rip-up iterations
                const congestion = this.grid.penalties[neighborId] || 1.0;
                edgeCost *= congestion;

                neighbors.push({
                    id: neighborId,
                    x: nx,
                    y: ny,
                    cost: edgeCost,
                    dir: dir.name
                });
            }
        }

        return neighbors;
    }
}
