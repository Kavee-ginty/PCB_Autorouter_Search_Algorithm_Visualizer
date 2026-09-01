/**
 * treeModal.js - Dual-Pane State-Space Tree & Grid Search Graph Visualizer
 * Concurrently renders the hierarchical search tree (left) and the 2D PCB Grid Search Graph (right).
 */

export class StateSpaceTreeModal {
    constructor(app = null) {
        this.app = app;
        this.modalElement = document.getElementById('tree-modal');
        this.modalBody = document.getElementById('tree-modal-body');
        this.treeContainer = document.getElementById('tree-svg-container');
        this.graphContainer = document.getElementById('graph-svg-container');
        this.titleElement = document.getElementById('tree-modal-title');
        this.statsElement = document.getElementById('tree-modal-stats');
        this.closeButton = document.getElementById('tree-modal-close');

        // View Mode Switcher buttons
        this.btnModeSplit = document.getElementById('view-mode-split');
        this.btnModeTree = document.getElementById('view-mode-tree');
        this.btnModeGraph = document.getElementById('view-mode-graph');

        // Auto-Fit buttons & badges
        this.btnFitTree = document.getElementById('tree-fit-btn');
        this.btnFitGraph = document.getElementById('graph-fit-btn');
        this.treeNodesBadge = document.getElementById('tree-nodes-badge');
        this.graphVisitedBadge = document.getElementById('graph-visited-badge');
        this.btnExportTriplePng = document.getElementById('tree-export-png-btn');

        this.currentTree = null;
        this.currentPin = null;
        this.currentNet = null;
        this.currentAlgorithm = 'Search';

        this.viewMode = 'split'; // 'split' | 'tree' | 'graph'

        // Tree Pan/Zoom State
        this.treeZoom = 1.0;
        this.treePan = { x: 0, y: 0 };
        this.isTreePanning = false;
        this.startTreePan = { x: 0, y: 0 };
        this.treeBounds = null;

        // Graph Pan/Zoom State
        this.graphZoom = 1.0;
        this.graphPan = { x: 0, y: 0 };
        this.isGraphPanning = false;
        this.startGraphPan = { x: 0, y: 0 };
        this.graphBounds = null;

        this._bindEvents();
    }

    _getPinName(pinId, fallbackPin = null) {
        if (this.app?.controls?.getFriendlyPinName) {
            const friendly = this.app.controls.getFriendlyPinName(pinId);
            if (friendly) return friendly;
        }
        const friendlyMap = {
            'B+': 'Battery +',
            'B-': 'Battery -',
            'S1-A': 'Switch +',
            'S1-B': 'Switch -',
            'S-A': 'Switch +',
            'S-B': 'Switch -',
            'L-in': 'Sensor +',
            'L-out': 'Sensor -',
            'R-in': 'Resistor 1',
            'R-out': 'Resistor 2',
            'D-A': 'LED +',
            'D-K': 'LED -'
        };
        return friendlyMap[pinId] || fallbackPin?.label || fallbackPin?.id || pinId || 'Pin';
    }

    _bindEvents() {
        if (this.closeButton) {
            this.closeButton.addEventListener('click', () => this.hide());
        }

        // Close on ESC
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen()) {
                this.hide();
            }
        });

        // Close on backdrop click
        if (this.modalElement) {
            this.modalElement.addEventListener('click', (e) => {
                if (e.target === this.modalElement) {
                    this.hide();
                }
            });
        }

        // View Mode Switcher
        if (this.btnModeSplit) {
            this.btnModeSplit.addEventListener('click', () => this.setViewMode('split'));
        }
        if (this.btnModeTree) {
            this.btnModeTree.addEventListener('click', () => this.setViewMode('tree'));
        }
        if (this.btnModeGraph) {
            this.btnModeGraph.addEventListener('click', () => this.setViewMode('graph'));
        }

        // Auto-Fit & Export buttons
        if (this.btnFitTree) {
            this.btnFitTree.addEventListener('click', () => this.autoFitTree());
        }
        if (this.btnFitGraph) {
            this.btnFitGraph.addEventListener('click', () => this.autoFitGraph());
        }
        if (this.btnExportTriplePng) {
            this.btnExportTriplePng.addEventListener('click', () => this.exportTripleViewPng());
        }

        // --- TREE CONTAINER INTERACTION ---
        if (this.treeContainer) {
            this.treeContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = this.treeContainer.getBoundingClientRect();
                const cursorX = e.clientX - rect.left;
                const cursorY = e.clientY - rect.top;

                const worldX = (cursorX - this.treePan.x) / this.treeZoom;
                const worldY = (cursorY - this.treePan.y) / this.treeZoom;

                const zoomFactor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
                const newZoom = Math.max(0.12, Math.min(4.0, this.treeZoom * zoomFactor));

                if (newZoom !== this.treeZoom) {
                    this.treeZoom = newZoom;
                    this.treePan.x = cursorX - worldX * this.treeZoom;
                    this.treePan.y = cursorY - worldY * this.treeZoom;
                    this._applyTreeTransform();
                }
            }, { passive: false });

            this.treeContainer.addEventListener('mousedown', (e) => {
                if (e.button === 0) {
                    this.isTreePanning = true;
                    this.startTreePan = { x: e.clientX - this.treePan.x, y: e.clientY - this.treePan.y };
                }
            });

            this.treeContainer.addEventListener('dblclick', () => this.autoFitTree());
        }

        // --- GRAPH CONTAINER INTERACTION ---
        if (this.graphContainer) {
            this.graphContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = this.graphContainer.getBoundingClientRect();
                const cursorX = e.clientX - rect.left;
                const cursorY = e.clientY - rect.top;

                const worldX = (cursorX - this.graphPan.x) / this.graphZoom;
                const worldY = (cursorY - this.graphPan.y) / this.graphZoom;

                const zoomFactor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
                const newZoom = Math.max(0.15, Math.min(4.0, this.graphZoom * zoomFactor));

                if (newZoom !== this.graphZoom) {
                    this.graphZoom = newZoom;
                    this.graphPan.x = cursorX - worldX * this.graphZoom;
                    this.graphPan.y = cursorY - worldY * this.graphZoom;
                    this._applyGraphTransform();
                }
            }, { passive: false });

            this.graphContainer.addEventListener('mousedown', (e) => {
                if (e.button === 0) {
                    this.isGraphPanning = true;
                    this.startGraphPan = { x: e.clientX - this.graphPan.x, y: e.clientY - this.graphPan.y };
                }
            });

            this.graphContainer.addEventListener('dblclick', () => this.autoFitGraph());
        }

        // Global Mouse Move & Up for Panning
        window.addEventListener('mousemove', (e) => {
            if (this.isTreePanning) {
                this.treePan = {
                    x: e.clientX - this.startTreePan.x,
                    y: e.clientY - this.startTreePan.y
                };
                this._applyTreeTransform();
            }
            if (this.isGraphPanning) {
                this.graphPan = {
                    x: e.clientX - this.startGraphPan.x,
                    y: e.clientY - this.startGraphPan.y
                };
                this._applyGraphTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            this.isTreePanning = false;
            this.isGraphPanning = false;
        });
    }

    setViewMode(mode) {
        this.viewMode = mode;
        if (!this.modalBody) return;

        this.modalBody.classList.remove('mode-split', 'mode-tree', 'mode-graph');
        this.btnModeSplit?.classList.remove('active');
        this.btnModeTree?.classList.remove('active');
        this.btnModeGraph?.classList.remove('active');

        if (mode === 'tree') {
            this.modalBody.classList.add('mode-tree');
            this.btnModeTree?.classList.add('active');
            setTimeout(() => this.autoFitTree(), 40);
        } else if (mode === 'graph') {
            this.modalBody.classList.add('mode-graph');
            this.btnModeGraph?.classList.add('active');
            setTimeout(() => this.autoFitGraph(), 40);
        } else {
            this.modalBody.classList.add('mode-split');
            this.btnModeSplit?.classList.add('active');
            setTimeout(() => {
                this.autoFitTree();
                this.autoFitGraph();
            }, 40);
        }
    }

    _applyTreeTransform() {
        const svgGroup = document.getElementById('tree-viewport-group');
        if (svgGroup) {
            svgGroup.setAttribute('transform', `translate(${this.treePan.x}, ${this.treePan.y}) scale(${this.treeZoom})`);
        }
    }

    _applyGraphTransform() {
        const svgGroup = document.getElementById('graph-viewport-group');
        if (svgGroup) {
            svgGroup.setAttribute('transform', `translate(${this.graphPan.x}, ${this.graphPan.y}) scale(${this.graphZoom})`);
        }
    }

    autoFitTree() {
        if (!this.treeBounds || !this.treeContainer) return;
        const rect = this.treeContainer.getBoundingClientRect();
        const cWidth = rect.width || (window.innerWidth * 0.45);
        const cHeight = rect.height || (window.innerHeight * 0.75);

        const treeW = Math.max(100, this.treeBounds.width);
        const treeH = Math.max(100, this.treeBounds.height);

        const scaleX = (cWidth - 40) / treeW;
        const scaleY = (cHeight - 60) / treeH;
        const fitScale = Math.max(0.15, Math.min(1.1, Math.min(scaleX, scaleY)));

        this.treeZoom = fitScale;
        this.treePan.x = (cWidth / 2) - (this.treeBounds.centerX * this.treeZoom);
        this.treePan.y = 35;
        this._applyTreeTransform();
    }

    autoFitGraph() {
        if (!this.graphBounds || !this.graphContainer) return;
        const rect = this.graphContainer.getBoundingClientRect();
        const cWidth = rect.width || (window.innerWidth * 0.45);
        const cHeight = rect.height || (window.innerHeight * 0.75);

        const graphW = Math.max(100, this.graphBounds.width);
        const graphH = Math.max(100, this.graphBounds.height);

        const scaleX = (cWidth - 40) / graphW;
        const scaleY = (cHeight - 60) / graphH;
        const fitScale = Math.max(0.2, Math.min(1.2, Math.min(scaleX, scaleY)));

        this.graphZoom = fitScale;
        this.graphPan.x = (cWidth / 2) - (this.graphBounds.centerX * this.graphZoom);
        this.graphPan.y = (cHeight / 2) - (this.graphBounds.centerY * this.graphZoom);
        this._applyGraphTransform();
    }

    show(pin, net, treeData, algorithmName = 'Search') {
        if (!treeData) {
            alert(`No state-space search tree data found for pin ${pin.label || pin.id}. Please run routing first!`);
            return;
        }

        this.currentPin = pin;
        this.currentNet = net;
        this.currentTree = treeData;
        this.currentAlgorithm = algorithmName;

        let titleText = 'State-Space Exploration';
        if (net && net.source && net.target) {
            const srcName = this._getPinName(net.source, pin);
            const tgtName = this._getPinName(net.target);
            titleText = `${srcName} → ${tgtName} (${algorithmName})`;
        } else if (pin) {
            titleText = `${this._getPinName(pin.id, pin)} (${algorithmName})`;
        }

        this.titleElement.innerHTML = `<i data-lucide="git-commit"></i> ${titleText}`;

        this.modalElement.classList.remove('hidden');
        this.modalElement.classList.add('visible');

        // Render both Tree and Graph
        this._renderTree(treeData);
        this._renderGraph(treeData);

        if (window.lucide) {
            lucide.createIcons();
        }

        // Set default view mode to Split and auto-fit both panes
        this.setViewMode(this.viewMode || 'split');
    }

    hide() {
        if (this.modalElement) {
            this.modalElement.classList.remove('visible');
            this.modalElement.classList.add('hidden');
        }
    }

    isOpen() {
        return this.modalElement && this.modalElement.classList.contains('visible');
    }

    _renderTree(rootNode) {
        if (!this.treeContainer) return;

        // Compute tree layout coordinates (Reingold-Tilford compact layout)
        const nodeRadius = 24;
        const hGap = 18;
        const vGap = 70;

        let nextX = 0;
        const layoutNodes = [];
        const layoutEdges = [];

        function layoutSubtree(node, depth = 0) {
            node._depth = depth;

            if (!node.children || node.children.length === 0) {
                node._x = nextX + nodeRadius;
                nextX += (nodeRadius * 2) + hGap;
            } else {
                for (const child of node.children) {
                    layoutSubtree(child, depth + 1);
                }
                const firstChild = node.children[0];
                const lastChild = node.children[node.children.length - 1];
                node._x = (firstChild._x + lastChild._x) / 2;
            }
            node._y = depth * (nodeRadius * 2 + vGap) + 60;

            layoutNodes.push(node);
            if (node.children) {
                for (const child of node.children) {
                    layoutEdges.push({ from: node, to: child });
                }
            }
        }

        layoutSubtree(rootNode, 0);

        // Calculate bounding box and center for auto-fit
        let minX = Infinity, maxX = 0;
        let minY = Infinity, maxY = 0;
        for (const n of layoutNodes) {
            if (n._x < minX) minX = n._x;
            if (n._x > maxX) maxX = n._x;
            if (n._y < minY) minY = n._y;
            if (n._y > maxY) maxY = n._y;
        }

        this.treeBounds = {
            minX,
            maxX,
            minY,
            maxY,
            width: (maxX - minX) + nodeRadius * 2 + 80,
            height: (maxY - minY) + nodeRadius * 2 + 80,
            centerX: (minX + maxX) / 2
        };

        const totalWidth = Math.max(1600, maxX + nodeRadius * 2 + 300);
        const totalHeight = Math.max(1200, maxY + nodeRadius * 2 + 300);

        // Build SVG Elements
        let svgContent = `
        <svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <marker id="tree-arrow-sol" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#10b981" />
                </marker>
                <marker id="tree-arrow-exp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 2 L 10 5 L 0 8 z" fill="#94a3b8" />
                </marker>
            </defs>

            <g id="tree-viewport-group">
                <!-- Directed Edges with Offset Cost Text (No Boxes) -->
                <g class="tree-edges">
        `;

        for (const edge of layoutEdges) {
            const x1 = edge.from._x;
            const y1 = edge.from._y;
            const x2 = edge.to._x;
            const y2 = edge.to._y;

            const angle = Math.atan2(y2 - y1, x2 - x1);
            const startX = x1 + nodeRadius * Math.cos(angle);
            const startY = y1 + nodeRadius * Math.sin(angle);
            const endX = x2 - nodeRadius * Math.cos(angle);
            const endY = y2 - nodeRadius * Math.sin(angle);

            const isSolution = edge.to.status === 'solution' && edge.from.status === 'solution';
            const strokeColor = isSolution ? '#10b981' : '#94a3b8';
            const strokeWidth = isSolution ? 3.0 : 1.8;
            const markerId = isSolution ? 'url(#tree-arrow-sol)' : 'url(#tree-arrow-exp)';

            const rawCost = Math.abs((edge.to.g || 0) - (edge.from.g || 0));
            let costText = '1';
            if (rawCost > 0) {
                const gridSteps = rawCost / 5;
                costText = Number.isInteger(gridSteps) ? gridSteps.toString() : gridSteps.toFixed(1);
            }

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            // Offset cost near the arrow without overlapping and without a box
            const offsetDist = 11;
            let normX = -Math.sin(angle);
            let normY = Math.cos(angle);
            if (normX < 0) {
                normX = -normX;
                normY = -normY;
            }
            const labelX = midX + normX * offsetDist;
            const labelY = midY + normY * offsetDist;
            const textColor = isSolution ? '#059669' : '#64748b';

            svgContent += `
                <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" 
                      stroke="${strokeColor}" stroke-width="${strokeWidth}" marker-end="${markerId}" />
                <text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central"
                      font-size="9.5px" font-weight="700" fill="${textColor}" font-family="monospace">
                    ${costText}
                </text>
            `;
        }

        svgContent += `</g><g class="tree-nodes">`;

        // Circular Tree Nodes
        for (const n of layoutNodes) {
            const isRoot = (n._depth === 0);
            const isGoal = (n.status === 'solution' && (!n.children || n.children.length === 0));
            const isSolution = (n.status === 'solution');
            const isFrontier = (n.status === 'frontier');

            let fill = '#ffffff';
            let stroke = '#1e293b';
            let strokeWidth = 2.0;
            let titleColor = '#0f172a';
            let subColor = '#64748b';

            if (isRoot) {
                fill = '#ef4444'; // Red root
                stroke = '#1e293b';
                strokeWidth = 2.5;
                titleColor = '#ffffff';
                subColor = '#fee2e2';
            } else if (isGoal) {
                fill = '#10b981'; // Green goal
                stroke = '#1e293b';
                strokeWidth = 2.5;
                titleColor = '#ffffff';
                subColor = '#d1fae5';
            } else if (isFrontier) {
                fill = '#8b5cf6'; // Purple frontier
                stroke = '#1e293b';
                strokeWidth = 2.2;
                titleColor = '#ffffff';
                subColor = '#ede9fe';
            } else if (isSolution) {
                fill = '#ffffff'; // Solution path
                stroke = '#10b981';
                strokeWidth = 3.0;
                titleColor = '#0f172a';
                subColor = '#059669';
            } else {
                fill = '#ffffff'; // Explored
                stroke = '#1e293b';
                strokeWidth = 1.8;
                titleColor = '#0f172a';
                subColor = '#64748b';
            }

            let subText = `h=${Math.round((n.h || 0) * 10) / 10}`;
            if (isGoal) {
                subText = (n.h !== undefined && n.h > 0) ? `h=${Math.round(n.h * 10) / 10}` : 'Goal';
            }

            svgContent += `
                <g class="tree-node" transform="translate(${n._x}, ${n._y})">
                    <circle cx="0" cy="0" r="${nodeRadius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
                    <text x="0" y="-4" text-anchor="middle" fill="${titleColor}" font-size="10px" font-weight="bold" font-family="monospace">
                        ${n.name}
                    </text>
                    <text x="0" y="10" text-anchor="middle" fill="${subColor}" font-size="8.5px" font-weight="bold" font-family="sans-serif">
                        ${subText}
                    </text>
                </g>
            `;
        }

        svgContent += `</g></g></svg>`;

        this.treeContainer.innerHTML = svgContent;

        // Update tree badge & stats
        if (this.treeNodesBadge) {
            this.treeNodesBadge.textContent = `${layoutNodes.length} Nodes`;
        }

        const solutionNodes = layoutNodes.filter(n => n.status === 'solution').length;
        if (this.statsElement) {
            this.statsElement.innerHTML = `
                <span>Tree Nodes: <strong>${layoutNodes.length}</strong></span> • 
                <span>Max Depth: <strong>${Math.round(maxY / (nodeRadius * 2 + vGap))}</strong></span> • 
                <span style="color: #10b981;">Solution Path: <strong>${solutionNodes} steps</strong></span>
            `;
        }
    }

    _renderGraph(rootNode) {
        if (!this.graphContainer) return;

        const cols = 10;
        const rows = 8;
        const pitchX = 74;
        const pitchY = 74;
        const originX = 52;
        const originY = 52;
        const nodeRadius = 24; // Identical radius to tree nodes

        // Traverse rootNode to extract graph data
        const visitedMap = new Map();   // nodeId -> treeNode
        const frontierMap = new Map();  // nodeId -> treeNode
        const solutionMap = new Map();  // nodeId -> treeNode
        const graphEdges = [];
        let startCoord = { x: rootNode.x, y: rootNode.y, id: rootNode.nodeId, node: rootNode };
        let goalCoord = null;

        function traverse(node) {
            if (!node) return;
            if (node.status === 'visited' || node.status === 'solution') {
                visitedMap.set(node.nodeId, node);
            } else if (node.status === 'frontier') {
                frontierMap.set(node.nodeId, node);
            }

            if (node.status === 'solution') {
                solutionMap.set(node.nodeId, node);
                if (!node.children || node.children.length === 0) {
                    goalCoord = { x: node.x, y: node.y, id: node.nodeId, node };
                }
            }

            if (node.children) {
                for (const child of node.children) {
                    const isSol = (node.status === 'solution' && child.status === 'solution');
                    graphEdges.push({
                        from: { x: node.x, y: node.y, id: node.nodeId, g: node.g || 0 },
                        to: { x: child.x, y: child.y, id: child.nodeId, g: child.g || 0 },
                        isSolution: isSol
                    });
                    traverse(child);
                }
            }
        }

        traverse(rootNode);

        // Fallback for goalCoord from net target pin
        if (!goalCoord && this.currentNet && this.app?.grid) {
            for (const comp of (this.app.components || [])) {
                for (const pin of comp.getPins()) {
                    if (pin.id === this.currentNet.target) {
                        goalCoord = { x: pin.x, y: pin.y, id: this.app.grid.toId(pin.x, pin.y), node: null };
                    }
                }
            }
        }

        const boardWidth = (cols - 1) * pitchX + originX * 2;
        const boardHeight = (rows - 1) * pitchY + originY * 2;

        this.graphBounds = {
            width: boardWidth,
            height: boardHeight,
            centerX: boardWidth / 2,
            centerY: boardHeight / 2
        };

        const toPx = (gx, gy) => ({
            x: originX + gx * pitchX,
            y: originY + gy * pitchY
        });

        let svg = `
        <svg width="${boardWidth + 120}" height="${boardHeight + 120}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <marker id="graph-arrow-sol" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 10 5 L 0 8.5 z" fill="#10b981" />
                </marker>
                <marker id="graph-arrow-exp" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 2 L 10 5 L 0 8 z" fill="#94a3b8" />
                </marker>
            </defs>

            <g id="graph-viewport-group">
                <!-- Axis Labels (X: 0..9, Y: 0..7) -->
                <g class="graph-axis-labels">
        `;

        for (let x = 0; x < cols; x++) {
            const p = toPx(x, 0);
            svg += `
                <text x="${p.x}" y="20" text-anchor="middle" font-size="11px" font-family="monospace" font-weight="bold" fill="#64748b">
                    X=${x}
                </text>
            `;
        }
        for (let y = 0; y < rows; y++) {
            const p = toPx(0, y);
            svg += `
                <text x="16" y="${p.y + 4}" text-anchor="middle" font-size="11px" font-family="monospace" font-weight="bold" fill="#64748b">
                    Y=${y}
                </text>
            `;
        }

        svg += `</g><!-- Component Bodies / Obstacles -->\n<g class="graph-components">`;

        if (this.app?.components) {
            for (const comp of this.app.components) {
                const dims = comp.getDimensions();
                const pTopLeft = toPx(comp.x, comp.y);
                const w = (dims.w - 1) * pitchX + nodeRadius * 2 + 16;
                const h = (dims.h - 1) * pitchY + nodeRadius * 2 + 16;
                const compX = pTopLeft.x - nodeRadius - 8;
                const compY = pTopLeft.y - nodeRadius - 8;

                svg += `
                    <rect x="${compX}" y="${compY}" width="${w}" height="${h}" rx="8"
                          fill="rgba(241, 245, 249, 0.75)" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4,3" />
                    <text x="${compX + w / 2}" y="${compY + 12}" text-anchor="middle" font-size="9px" font-family="sans-serif" font-weight="bold" fill="#64748b">
                        ${comp.type.toUpperCase()}
                    </text>
                `;
            }
        }

        svg += `</g><!-- Directed Search Arrows between Circles -->\n<g class="graph-search-edges">`;

        // 1. Exploration directed arrows (non-solution)
        for (const edge of graphEdges) {
            if (edge.isSolution) continue;
            const p1 = toPx(edge.from.x, edge.from.y);
            const p2 = toPx(edge.to.x, edge.to.y);

            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const startX = p1.x + nodeRadius * Math.cos(angle);
            const startY = p1.y + nodeRadius * Math.sin(angle);
            const endX = p2.x - nodeRadius * Math.cos(angle);
            const endY = p2.y - nodeRadius * Math.sin(angle);

            const rawCost = Math.abs((edge.to.g || 0) - (edge.from.g || 0));
            let costText = '1';
            if (rawCost > 0) {
                const gridSteps = rawCost / 5;
                costText = Number.isInteger(gridSteps) ? gridSteps.toString() : gridSteps.toFixed(1);
            }
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            // Offset cost near arrow without overlapping and without a box
            const offsetDist = 11;
            let normX = -Math.sin(angle);
            let normY = Math.cos(angle);
            if (normX < 0) {
                normX = -normX;
                normY = -normY;
            }
            const labelX = midX + normX * offsetDist;
            const labelY = midY + normY * offsetDist;

            svg += `
                <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}"
                      stroke="#94a3b8" stroke-width="1.8" marker-end="url(#graph-arrow-exp)" />
                <text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central"
                      font-size="9.5px" font-weight="700" fill="#64748b" font-family="monospace">
                    ${costText}
                </text>
            `;
        }

        // 2. Solution path directed arrows
        for (const edge of graphEdges) {
            if (!edge.isSolution) continue;
            const p1 = toPx(edge.from.x, edge.from.y);
            const p2 = toPx(edge.to.x, edge.to.y);

            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const startX = p1.x + nodeRadius * Math.cos(angle);
            const startY = p1.y + nodeRadius * Math.sin(angle);
            const endX = p2.x - nodeRadius * Math.cos(angle);
            const endY = p2.y - nodeRadius * Math.sin(angle);

            const rawCost = Math.abs((edge.to.g || 0) - (edge.from.g || 0));
            let costText = '1';
            if (rawCost > 0) {
                const gridSteps = rawCost / 5;
                costText = Number.isInteger(gridSteps) ? gridSteps.toString() : gridSteps.toFixed(1);
            }
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;

            const offsetDist = 11;
            let normX = -Math.sin(angle);
            let normY = Math.cos(angle);
            if (normX < 0) {
                normX = -normX;
                normY = -normY;
            }
            const labelX = midX + normX * offsetDist;
            const labelY = midY + normY * offsetDist;

            svg += `
                <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}"
                      stroke="#10b981" stroke-width="3.0" marker-end="url(#graph-arrow-sol)" />
                <text x="${labelX}" y="${labelY}" text-anchor="middle" dominant-baseline="central"
                      font-size="9.5px" font-weight="700" fill="#059669" font-family="monospace">
                    ${costText}
                </text>
            `;
        }

        svg += `</g><!-- Circular Grid Nodes (Exact Styling as Tree) -->\n<g class="graph-nodes">`;

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const p = toPx(x, y);
                const nodeId = y * cols + x;

                const isStart = (startCoord && startCoord.x === x && startCoord.y === y);
                const isGoal = (goalCoord && goalCoord.x === x && goalCoord.y === y);
                const isSolution = solutionMap.has(nodeId);
                const isFrontier = frontierMap.has(nodeId);
                const isVisited = visitedMap.has(nodeId);

                const activeNode = visitedMap.get(nodeId) || frontierMap.get(nodeId) || solutionMap.get(nodeId) || (isStart ? startCoord.node : null);

                let fill = '#ffffff';
                let stroke = '#cbd5e1';
                let strokeWidth = 1.2;
                let titleColor = '#94a3b8';
                let subColor = '#cbd5e1';
                let subText = '';

                if (isStart) {
                    fill = '#ef4444'; // Red start circle
                    stroke = '#1e293b';
                    strokeWidth = 2.5;
                    titleColor = '#ffffff';
                    subColor = '#fee2e2';
                    subText = (activeNode && activeNode.h !== undefined) ? `h=${Math.round(activeNode.h * 10) / 10}` : 'Start';
                } else if (isGoal) {
                    fill = '#10b981'; // Green goal circle
                    stroke = '#1e293b';
                    strokeWidth = 2.5;
                    titleColor = '#ffffff';
                    subColor = '#d1fae5';
                    subText = (activeNode && activeNode.h !== undefined && activeNode.h > 0) ? `h=${Math.round(activeNode.h * 10) / 10}` : 'Goal';
                } else if (isFrontier) {
                    fill = '#8b5cf6'; // Purple frontier circle
                    stroke = '#1e293b';
                    strokeWidth = 2.2;
                    titleColor = '#ffffff';
                    subColor = '#ede9fe';
                    subText = (activeNode && activeNode.h !== undefined) ? `h=${Math.round(activeNode.h * 10) / 10}` : '';
                } else if (isSolution) {
                    fill = '#ffffff'; // Solution path circle
                    stroke = '#10b981';
                    strokeWidth = 3.0;
                    titleColor = '#0f172a';
                    subColor = '#059669';
                    subText = (activeNode && activeNode.h !== undefined) ? `h=${Math.round(activeNode.h * 10) / 10}` : '';
                } else if (isVisited) {
                    fill = '#ffffff'; // Explored circle
                    stroke = '#1e293b';
                    strokeWidth = 1.8;
                    titleColor = '#0f172a';
                    subColor = '#64748b';
                    subText = (activeNode && activeNode.h !== undefined) ? `h=${Math.round(activeNode.h * 10) / 10}` : '';
                } else {
                    // Check if occupied by component obstacle
                    const occupant = this.app?.grid?.occupants ? this.app.grid.occupants[nodeId] : null;
                    if (occupant && occupant.type === 'body') {
                        fill = '#f1f5f9';
                        stroke = '#cbd5e1';
                        strokeWidth = 1.2;
                        titleColor = '#94a3b8';
                        subColor = '#94a3b8';
                        subText = '';
                    }
                }

                svg += `
                    <g class="graph-node-group" transform="translate(${p.x}, ${p.y})">
                        <circle cx="0" cy="0" r="${nodeRadius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" />
                        <text x="0" y="${subText ? -4 : 3.5}" text-anchor="middle" fill="${titleColor}" font-size="10px" font-weight="bold" font-family="monospace">
                            (${x},${y})
                        </text>
                        ${subText ? `
                        <text x="0" y="10" text-anchor="middle" fill="${subColor}" font-size="8.5px" font-weight="bold" font-family="sans-serif">
                            ${subText}
                        </text>` : ''}
                    </g>
                `;
            }
        }

        svg += `</g></g></svg>`;

        this.graphContainer.innerHTML = svg;

        if (this.graphVisitedBadge) {
            this.graphVisitedBadge.textContent = `${visitedMap.size} Explored Cells`;
        }
    }

    async exportTripleViewPng() {
        if (!this.currentTree) {
            alert('No search exploration data available to export.');
            return;
        }

        // 8K Super-Resolution Master Dimensions for maximum readability and extreme zoom clarity
        const panelW = 2400;
        const panelH = 1900;
        const pad = 64;
        const headerH = 230;
        const footerH = 90;
        const totalW = pad * 4 + panelW * 3; // 7456 px
        const totalH = headerH + panelH + footerH + pad; // 2284 px

        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = totalW;
        exportCanvas.height = totalH;
        const ctx = exportCanvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 1. Studio clean light background
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(0, 0, totalW, totalH);

        // 2. Header Title & Subtitle
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 52px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('PCB Single-Layer Autorouting AI Search Exploration', pad, 78);

        const netName = this.currentNet ? (this.currentNet.name || `Net ${this.currentNet.id}`) : 'Selected Net';
        const srcName = this.currentNet?.source ? this._getPinName(this.currentNet.source) : '';
        const tgtName = this.currentNet?.target ? this._getPinName(this.currentNet.target) : '';
        const algoName = this.currentAlgorithm || 'Search Algorithm';

        ctx.fillStyle = '#475569';
        ctx.font = '500 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`Net: ${netName} (${srcName} → ${tgtName})   •   Algorithm: ${algoName}`, pad, 134);

        // Stats string
        const statsText = this.statsElement?.textContent?.trim() || '';
        if (statsText) {
            ctx.fillStyle = '#2563eb';
            ctx.font = 'bold 24px "SF Mono", Monaco, Consolas, monospace';
            ctx.fillText(statsText.replace(/\s+/g, ' '), pad, 184);
        }

        // Panel X coordinates
        const p1X = pad;
        const p2X = pad * 2 + panelW;
        const p3X = pad * 3 + panelW * 2;
        const panelY = headerH + pad;

        // Card Frame drawer
        const drawCardFrame = (x, y, w, h, title, badgeText = '') => {
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
            ctx.shadowBlur = 24;
            ctx.shadowOffsetY = 8;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, 20);
            ctx.fill();
            ctx.shadowColor = 'transparent';

            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Card Header
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.roundRect(x, y, w, 76, [20, 20, 0, 0]);
            ctx.fill();
            ctx.strokeStyle = '#e2e8f0';
            ctx.beginPath();
            ctx.moveTo(x, y + 76);
            ctx.lineTo(x + w, y + 76);
            ctx.stroke();

            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(title, x + 30, y + 48);

            if (badgeText) {
                ctx.font = 'bold 20px "SF Mono", Monaco, Consolas, monospace';
                const bW = ctx.measureText(badgeText).width + 30;
                ctx.fillStyle = '#eff6ff';
                ctx.beginPath();
                ctx.roundRect(x + w - bW - 24, y + 16, bW, 44, 10);
                ctx.fill();
                ctx.strokeStyle = '#bfdbfe';
                ctx.lineWidth = 2.0;
                ctx.stroke();
                ctx.fillStyle = '#2563eb';
                ctx.fillText(badgeText, x + w - bW - 9, y + 45);
            }
            ctx.restore();
        };

        drawCardFrame(p1X, panelY, panelW, panelH, '1. Routed PCB Layout', 'Physical Board');
        drawCardFrame(p2X, panelY, panelW, panelH, '2. State-Space Search Tree', 'Search Tree');
        drawCardFrame(p3X, panelY, panelW, panelH, '3. PCB Grid Search Graph', '2D Search Graph');

        const cardInnerW = panelW - 64;
        const cardInnerH = panelH - 110;

        // Panel 1: PCB Canvas Drawing
        if (this.app?.canvas?.canvas) {
            const pcbCanvas = this.app.canvas.canvas;
            const scale = Math.min(cardInnerW / pcbCanvas.width, cardInnerH / pcbCanvas.height);
            const drawW = pcbCanvas.width * scale;
            const drawH = pcbCanvas.height * scale;
            const drawX = p1X + 32 + (cardInnerW - drawW) / 2;
            const drawY = panelY + 90 + (cardInnerH - drawH) / 2;
            ctx.drawImage(pcbCanvas, drawX, drawY, drawW, drawH);
        }

        // Panel 2: Tree SVG Image (Super-Resolution Vector Rasterization)
        const treeSvg = this.treeContainer?.querySelector('svg');
        if (treeSvg && this.treeBounds) {
            const treeImg = await this._rasterizeSvgToImage(treeSvg, this.treeBounds, cardInnerW, cardInnerH, true);
            if (treeImg) {
                const scale = Math.min(cardInnerW / treeImg.width, cardInnerH / treeImg.height);
                const drawW = treeImg.width * scale;
                const drawH = treeImg.height * scale;
                const drawX = p2X + 32 + (cardInnerW - drawW) / 2;
                const drawY = panelY + 90 + (cardInnerH - drawH) / 2;
                ctx.drawImage(treeImg, drawX, drawY, drawW, drawH);
            }
        }

        // Panel 3: Graph SVG Image (Super-Resolution Vector Rasterization)
        const graphSvg = this.graphContainer?.querySelector('svg');
        if (graphSvg && this.graphBounds) {
            const graphImg = await this._rasterizeSvgToImage(graphSvg, this.graphBounds, cardInnerW, cardInnerH, false);
            if (graphImg) {
                const scale = Math.min(cardInnerW / graphImg.width, cardInnerH / graphImg.height);
                const drawW = graphImg.width * scale;
                const drawH = graphImg.height * scale;
                const drawX = p3X + 32 + (cardInnerW - drawW) / 2;
                const drawY = panelY + 90 + (cardInnerH - drawH) / 2;
                ctx.drawImage(graphImg, drawX, drawY, drawW, drawH);
            }
        }

        // Legend Bar at Bottom
        const footerY = panelY + panelH + 24;
        ctx.fillStyle = '#64748b';
        ctx.font = '500 23px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Legend:   🔴 Start Node / Pin    🟢 Goal Node & Solution Path    🟣 Frontier Node    ⚪ Visited / Explored Node    🔲 Keep-Out Obstacle', pad, footerY + 36);

        // Trigger file download formatted as: [AlgorithmName]_[NetName].png
        const cleanAlgo = (algoName || 'Algorithm')
            .replace(/\*/g, 'Star')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');

        const cleanNet = (netName || 'Net')
            .replace(/\+/g, 'Plus')
            .replace(/>/g, '')
            .replace(/[^a-zA-Z0-9_-]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');

        const filename = `${cleanAlgo}_${cleanNet}.png`;

        exportCanvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }

    _rasterizeSvgToImage(svgElement, bounds, targetWidth, targetHeight, isTree = true) {
        return new Promise((resolve) => {
            try {
                const clone = svgElement.cloneNode(true);

                // High-DPI rasterization resolution: render at 4000+ px for extreme vector crispness
                const highResW = Math.max(targetWidth * 2, bounds.width * 2, 4000);
                const highResH = Math.max(targetHeight * 2, bounds.height * 2, 3200);

                const fitScale = Math.min((highResW - 120) / Math.max(100, bounds.width), (highResH - 140) / Math.max(100, bounds.height));

                let transX = (highResW / 2) - (bounds.centerX * fitScale);
                let transY = isTree ? 80 : ((highResH / 2) - (bounds.centerY * fitScale));

                const viewportGroup = clone.querySelector(isTree ? '#tree-viewport-group' : '#graph-viewport-group') || clone.querySelector('g');
                if (viewportGroup) {
                    viewportGroup.setAttribute('transform', `translate(${transX}, ${transY}) scale(${fitScale})`);
                }

                clone.setAttribute('width', highResW);
                clone.setAttribute('height', highResH);
                clone.setAttribute('viewBox', `0 0 ${highResW} ${highResH}`);

                const serializer = new XMLSerializer();
                let svgString = serializer.serializeToString(clone);
                if (!svgString.includes('xmlns="http://www.w3.org/2000/svg"')) {
                    svgString = svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
                }

                const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = (e) => {
                    console.warn('SVG rasterize error:', e);
                    resolve(null);
                };
                img.src = svgUrl;
            } catch (err) {
                console.warn('SVG export rasterize error:', err);
                resolve(null);
            }
        });
    }
}

