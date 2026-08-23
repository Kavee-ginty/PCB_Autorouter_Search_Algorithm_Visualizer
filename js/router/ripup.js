/**
 * ripup.js - Multi-Net Sequential Router with Rip-Up & Reroute Conflict Resolution
 */

export class RipUpRouter {
    constructor(grid, bridge, searchEngine) {
        this.grid = grid;
        this.bridge = bridge;
        this.engine = searchEngine;
    }

    /**
     * Generator for multi-net routing with animated rip-up & reroute logic
     * @param {Array} netlist - Array of net objects: [{ id, name, source, target, color }]
     * @param {Map} pinLookup - Map of pinId -> { x, y, id, componentId, nodeId }
     * @param {string} algorithmKey - Search algorithm to use
     * @param {object} options - Search options (heuristic, depthLimit, maxRipUpIterations)
     */
    *routeAllNets(netlist, pinLookup, algorithmKey = 'astar', options = {}) {
        const maxRipUps = options.maxRipUpIterations || 5;
        this.grid.clearTraces();
        this.grid.resetPenalties();

        // State tracking
        const routedNets = new Map(); // netId -> { path, cost, nodesExplored, tree }
        const unroutedNets = [];
        let totalNodesExplored = 0;
        let totalConflicts = 0;
        let totalRipups = 0;
        const ripUpHistory = [];

        yield {
            type: 'routing_started',
            totalNets: netlist.length,
            algorithm: algorithmKey
        };

        const pendingNets = [...netlist];
        let ripUpCount = 0;

        while (pendingNets.length > 0) {
            const currentNet = pendingNets.shift();
            const srcPin = pinLookup.get(currentNet.source);
            const tgtPin = pinLookup.get(currentNet.target);

            if (!srcPin || !tgtPin) {
                unroutedNets.push({ net: currentNet, reason: 'Invalid pin designator' });
                continue;
            }

            const startNodeId = srcPin.nodeId;
            const goalNodeId = tgtPin.nodeId;

            yield {
                type: 'net_start',
                net: currentNet,
                startNodeId,
                goalNodeId
            };

            // Run search generator for the current net
            const searchGen = this.engine.createSearchGenerator(
                algorithmKey,
                startNodeId,
                goalNodeId,
                currentNet.id,
                tgtPin.id,
                options
            );

            let searchResult = null;
            while (true) {
                const step = searchGen.next();
                if (step.done) {
                    searchResult = step.value;
                    break;
                }
                if (step.value.type === 'step') {
                    totalNodesExplored++;
                    yield {
                        type: 'search_step',
                        net: currentNet,
                        ...step.value,
                        totalNodesExplored
                    };
                }
                if (step.value.type === 'finish') {
                    searchResult = step.value;
                }
            }

            if (searchResult && searchResult.success) {
                // Successfully routed
                totalNodesExplored += (searchResult.nodesExplored || 0);
                
                // Commit trace to grid
                this._commitTrace(currentNet, searchResult.path, startNodeId, goalNodeId);

                routedNets.set(currentNet.id, {
                    net: currentNet,
                    path: searchResult.path,
                    cost: searchResult.cost,
                    nodesExplored: searchResult.nodesExplored,
                    tree: searchResult.tree,
                    ripUps: 0
                });

                yield {
                    type: 'net_routed',
                    net: currentNet,
                    path: searchResult.path,
                    cost: searchResult.cost,
                    tree: searchResult.tree
                };
            } else {
                // Conflict / Deadlock detected!
                totalConflicts++;
                yield {
                    type: 'conflict_detected',
                    net: currentNet,
                    attempt: ripUpCount + 1,
                    reason: 'Path obstructed by existing traces or boundaries'
                };

                if (ripUpCount < maxRipUps && routedNets.size > 0) {
                    ripUpCount++;
                    totalRipups++;

                    // Identify which blocking net to rip up
                    const blockingNetId = this._selectNetToRipUp(currentNet, startNodeId, goalNodeId, routedNets, pinLookup);
                    const rippedData = routedNets.get(blockingNetId);

                    if (rippedData) {
                        // 1. Rip up (erase) trace from grid
                        this._eraseTrace(rippedData.net.id, rippedData.path, pinLookup.get(rippedData.net.source)?.nodeId, pinLookup.get(rippedData.net.target)?.nodeId);
                        routedNets.delete(blockingNetId);

                        // 2. Apply congestion penalties to contested cells
                        for (const cellId of rippedData.path) {
                            this.grid.addPenalty(cellId, 3.5);
                        }

                        ripUpHistory.push({
                            rippedNet: rippedData.net,
                            blockedNet: currentNet,
                            cycle: ripUpCount
                        });

                        yield {
                            type: 'ripup_performed',
                            rippedNet: rippedData.net,
                            blockedNet: currentNet,
                            ripUpCount,
                            rippedPath: rippedData.path
                        };

                        // Put blocked net first, then re-queue ripped net to be rerouted
                        pendingNets.unshift(rippedData.net);
                        pendingNets.unshift(currentNet);
                    } else {
                        unroutedNets.push({ net: currentNet, reason: 'No suitable net to rip up' });
                    }
                } else {
                    // Planar limit reached or max rip-ups exceeded -> leave unrouted
                    unroutedNets.push({ net: currentNet, reason: 'Non-planar topological crossing or unroutable constraint' });
                    yield {
                        type: 'net_unroutable',
                        net: currentNet,
                        reason: 'Non-planar topological crossing'
                    };
                }
            }
        }

        // Calculate total wire length
        let totalWireLength = 0;
        for (const [netId, r] of routedNets) {
            totalWireLength += (r.path.length - 1) * this.grid.pitch;
        }

        const summary = {
            success: unroutedNets.length === 0,
            netsTotal: netlist.length,
            netsRouted: routedNets.size,
            netsUnrouted: unroutedNets.length,
            routedNets: Array.from(routedNets.values()),
            unroutedNets,
            totalNodesExplored,
            totalConflicts,
            totalRipups,
            totalWireLengthMm: totalWireLength,
            ripUpHistory
        };

        yield {
            type: 'routing_completed',
            summary
        };

        return summary;
    }

    _commitTrace(net, path, startNodeId, goalNodeId) {
        for (const nodeId of path) {
            // Don't overwrite pin cells as simple traces, keep them as pins with net association
            if (nodeId !== startNodeId && nodeId !== goalNodeId) {
                this.grid.setTrace(nodeId, {
                    type: 'trace',
                    netId: net.id,
                    color: net.color || '#f59e0b'
                });
            }
        }
    }

    _eraseTrace(netId, path, startNodeId, goalNodeId) {
        for (const nodeId of path) {
            if (nodeId !== startNodeId && nodeId !== goalNodeId) {
                this.grid.clearCell(nodeId);
            }
        }
    }

    _selectNetToRipUp(blockedNet, startNodeId, goalNodeId, routedNets, pinLookup) {
        // Run a hypothetical obstacle-ignoring A* / BFS to see which existing trace intersects closest
        const startCoord = this.grid.toCoord(startNodeId);
        const goalCoord = this.grid.toCoord(goalNodeId);

        // Find routed net whose traces are closest to the bounding line between start and goal
        let bestNetId = null;
        let minDistance = Infinity;

        for (const [netId, data] of routedNets) {
            for (const cellId of data.path) {
                const c = this.grid.toCoord(cellId);
                // Distance from line segment (startCoord -> goalCoord)
                const dist = this._pointToSegmentDist(c.x, c.y, startCoord.x, startCoord.y, goalCoord.x, goalCoord.y);
                if (dist < minDistance) {
                    minDistance = dist;
                    bestNetId = netId;
                }
            }
        }

        // Fallback: pick the first routed net
        return bestNetId || routedNets.keys().next().value;
    }

    _pointToSegmentDist(px, py, x1, y1, x2, y2) {
        const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
    }
}
