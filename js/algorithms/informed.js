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
 * /**
 * Greedy Best-First Search
 * Prioritizes nodes strictly by heuristic h(n) = distance to goal
 */
export function* searchGreedy(bridge, startNodeId, goalNodeId, netId, targetPinId, heuristicType = 'euclidean') {
    treeNodeCounter = 0;
    const startCoord = bridge.grid.toCoord(startNodeId);
    const initialH = bridge.heuristic(startNodeId, goalNodeId, heuristicType);
    const rootTree = createTreeNode(startNodeId, startCoord, 0, 0, initialH, null);
    const treeEdges = [];

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
                type: 'step',
                currentNode: current.nodeId,
                currentPath: [...current.path],
                treeEdges: [...treeEdges],
                currentH: current.h,
                g: current.cost,
                h: current.h,
                f: current.h,
                depth: current.treeNode.depth,
                frontier: pq.getItems().map(item => item.nodeId),
                visited: Array.from(visited),
                nodesExplored,
                action: 'goal_reached',
                tree: rootTree
            };
            yield {
                type: 'finish',
                success: true,
                path: current.path,
                currentPath: [...current.path],
                treeEdges: [...treeEdges],
                frontier: pq.getItems().map(item => item.nodeId),
                visited: Array.from(visited),
                nodesExplored,
                cost: current.cost,
                tree: rootTree
            };
            return { success: true, path: current.path, nodesExplored, cost: current.cost, tree: rootTree, treeEdges };
        }

        const neighbors = bridge.getNeighbors(current.nodeId, netId, targetPinId, current.path[current.path.length - 2]);
        for (const n of neighbors) {
            if (!visited.has(n.id)) {
                const h = bridge.heuristic(n.id, goalNodeId, heuristicType);
                const nCoord = bridge.grid.toCoord(n.id);
                const nTreeNode = createTreeNode(n.id, nCoord, current.treeNode.depth + 1, current.cost + n.cost, h, current.treeNode, n.dir);
                current.treeNode.children.push(nTreeNode);

                treeEdges.push({ from: current.nodeId, to: n.id, cost: n.cost, h, dir: n.dir });

                pq.push({
                    nodeId: n.id,
                    treeNode: nTreeNode,
                    path: [...current.path, n.id],
                    cost: current.cost + n.cost,
                    h
                }, h);
            }
        }

        yield {
            type: 'step',
            currentNode: current.nodeId,
            currentPath: [...current.path],
            treeEdges: [...treeEdges],
            currentH: current.h,
            g: current.cost,
            h: current.h,
            f: current.h,
            depth: current.treeNode.depth,
            frontier: pq.getItems().map(item => item.nodeId),
            visited: Array.from(visited),
            nodesExplored,
            action: 'expand',
            tree: rootTree
        };
    }

    yield { type: 'finish', success: false, path: [], currentPath: [], treeEdges: [...treeEdges], nodesExplored, cost: 0, tree: rootTree };
    return { success: false, path: [], nodesExplored, cost: 0, tree: rootTree, treeEdges };
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
    const treeEdges = [];

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
                type: 'step',
                currentNode: current.nodeId,
                currentPath: [...current.path],
                treeEdges: [...treeEdges],
                g: current.g,
                h: current.h,
                f: current.g + current.h,
                depth: current.treeNode.depth,
                frontier: pq.getItems().map(item => item.nodeId),
                visited: Array.from(visited),
                nodesExplored,
                action: 'goal_reached',
                tree: rootTree
            };
            yield {
                type: 'finish',
                success: true,
                path: current.path,
                currentPath: [...current.path],
                treeEdges: [...treeEdges],
                frontier: pq.getItems().map(item => item.nodeId),
                visited: Array.from(visited),
                nodesExplored,
                cost: current.g,
                tree: rootTree
            };
            return { success: true, path: current.path, nodesExplored, cost: current.g, tree: rootTree, treeEdges };
        }

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

                treeEdges.push({ from: current.nodeId, to: n.id, cost: n.cost, g: nextG, h, f, dir: n.dir });

                pq.push({
                    nodeId: n.id,
                    treeNode: nTreeNode,
                    path: [...current.path, n.id],
                    g: nextG,
                    h
                }, f);
            }
        }

        yield {
            type: 'step',
            currentNode: current.nodeId,
            currentPath: [...current.path],
            treeEdges: [...treeEdges],
            g: current.g,
            h: current.h,
            f: current.g + current.h,
            depth: current.treeNode.depth,
            frontier: pq.getItems().map(item => item.nodeId),
            visited: Array.from(visited),
            nodesExplored,
            action: 'expand',
            tree: rootTree
        };
    }

    yield { type: 'finish', success: false, path: [], currentPath: [], treeEdges: [...treeEdges], nodesExplored, cost: 0, tree: rootTree };
    return { success: false, path: [], nodesExplored, cost: 0, tree: rootTree, treeEdges };
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

    const treeEdgesF = [];
    const treeEdgesB = [];

    if (startNodeId === goalNodeId) {
        rootForward.status = 'solution';
        yield { type: 'finish', success: true, path: [startNodeId], nodesExplored: 1, cost: 0, tree: rootForward, treeEdges: [] };
        return { success: true, path: [startNodeId], nodesExplored: 1, cost: 0, tree: rootForward, treeEdges: [] };
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

                const allEdges = [...treeEdgesF, ...treeEdgesB];
                yield {
                    type: 'finish',
                    success: true,
                    path: fullPath,
                    currentPath: fullPath,
                    treeEdges: allEdges,
                    treeEdgesF: [...treeEdgesF],
                    treeEdgesB: [...treeEdgesB],
                    frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                    visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                    nodesExplored,
                    cost: totalCost,
                    tree: compositeRoot
                };
                return { success: true, path: fullPath, nodesExplored, cost: totalCost, tree: compositeRoot, treeEdges: allEdges };
            }

            yield {
                type: 'step',
                direction: 'forward',
                currentNode: currF.nodeId,
                currentPath: [...currF.path],
                treeEdges: [...treeEdgesF, ...treeEdgesB],
                treeEdgesF: [...treeEdgesF],
                treeEdgesB: [...treeEdgesB],
                depth: currF.treeNode.depth,
                g: currF.cost,
                h: 0,
                f: currF.cost,
                frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                nodesExplored,
                action: 'expand',
                tree: compositeRoot
            };

            const neighborsF = bridge.getNeighbors(currF.nodeId, netId, targetPinId, currF.path[currF.path.length - 2]);
            for (const n of neighborsF) {
                if (!visitedF.has(n.id)) {
                    const nCoord = bridge.grid.toCoord(n.id);
                    const nTreeNode = createTreeNode(n.id, nCoord, currF.treeNode.depth + 1, currF.cost + n.cost, 0, currF.treeNode, n.dir);
                    currF.treeNode.children.push(nTreeNode);

                    treeEdgesF.push({ from: currF.nodeId, to: n.id, cost: n.cost, dir: n.dir, direction: 'forward' });

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

                        const allEdges = [...treeEdgesF, ...treeEdgesB];
                        yield {
                            type: 'finish',
                            success: true,
                            path: fullPath,
                            currentPath: fullPath,
                            treeEdges: allEdges,
                            treeEdgesF: [...treeEdgesF],
                            treeEdgesB: [...treeEdgesB],
                            frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                            visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                            nodesExplored: nodesExplored + 1,
                            cost: totalCost,
                            tree: compositeRoot
                        };
                        return { success: true, path: fullPath, nodesExplored: nodesExplored + 1, cost: totalCost, tree: compositeRoot, treeEdges: allEdges };
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

                const allEdges = [...treeEdgesF, ...treeEdgesB];
                yield {
                    type: 'finish',
                    success: true,
                    path: fullPath,
                    currentPath: fullPath,
                    treeEdges: allEdges,
                    treeEdgesF: [...treeEdgesF],
                    treeEdgesB: [...treeEdgesB],
                    frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                    visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                    nodesExplored,
                    cost: totalCost,
                    tree: compositeRoot
                };
                return { success: true, path: fullPath, nodesExplored, cost: totalCost, tree: compositeRoot, treeEdges: allEdges };
            }

            yield {
                type: 'step',
                direction: 'backward',
                currentNode: currB.nodeId,
                currentPath: [...currB.path],
                treeEdges: [...treeEdgesF, ...treeEdgesB],
                treeEdgesF: [...treeEdgesF],
                treeEdgesB: [...treeEdgesB],
                depth: currB.treeNode.depth,
                g: currB.cost,
                h: 0,
                f: currB.cost,
                frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                nodesExplored,
                action: 'expand',
                tree: compositeRoot
            };

            const startPin = bridge.grid.occupants[startNodeId]?.pinId;
            const neighborsB = bridge.getNeighbors(currB.nodeId, netId, startPin, currB.path[currB.path.length - 2]);
            for (const n of neighborsB) {
                if (!visitedB.has(n.id)) {
                    const nCoord = bridge.grid.toCoord(n.id);
                    const nTreeNode = createTreeNode(n.id, nCoord, currB.treeNode.depth + 1, currB.cost + n.cost, 0, currB.treeNode, n.dir);
                    currB.treeNode.children.push(nTreeNode);

                    treeEdgesB.push({ from: currB.nodeId, to: n.id, cost: n.cost, dir: n.dir, direction: 'backward' });

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

                        const allEdges = [...treeEdgesF, ...treeEdgesB];
                        yield {
                            type: 'finish',
                            success: true,
                            path: fullPath,
                            currentPath: fullPath,
                            treeEdges: allEdges,
                            treeEdgesF: [...treeEdgesF],
                            treeEdgesB: [...treeEdgesB],
                            frontier: [...queueF.map(q => q.nodeId), ...queueB.map(q => q.nodeId)],
                            visited: [...Array.from(visitedF.keys()), ...Array.from(visitedB.keys())],
                            nodesExplored: nodesExplored + 1,
                            cost: totalCost,
                            tree: compositeRoot
                        };
                        return { success: true, path: fullPath, nodesExplored: nodesExplored + 1, cost: totalCost, tree: compositeRoot, treeEdges: allEdges };
                    }
                }
            }
        }
    }

    const allEdges = [...treeEdgesF, ...treeEdgesB];
    yield { type: 'finish', success: false, path: [], currentPath: [], treeEdges: allEdges, nodesExplored, cost: 0, tree: compositeRoot };
    return { success: false, path: [], nodesExplored, cost: 0, tree: compositeRoot, treeEdges: allEdges };
}
