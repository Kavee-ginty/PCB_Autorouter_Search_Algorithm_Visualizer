/**
 * informed.js - Informed & Advanced Search Algorithms
 * Implements: Greedy Best-First Search, A* Search, and Bidirectional Search (BDS)
 */

import { MinPriorityQueue } from './priorityQueue.js';

let treeNodeCounter = 0;

function createTreeNode(nodeId, coord, depth = 0, g = 0, h = 0, parent = null, dir = '') {
    return {
        treeId: ++treeNodeCounter,
        nodeId,
        x: coord.x,
        y: coord.y,
        name: `(${coord.x},${coord.y})`,
        depth,
        g,
        h,
        f: g + h,
        parent,
        children: [],
        status: 'frontier',
        dir
    };
}

function markSolutionTree(goalTreeNode) {
    let curr = goalTreeNode;
    while (curr) {
        curr.status = 'solution';
        curr = curr.parent;
    }
}

/**
 * Greedy Best-First Search
 * Prioritizes nodes strictly by heuristic h(n) = distance to goal
 */
export function* searchGreedy(bridge, startNodeId, goalNodeId, netId, targetPinId, heuristicType = 'euclidean') {
    treeNodeCounter = 0;
    const startCoord = bridge.grid.toCoord(startNodeId);
    const initialH = bridge.heuristic(startNodeId, goalNodeId, heuristicType);
    const rootTree = createTreeNode(startNodeId, startCoord, 0, 0, initialH, null);

    const pq = new MinPriorityQueue();
    pq.push({ nodeId: startNodeId, treeNode: rootTree, path: [startNodeId], cost: 0, h: initialH }, initialH);

    const visited = new Set();
    let nodesExplored = 0;

    while (!pq.isEmpty()) {
        const current = pq.pop();
        if (visited.has(current.nodeId)) continue;
        visited.add(current.nodeId);
        nodesExplored++;
        current.treeNode.status = 'visited';

        if (current.nodeId === goalNodeId) {
            markSolutionTree(current.treeNode);
            yield {
                type: 'finish',
                success: true,
                path: current.path,
                frontier: pq.getItems().map(item => item.nodeId),
                visited: Array.from(visited),
                nodesExplored,
                cost: current.cost,
                tree: rootTree
            };
            return { success: true, path: current.path, nodesExplored, cost: current.cost, tree: rootTree };
        }

        yield {
            type: 'step',
            currentNode: current.nodeId,
            currentH: current.h,
            frontier: pq.getItems().map(item => item.nodeId),
            visited: Array.from(visited),
            nodesExplored,
            tree: rootTree
        };

        const neighbors = bridge.getNeighbors(current.nodeId, netId, targetPinId, current.path[current.path.length - 2]);
        for (const n of neighbors) {
            if (!visited.has(n.id)) {
                const h = bridge.heuristic(n.id, goalNodeId, heuristicType);
                const nCoord = bridge.grid.toCoord(n.id);
                const nTreeNode = createTreeNode(n.id, nCoord, current.treeNode.depth + 1, current.cost + n.cost, h, current.treeNode, n.dir);
                current.treeNode.children.push(nTreeNode);

                pq.push({
                    nodeId: n.id,
                    treeNode: nTreeNode,
                    path: [...current.path, n.id],
                    cost: current.cost + n.cost,
                    h
                }, h);
            }
        }
    }

    yield { type: 'finish', success: false, path: [], nodesExplored, cost: 0, tree: rootTree };
    return { success: false, path: [], nodesExplored, cost: 0, tree: rootTree };
}

/**
 * A* Search
 * Evaluates nodes by f(n) = g(n) + h(n)
 */
export function* searchAStar(bridge, startNodeId, goalNodeId, netId, targetPinId, heuristicType = 'euclidean') {
    treeNodeCounter = 0;
    const startCoord = bridge.grid.toCoord(startNodeId);
    const initialH = bridge.heuristic(startNodeId, goalNodeId, heuristicType);
    const rootTree = createTreeNode(startNodeId, startCoord, 0, 0, initialH, null);

    const pq = new MinPriorityQueue();
    pq.push({ nodeId: startNodeId, treeNode: rootTree, path: [startNodeId], g: 0, h: initialH }, initialH);

    const bestG = new Map();
    bestG.set(startNodeId, 0);
    const visited = new Set();
    let nodesExplored = 0;

    while (!pq.isEmpty()) {
        const current = pq.pop();
        if (visited.has(current.nodeId)) continue;
        visited.add(current.nodeId);
        nodesExplored++;
        current.treeNode.status = 'visited';

        if (current.nodeId === goalNodeId) {
            markSolutionTree(current.treeNode);
            yield {
                type: 'finish',
                success: true,
                path: current.path,
                frontier: pq.getItems().map(item => item.nodeId),
                visited: Array.from(visited),
                nodesExplored,
                cost: current.g,
                tree: rootTree
            };
            return { success: true, path: current.path, nodesExplored, cost: current.g, tree: rootTree };
        }

        yield {
            type: 'step',
            currentNode: current.nodeId,
            g: current.g,
            h: current.h,
            f: current.g + current.h,
            frontier: pq.getItems().map(item => item.nodeId),
            visited: Array.from(visited),
            nodesExplored,
            tree: rootTree
        };

        const neighbors = bridge.getNeighbors(current.nodeId, netId, targetPinId, current.path[current.path.length - 2]);
        for (const n of neighbors) {
            const nextG = current.g + n.cost;
            if (!bestG.has(n.id) || nextG < bestG.get(n.id)) {
                bestG.set(n.id, nextG);
                const h = bridge.heuristic(n.id, goalNodeId, heuristicType);
                const f = nextG + h;
                const nCoord = bridge.grid.toCoord(n.id);
                const nTreeNode = createTreeNode(n.id, nCoord, current.treeNode.depth + 1, nextG, h, current.treeNode, n.dir);
                current.treeNode.children.push(nTreeNode);

                pq.push({
                    nodeId: n.id,
                    treeNode: nTreeNode,
                    path: [...current.path, n.id],
                    g: nextG,
                    h
                }, f);
            }
        }
    }

    yield { type: 'finish', success: false, path: [], nodesExplored, cost: 0, tree: rootTree };
    return { success: false, path: [], nodesExplored, cost: 0, tree: rootTree };
}

/**
 * Bidirectional Search (BDS)
 * Alternating search from start pin and target pin until frontiers meet
 */
export function* searchBidirectional(bridge, startNodeId, goalNodeId, netId, targetPinId) {
    treeNodeCounter = 0;
    const startCoord = bridge.grid.toCoord(startNodeId);
    const goalCoord = bridge.grid.toCoord(goalNodeId);

    const rootForward = createTreeNode(startNodeId, startCoord, 0, 0, 0, null);
    const rootBackward = createTreeNode(goalNodeId, goalCoord, 0, 0, 0, null);

    if (startNodeId === goalNodeId) {
        rootForward.status = 'solution';
        yield { type: 'finish', success: true, path: [startNodeId], nodesExplored: 1, cost: 0, tree: rootForward };
        return { success: true, path: [startNodeId], nodesExplored: 1, cost: 0, tree: rootForward };
    }

    const queueF = [{ nodeId: startNodeId, treeNode: rootForward, path: [startNodeId], cost: 0 }];
    const queueB = [{ nodeId: goalNodeId, treeNode: rootBackward, path: [goalNodeId], cost: 0 }];

    const visitedF = new Map([[startNodeId, { path: [startNodeId], cost: 0, treeNode: rootForward }]]);
    const visitedB = new Map([[goalNodeId, { path: [goalNodeId], cost: 0, treeNode: rootBackward }]]);

    let nodesExplored = 0;

    // Helper root containing both branches for visualizer
    const compositeRoot = {
        treeId: 0,
        nodeId: startNodeId,
        name: 'Bidirectional Root',
        depth: 0,
        children: [rootForward, rootBackward],
        status: 'visited'
    };

    while (queueF.length > 0 && queueB.length > 0) {
        // Expand Forward step
        if (queueF.length > 0) {
            const currF = queueF.shift();
            nodesExplored++;
            currF.treeNode.status = 'visited';

            // Check meeting
            if (visitedB.has(currF.nodeId)) {
                const bInfo = visitedB.get(currF.nodeId);
                const bPathReversed = [...bInfo.path].reverse().slice(1);
                const fullPath = [...currF.path, ...bPathReversed];
                const totalCost = currF.cost + bInfo.cost;

                markSolutionTree(currF.treeNode);
                markSolutionTree(bInfo.treeNode);

                yield {
                    type: 'finish',
                    success: true,
                    path: fullPath,
                    frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                    visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                    nodesExplored,
                    cost: totalCost,
                    tree: compositeRoot
                };
                return { success: true, path: fullPath, nodesExplored, cost: totalCost, tree: compositeRoot };
            }

            yield {
                type: 'step',
                direction: 'forward',
                currentNode: currF.nodeId,
                frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                nodesExplored,
                tree: compositeRoot
            };

            const neighborsF = bridge.getNeighbors(currF.nodeId, netId, targetPinId, currF.path[currF.path.length - 2]);
            for (const n of neighborsF) {
                if (!visitedF.has(n.id)) {
                    const nCoord = bridge.grid.toCoord(n.id);
                    const nTreeNode = createTreeNode(n.id, nCoord, currF.treeNode.depth + 1, currF.cost + n.cost, 0, currF.treeNode, n.dir);
                    currF.treeNode.children.push(nTreeNode);

                    const nextPath = [...currF.path, n.id];
                    const nextCost = currF.cost + n.cost;

                    visitedF.set(n.id, { path: nextPath, cost: nextCost, treeNode: nTreeNode });
                    queueF.push({ nodeId: n.id, treeNode: nTreeNode, path: nextPath, cost: nextCost });

                    // Check if newly discovered neighbor meets backward frontier
                    if (visitedB.has(n.id)) {
                        const bInfo = visitedB.get(n.id);
                        const bPathReversed = [...bInfo.path].reverse().slice(1);
                        const fullPath = [...nextPath, ...bPathReversed];
                        const totalCost = nextCost + bInfo.cost;

                        markSolutionTree(nTreeNode);
                        markSolutionTree(bInfo.treeNode);

                        yield {
                            type: 'finish',
                            success: true,
                            path: fullPath,
                            frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                            visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                            nodesExplored: nodesExplored + 1,
                            cost: totalCost,
                            tree: compositeRoot
                        };
                        return { success: true, path: fullPath, nodesExplored: nodesExplored + 1, cost: totalCost, tree: compositeRoot };
                    }
                }
            }
        }

        // Expand Backward step
        if (queueB.length > 0) {
            const currB = queueB.shift();
            nodesExplored++;
            currB.treeNode.status = 'visited';

            // Check meeting
            if (visitedF.has(currB.nodeId)) {
                const fInfo = visitedF.get(currB.nodeId);
                const bPathReversed = [...currB.path].reverse().slice(1);
                const fullPath = [...fInfo.path, ...bPathReversed];
                const totalCost = fInfo.cost + currB.cost;

                markSolutionTree(fInfo.treeNode);
                markSolutionTree(currB.treeNode);

                yield {
                    type: 'finish',
                    success: true,
                    path: fullPath,
                    frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                    visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                    nodesExplored,
                    cost: totalCost,
                    tree: compositeRoot
                };
                return { success: true, path: fullPath, nodesExplored, cost: totalCost, tree: compositeRoot };
            }

            yield {
                type: 'step',
                direction: 'backward',
                currentNode: currB.nodeId,
                frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                nodesExplored,
                tree: compositeRoot
            };

            const startPin = bridge.grid.occupants[startNodeId]?.pinId;
            const neighborsB = bridge.getNeighbors(currB.nodeId, netId, startPin, currB.path[currB.path.length - 2]);
            for (const n of neighborsB) {
                if (!visitedB.has(n.id)) {
                    const nCoord = bridge.grid.toCoord(n.id);
                    const nTreeNode = createTreeNode(n.id, nCoord, currB.treeNode.depth + 1, currB.cost + n.cost, 0, currB.treeNode, n.dir);
                    currB.treeNode.children.push(nTreeNode);

                    const nextPath = [...currB.path, n.id];
                    const nextCost = currB.cost + n.cost;

                    visitedB.set(n.id, { path: nextPath, cost: nextCost, treeNode: nTreeNode });
                    queueB.push({ nodeId: n.id, treeNode: nTreeNode, path: nextPath, cost: nextCost });

                    if (visitedF.has(n.id)) {
                        const fInfo = visitedF.get(n.id);
                        const bPathReversed = [...nextPath].reverse().slice(1);
                        const fullPath = [...fInfo.path, ...bPathReversed];
                        const totalCost = fInfo.cost + nextCost;

                        markSolutionTree(fInfo.treeNode);
                        markSolutionTree(nTreeNode);

                        yield {
                            type: 'finish',
                            success: true,
                            path: fullPath,
                            frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                            visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                            nodesExplored: nodesExplored + 1,
                            cost: totalCost,
                            tree: compositeRoot
                        };
                        return { success: true, path: fullPath, nodesExplored: nodesExplored + 1, cost: totalCost, tree: compositeRoot };
                    }
                }
            }
        }
    }

    yield { type: 'finish', success: false, path: [], nodesExplored, cost: 0, tree: compositeRoot };
    return { success: false, path: [], nodesExplored, cost: 0, tree: compositeRoot };
}
