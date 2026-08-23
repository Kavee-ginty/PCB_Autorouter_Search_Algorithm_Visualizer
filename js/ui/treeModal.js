/**
 * treeModal.js - Hierarchical State-Space Tree Exploration Modal
 * Renders the state-space tree explored by the search algorithm for any selected net/pin.
 */

export class StateSpaceTreeModal {
    constructor() {
        this.modalElement = document.getElementById('tree-modal');
        this.containerElement = document.getElementById('tree-svg-container');
        this.titleElement = document.getElementById('tree-modal-title');
        this.statsElement = document.getElementById('tree-modal-stats');
        this.closeButton = document.getElementById('tree-modal-close');

        this.currentTree = null;
        this.currentPin = null;
        this.currentNet = null;

        this.zoomLevel = 1.0;
        this.panOffset = { x: 0, y: 0 };
        this.isPanning = false;
        this.startPan = { x: 0, y: 0 };

        this._bindEvents();
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

        // Pan and Zoom on SVG Container
        if (this.containerElement) {
            this.containerElement.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = this.containerElement.getBoundingClientRect();
                const cursorX = e.clientX - rect.left;
                const cursorY = e.clientY - rect.top;

                const worldX = (cursorX - this.panOffset.x) / this.zoomLevel;
                const worldY = (cursorY - this.panOffset.y) / this.zoomLevel;

                const zoomFactor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
                const newZoom = Math.max(0.15, Math.min(4.0, this.zoomLevel * zoomFactor));

                if (newZoom !== this.zoomLevel) {
                    this.zoomLevel = newZoom;
                    this.panOffset.x = cursorX - worldX * this.zoomLevel;
                    this.panOffset.y = cursorY - worldY * this.zoomLevel;
                    this._applyTransform();
                }
            }, { passive: false });

            this.containerElement.addEventListener('mousedown', (e) => {
                if (e.button === 0) {
                    this.isPanning = true;
                    this.startPan = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
                }
            });

            window.addEventListener('mousemove', (e) => {
                if (this.isPanning) {
                    this.panOffset = {
                        x: e.clientX - this.startPan.x,
                        y: e.clientY - this.startPan.y
                    };
                    this._applyTransform();
                }
            });

            window.addEventListener('mouseup', () => {
                this.isPanning = false;
            });

            this.containerElement.addEventListener('dblclick', () => {
                this.autoFitTree();
            });
        }

        // Zoom buttons
        const btnZoomIn = document.getElementById('tree-zoom-in');
        const btnZoomOut = document.getElementById('tree-zoom-out');
        const btnZoomReset = document.getElementById('tree-zoom-reset');

        if (btnZoomIn) btnZoomIn.addEventListener('click', () => {
            this.zoomLevel = Math.min(4.0, this.zoomLevel * 1.25);
            this._applyTransform();
        });
        if (btnZoomOut) btnZoomOut.addEventListener('click', () => {
            this.zoomLevel = Math.max(0.15, this.zoomLevel * 0.8);
            this._applyTransform();
        });
        if (btnZoomReset) btnZoomReset.addEventListener('click', () => {
            this.autoFitTree();
        });
    }

    _applyTransform() {
        const svgGroup = document.getElementById('tree-viewport-group');
        if (svgGroup) {
            svgGroup.setAttribute('transform', `translate(${this.panOffset.x}, ${this.panOffset.y}) scale(${this.zoomLevel})`);
        }
    }

    autoFitTree() {
        if (!this.treeBounds || !this.containerElement) return;
        const rect = this.containerElement.getBoundingClientRect();
        const cWidth = rect.width || (window.innerWidth * 0.88);
        const cHeight = rect.height || (window.innerHeight * 0.75);

        const treeW = Math.max(100, this.treeBounds.width);
        const treeH = Math.max(100, this.treeBounds.height);

        const scaleX = (cWidth - 60) / treeW;
        const scaleY = (cHeight - 80) / treeH;
        const fitScale = Math.max(0.2, Math.min(1.0, Math.min(scaleX, scaleY)));

        this.zoomLevel = fitScale;
        this.panOffset.x = (cWidth / 2) - (this.treeBounds.centerX * this.zoomLevel);
        this.panOffset.y = 40;
        this._applyTransform();
    }

    show(pin, net, treeData, algorithmName = 'Search') {
        if (!treeData) {
            alert(`No state-space search tree data found for pin ${pin.label}. Please run routing first!`);
            return;
        }

        this.currentPin = pin;
        this.currentNet = net;
        this.currentTree = treeData;

        const pinName = pin?.label || pin?.id || 'Pin';
        const netName = net ? net.name : 'Selected Route';
        this.titleElement.textContent = `State-Space Exploration Tree • ${pinName} (${netName}) [${algorithmName}]`;

        this.modalElement.classList.remove('hidden');
        this.modalElement.classList.add('visible');

        this._renderTree(treeData);

        if (window.lucide) {
            lucide.createIcons();
        }

        // Auto-center and fit the full tree inside modal viewport
        setTimeout(() => this.autoFitTree(), 20);
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
        // Compute tree layout coordinates (Reingold-Tilford compact layout for circular nodes)
        const nodeRadius = 24;
        const hGap = 20;
        const vGap = 75;

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

        const totalWidth = Math.max(2000, maxX + nodeRadius * 2 + 400);
        const totalHeight = Math.max(1200, maxY + nodeRadius * 2 + 400);

        // Build SVG Elements
        let svgContent = `
        <svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
            <g id="tree-viewport-group">
                <!-- Straight Line Edges with Cost Badges -->
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
            const strokeWidth = isSolution ? 3.0 : 2.0;

            // Compute edge weight / step cost (Past Path Cost for this transition)
            const rawCost = Math.abs((edge.to.g || 0) - (edge.from.g || 0));
            let costText = '1';
            if (rawCost > 0) {
                const gridSteps = rawCost / 5;
                costText = Number.isInteger(gridSteps) ? gridSteps.toString() : gridSteps.toFixed(1);
            }

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const badgeW = Math.max(18, costText.length * 7 + 8);

            svgContent += `
                <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" 
                      stroke="${strokeColor}" stroke-width="${strokeWidth}" />
                <g class="tree-edge-badge" transform="translate(${midX}, ${midY})">
                    <rect x="${-badgeW / 2}" y="-8" width="${badgeW}" height="16" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1" />
                    <text x="0" y="3.5" text-anchor="middle" font-size="9px" font-weight="bold" fill="#334155" font-family="sans-serif">${costText}</text>
                </g>
            `;
        }

        svgContent += `</g><g class="tree-nodes">`;

        // Circular Nodes
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
                fill = '#ef4444'; // Red root circle
                stroke = '#1e293b';
                strokeWidth = 2.5;
                titleColor = '#ffffff';
                subColor = '#fee2e2';
            } else if (isGoal) {
                fill = '#10b981'; // Green goal circle
                stroke = '#1e293b';
                strokeWidth = 2.5;
                titleColor = '#ffffff';
                subColor = '#d1fae5';
            } else if (isFrontier) {
                fill = '#8b5cf6'; // Purple frontier circle
                stroke = '#1e293b';
                strokeWidth = 2.5;
                titleColor = '#ffffff';
                subColor = '#ede9fe';
            } else if (isSolution) {
                fill = '#ffffff'; // Solution path node
                stroke = '#10b981';
                strokeWidth = 3.0;
                titleColor = '#0f172a';
                subColor = '#059669';
            } else {
                fill = '#ffffff'; // Standard explored node
                stroke = '#1e293b';
                strokeWidth = 2.0;
                titleColor = '#0f172a';
                subColor = '#64748b';
            }

            // Sub-notation label: strictly heuristic h (no g, no f, no d in the node)
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

        this.containerElement.innerHTML = svgContent;

        // Update stats
        const solutionNodes = layoutNodes.filter(n => n.status === 'solution').length;
        this.statsElement.innerHTML = `
            <span>Total Nodes in Tree: <strong>${layoutNodes.length}</strong></span> • 
            <span>Max Tree Depth: <strong>${Math.round(maxY / (nodeRadius * 2 + vGap))}</strong></span> • 
            <span style="color: #10b981;">Solution Path Length: <strong>${solutionNodes} steps</strong></span>
        `;
    }
}
