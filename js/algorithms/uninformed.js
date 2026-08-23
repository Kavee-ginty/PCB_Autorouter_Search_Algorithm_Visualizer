/**
 * uninformed.js - Uninformed Search Algorithms
 * Implements: BFS, DFS, DLS, IDS, UCS with step generator and hierarchical state-space tree extraction.
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
        status: 'frontier', // 'frontier' | 'visited' | 'pruned' | 'solution'
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
 * Breadth-First Search (BFS)
 */
export function* searchBFS(bridge, startNodeId, goalNodeId, netId, targetPinId) {
    treeNodeCounter = 0;
    const startCoord = bridge.grid.toCoord(startNodeId);
    const rootTree = createTreeNode(startNodeId, startCoord, 0, 0, 0, null);
    const treeEdges = [];

    if (startNodeId === goalNodeId) {
        rootTree.status = 'solution';
        yield { type: 'finish', success: true, path: [startNodeId], nodesExplored: 1, cost: 0, tree: rootTree, treeEdges };
        return { success: true, path: [startNodeId], nodesExplored: 1, cost: 0, tree: rootTree, treeEdges };
    }

    const queue = [{ nodeId: startNodeId, treeNode: rootTree, path: [startNodeId], cost: 0 }];
    const visited = new Set([startNodeId]);
    let nodesExplored = 0;

    while (queue.length > 0) {
        const current = queue.shift();
        nodesExplored++;
        current.treeNode.status = 'visited';

        const neighbors = bridge.getNeighbors(current.nodeId, netId, targetPinId, current.path[current.path.length - 2]);
        let goalReached = null;

        for (const n of neighbors) {
            if (!visited.has(n.id)) {
                visited.add(n.id);
                const nCoord = bridge.grid.toCoord(n.id);
                const nTreeNode = createTreeNode(n.id, nCoord, current.treeNode.depth + 1, current.cost + n.cost, 0, current.treeNode, n.dir);
                current.treeNode.children.push(nTreeNode);

                treeEdges.push({ from: current.nodeId, to: n.id, cost: n.cost, dir: n.dir });

                const nextPath = [...current.path, n.id];
                const nextCost = current.cost + n.cost;

                if (n.id === goalNodeId) {
                    markSolutionTree(nTreeNode);
                    goalReached = { path: nextPath, cost: nextCost, treeNode: nTreeNode };
                } else {
                    queue.push({ nodeId: n.id, treeNode: nTreeNode, path: nextPath, cost: nextCost });
                }
            }
        }

        yield {
            type: 'step',
            currentNode: current.nodeId,
            currentPath: [...current.path],
            treeEdges: [...treeEdges],
            frontier: queue.map(q => q.nodeId),
            visited: Array.from(visited),
            nodesExplored,
            depth: current.treeNode.depth,
            g: current.cost,
            h: 0,
            f: current.cost,
            action: goalReached ? 'goal_found' : 'expand',
            tree: rootTree
        };

        if (goalReached) {
            yield {
                type: 'step',
                currentNode: goalNodeId,
                currentPath: goalReached.path,
                treeEdges: [...treeEdges],
                frontier: queue.map(q => q.nodeId),
                visited: Array.from(visited),
                nodesExplored: nodesExplored + 1,
                depth: goalReached.treeNode.depth,
                g: goalReached.cost,
                h: 0,
                f: goalReached.cost,
                action: 'goal_reached',
                tree: rootTree
            };
            yield {
                type: 'finish',
                success: true,
                path: goalReached.path,
                currentPath: goalReached.path,
                treeEdges: [...treeEdges],
                frontier: queue.map(q => q.nodeId),
                visited: Array.from(visited),
                nodesExplored: nodesExplored + 1,
                cost: goalReached.cost,
                tree: rootTree
            };
            return { success: true, path: goalReached.path, nodesExplored: nodesExplored + 1, cost: goalReached.cost, tree: rootTree, treeEdges };
        }
    }

    yield { type: 'finish', success: false, path: [], currentPath: [], treeEdges: [...treeEdges], nodesExplored, cost: 0, tree: rootTree };
    return { success: false, path: [], nodesExplored, cost: 0, tree: rootTree, treeEdges };
}

/**
 * Depth-First Search (DFS)
 */
export function* searchDFS(bridge, startNodeId, goalNodeId, netId, targetPinId) {
    treeNodeCounter = 0;
    const startCoord = bridge.grid.toCoord(startNodeId);
    const rootTree = createTreeNode(startNodeId, startCoord, 0, 0, 0, null);
    const treeEdges = [];

    if (startNodeId === goalNodeId) {
        rootTree.status = 'solution';
        yield { type: 'finish', success: true, path: [startNodeId], nodesExplored: 1, cost: 0, tree: rootTree, treeEdges };
        return { success: true, path: [startNodeId], nodesExplored: 1, cost: 0, tree: rootTree, treeEdges };
    }

    const stack = [{ nodeId: startNodeId, treeNode: rootTree, path: [startNodeId], cost: 0 }];
    const visited = new Set();
    let nodesExplored = 0;

    while (stack.length > 0) {
        const current = stack.pop();
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
                frontier: stack.map(s => s.nodeId),
                visited: Array.from(visited),
                nodesExplored,
                depth: current.treeNode.depth,
                g: current.cost,
                h: 0,
                f: current.cost,
                action: 'goal_reached',
                tree: rootTree
            };
            yield {
                type: 'finish',
                success: true,
                path: current.path,
                currentPath: [...current.path],
                treeEdges: [...treeEdges],
                frontier: stack.map(s => s.nodeId),
                visited: Array.from(visited),
                nodesExplored,
                cost: current.cost,
                tree: rootTree
            };
            return { success: true, path: current.path, nodesExplored, cost: current.cost, tree: rootTree, treeEdges };
        }

        const neighbors = bridge.getNeighbors(current.nodeId, netId, targetPinId, current.path[current.path.length - 2]);
        // Reverse for standard exploration order
        for (let i = neighbors.length - 1; i >= 0; i--) {
            const n = neighbors[i];
            if (!visited.has(n.id)) {
                const nCoord = bridge.grid.toCoord(n.id);
                const nTreeNode = createTreeNode(n.id, nCoord, current.treeNode.depth + 1, current.cost + n.cost, 0, current.treeNode, n.dir);
                current.treeNode.children.push(nTreeNode);

                treeEdges.push({ from: current.nodeId, to: n.id, cost: n.cost, dir: n.dir });

                stack.push({
                    nodeId: n.id,
                    treeNode: nTreeNode,
                    path: [...current.path, n.id],
                    cost: current.cost + n.cost
                });
            }
        }

        yield {
            type: 'step',
            currentNode: current.nodeId,
            currentPath: [...current.path],
            treeEdges: [...treeEdges],
            frontier: stack.map(s => s.nodeId),
            visited: Array.from(visited),
            nodesExplored,
            depth: current.treeNode.depth,
            g: current.cost,
            h: 0,
            f: current.cost,
            action: 'expand',
            tree: rootTree
        };
    }

    yield { type: 'finish', success: false, path: [], currentPath: [], treeEdges: [...treeEdges], nodesExplored, cost: 0, tree: rootTree };
    return { success: false, path: [], nodesExplored, cost: 0, tree: rootTree, treeEdges };
}

/**
 * Depth-Limited Search (DLS)
 */
export function* searchDLS(bridge, startNodeId, goalNodeId, netId, targetPinId, limit = 10) {
    treeNodeCounter = 0;
    const startCoord = bridge.grid.toCoord(startNodeId);
    const rootTree = createTreeNode(startNodeId, startCoord, 0, 0, 0, null);
    const treeEdges = [];

    const visitedAtDepth = new Map(); // nodeId -> minDepth visited
    let nodesExplored = 0;

    function* dlsHelper(current) {
        nodesExplored++;
        current.treeNode.status = 'visited';
        visitedAtDepth.set(current.nodeId, current.depth);

        if (current.nodeId === goalNodeId) {
            markSolutionTree(current.treeNode);
            return { found: true, path: current.path, cost: current.cost };
        }

        yield {
            type: 'step',
            currentNode: current.nodeId,
            currentPath: [...current.path],
            treeEdges: [...treeEdges],
            depth: current.depth,
            limit,
            visited: Array.from(visitedAtDepth.keys()),
            nodesExplored,
            g: current.cost,
            h: 0,
            f: current.cost,
            action: current.depth >= limit ? 'prune' : 'expand',
            tree: rootTree
        };

        if (current.depth >= limit) {
            current.treeNode.status = 'pruned';
            return { found: false, cutoff: true };
        }

        let cutoffOccurred = false;
        const neighbors = bridge.getNeighbors(current.nodeId, netId, targetPinId, current.path[current.path.length - 2]);

        for (const n of neighbors) {
            const nextDepth = current.depth + 1;
            if (!visitedAtDepth.has(n.id) || visitedAtDepth.get(n.id) > nextDepth) {
                const nCoord = bridge.grid.toCoord(n.id);
                const nTreeNode = createTreeNode(n.id, nCoord, nextDepth, current.cost + n.cost, 0, current.treeNode, n.dir);
                current.treeNode.children.push(nTreeNode);

                treeEdges.push({ from: current.nodeId, to: n.id, cost: n.cost, dir: n.dir });

                const nextState = {
                    nodeId: n.id,
                    depth: nextDepth,
                    treeNode: nTreeNode,
                    path: [...current.path, n.id],
                    cost: current.cost + n.cost
                };

                const result = yield* dlsHelper(nextState);
                if (result.found) return result;
                if (result.cutoff) cutoffOccurred = true;
            }
        }

        return { found: false, cutoff: cutoffOccurred };
    }

    const startState = {
        nodeId: startNodeId,
        depth: 0,
        treeNode: rootTree,
        path: [startNodeId],
        cost: 0
    };

    const outcome = yield* dlsHelper(startState);
    if (outcome.found) {
        yield { type: 'finish', success: true, path: outcome.path, currentPath: outcome.path, treeEdges: [...treeEdges], cost: outcome.cost, nodesExplored, tree: rootTree };
        return { success: true, path: outcome.path, cost: outcome.cost, nodesExplored, tree: rootTree, treeEdges };
    } else {
        yield { type: 'finish', success: false, path: [], currentPath: [], treeEdges: [...treeEdges], cost: 0, nodesExplored, cutoff: outcome.cutoff, tree: rootTree };
        return { success: false, path: [], cost: 0, nodesExplored, cutoff: outcome.cutoff, tree: rootTree, treeEdges };
    }
}

/**
 * Iterative Deepening Search (IDS)
 */
export function* searchIDS(bridge, startNodeId, goalNodeId, netId, targetPinId, maxDepth = 25) {
    let totalNodesExplored = 0;
    let finalTree = null;
    let lastTreeEdges = [];

    for (let depthLimit = 1; depthLimit <= maxDepth; depthLimit++) {
        yield { type: 'iteration_start', currentLimit: depthLimit };

        const dlsGen = searchDLS(bridge, startNodeId, goalNodeId, netId, targetPinId, depthLimit);
        let result = null;

        while (true) {
            const step = dlsGen.next();
            if (step.done) {
                result = step.value;
                break;
            }
            if (step.value.type === 'step') {
                totalNodesExplored++;
                if (step.value.treeEdges) lastTreeEdges = step.value.treeEdges;
                yield { ...step.value, currentLimit: depthLimit, totalNodesExplored };
            }
            if (step.value.tree) {
                finalTree = step.value.tree;
            }
        }

        if (result && result.success) {
            yield {
                type: 'finish',
                success: true,
                path: result.path,
                currentPath: result.path,
                treeEdges: result.treeEdges || lastTreeEdges,
                cost: result.cost,
                nodesExplored: totalNodesExplored,
                depthLimitReached: depthLimit,
                tree: result.tree || finalTree
            };
            return {
                success: true,
                path: result.path,
                cost: result.cost,
                nodesExplored: totalNodesExplored,
                tree: result.tree || finalTree,
                treeEdges: result.treeEdges || lastTreeEdges
            };
        }
    }

    yield { type: 'finish', success: false, path: [], currentPath: [], treeEdges: lastTreeEdges, nodesExplored: totalNodesExplored, tree: finalTree };
    return { success: false, path: [], nodesExplored: totalNodesExplored, tree: finalTree, treeEdges: lastTreeEdges };
}

/**
 * Uniform Cost Search (UCS)
 */
export function* searchUCS(bridge, startNodeId, goalNodeId, netId, targetPinId) {
    treeNodeCounter = 0;
    const startCoord = bridge.grid.toCoord(startNodeId);
    const rootTree = createTreeNode(startNodeId, startCoord, 0, 0, 0, null);
    const treeEdges = [];

    const pq = new MinPriorityQueue();
    pq.push({ nodeId: startNodeId, treeNode: rootTree, path: [startNodeId], cost: 0 }, 0);

    const bestCost = new Map();
    bestCost.set(startNodeId, 0);
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
                currentCost: current.cost,
                g: current.cost,
                h: 0,
                f: current.cost,
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
            const nextCost = current.cost + n.cost;
            if (!bestCost.has(n.id) || nextCost < bestCost.get(n.id)) {
                bestCost.set(n.id, nextCost);
                const nCoord = bridge.grid.toCoord(n.id);
                const nTreeNode = createTreeNode(n.id, nCoord, current.treeNode.depth + 1, nextCost, 0, current.treeNode, n.dir);
                current.treeNode.children.push(nTreeNode);

                treeEdges.push({ from: current.nodeId, to: n.id, cost: n.cost, dir: n.dir });

                pq.push({
                    nodeId: n.id,
                    treeNode: nTreeNode,
                    path: [...current.path, n.id],
                    cost: nextCost
                }, nextCost);
            }
        }

        yield {
            type: 'step',
            currentNode: current.nodeId,
            currentPath: [...current.path],
            treeEdges: [...treeEdges],
            currentCost: current.cost,
            g: current.cost,
            h: 0,
            f: current.cost,
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
