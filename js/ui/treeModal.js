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
                const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
                this.zoomLevel = Math.max(0.2, Math.min(4.0, this.zoomLevel * zoomFactor));
                this._applyTransform();
            });

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
            this.zoomLevel = Math.max(0.2, this.zoomLevel * 0.8);
            this._applyTransform();
        });
        if (btnZoomReset) btnZoomReset.addEventListener('click', () => {
            this.zoomLevel = 1.0;
            this.panOffset = { x: 40, y: 40 };
            this._applyTransform();
        });
    }

    _applyTransform() {
        const svgGroup = document.getElementById('tree-viewport-group');
        if (svgGroup) {
            svgGroup.setAttribute('transform', `translate(${this.panOffset.x}, ${this.panOffset.y}) scale(${this.zoomLevel})`);
        }
    }

    show(pin, net, treeData, algorithmName = 'Search') {
        if (!treeData) {
            alert(`No state-space search tree data found for pin ${pin.label}. Please run routing first!`);
            return;
        }

        this.currentPin = pin;
        this.currentNet = net;
        this.currentTree = treeData;

        const netName = net ? net.name : 'Selected Route';
        this.titleElement.textContent = `State-Space Exploration Tree • Pin ${pin.label} (${netName}) [${algorithmName}]`;

        this._renderTree(treeData);
        this.modalElement.classList.remove('hidden');
        this.modalElement.classList.add('visible');

        this.zoomLevel = 1.0;
        this.panOffset = { x: 60, y: 40 };
        this._applyTransform();
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
        // Compute tree layout coordinates (Reingold-Tilford compact layout)
        const nodeWidth = 72;
        const nodeHeight = 44;
        const hGap = 24;
        const vGap = 65;

        let nextX = 0;
        const layoutNodes = [];
        const layoutEdges = [];

        function layoutSubtree(node, depth = 0) {
            node._depth = depth;

            if (!node.children || node.children.length === 0) {
                node._x = nextX;
                nextX += nodeWidth + hGap;
            } else {
                for (const child of node.children) {
                    layoutSubtree(child, depth + 1);
                }
                const firstChild = node.children[0];
                const lastChild = node.children[node.children.length - 1];
                node._x = (firstChild._x + lastChild._x) / 2;
            }
            node._y = depth * (nodeHeight + vGap);

            layoutNodes.push(node);
            if (node.children) {
                for (const child of node.children) {
                    layoutEdges.push({ from: node, to: child });
                }
            }
        }

        layoutSubtree(rootNode, 0);

        // Calculate bounding box
        let maxX = 0, maxY = 0;
        for (const n of layoutNodes) {
            if (n._x > maxX) maxX = n._x;
            if (n._y > maxY) maxY = n._y;
        }

        const totalWidth = Math.max(1200, maxX + nodeWidth + 100);
        const totalHeight = Math.max(800, maxY + nodeHeight + 100);

        // Build SVG Elements
        let svgContent = `
        <svg width="${totalWidth}" height="${totalHeight}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="solGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#059669" />
                    <stop offset="100%" stop-color="#10b981" />
                </linearGradient>
                <linearGradient id="visGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#0e7490" />
                    <stop offset="100%" stop-color="#06b6d4" />
                </linearGradient>
                <linearGradient id="frontGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#d97706" />
                    <stop offset="100%" stop-color="#f59e0b" />
                </linearGradient>
                <linearGradient id="pruneGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#dc2626" />
                    <stop offset="100%" stop-color="#ef4444" />
                </linearGradient>
            </defs>
            <g id="tree-viewport-group">
                <!-- Edges -->
                <g class="tree-edges">
        `;

        for (const edge of layoutEdges) {
            const x1 = edge.from._x + nodeWidth / 2;
            const y1 = edge.from._y + nodeHeight;
            const x2 = edge.to._x + nodeWidth / 2;
            const y2 = edge.to._y;

            const isSolution = edge.to.status === 'solution';
            const strokeColor = isSolution ? '#10b981' : 'rgba(148, 163, 184, 0.35)';
            const strokeWidth = isSolution ? 3.0 : 1.5;

            // Bezier connector
            const midY = (y1 + y2) / 2;
            svgContent += `
                <path d="M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}" 
                      stroke="${strokeColor}" stroke-width="${strokeWidth}" fill="none" />
            `;
        }

        svgContent += `</g><g class="tree-nodes">`;

        // Nodes
        for (const n of layoutNodes) {
            let fillGrad = 'url(#visGrad)';
            let borderColor = '#38bdf8';
            if (n.status === 'solution') {
                fillGrad = 'url(#solGrad)';
                borderColor = '#34d399';
            } else if (n.status === 'frontier') {
                fillGrad = 'url(#frontGrad)';
                borderColor = '#fde047';
            } else if (n.status === 'pruned') {
                fillGrad = 'url(#pruneGrad)';
                borderColor = '#f87171';
            }

            const gVal = (n.g || 0).toFixed(1);
            const hVal = (n.h || 0).toFixed(1);
            const fVal = (n.f || 0).toFixed(1);

            svgContent += `
                <g class="tree-node" transform="translate(${n._x}, ${n._y})">
                    <rect width="${nodeWidth}" height="${nodeHeight}" rx="6" ry="6"
                          fill="${fillGrad}" stroke="${borderColor}" stroke-width="${n.status === 'solution' ? 2.5 : 1.5}" />
                    <text x="${nodeWidth / 2}" y="14" text-anchor="middle" fill="#ffffff" font-size="10px" font-weight="bold" font-family="monospace">
                        ${n.name}
                    </text>
                    <text x="${nodeWidth / 2}" y="26" text-anchor="middle" fill="#e2e8f0" font-size="8px" font-family="sans-serif">
                        g:${gVal} h:${hVal}
                    </text>
                    <text x="${nodeWidth / 2}" y="36" text-anchor="middle" fill="#fef08a" font-size="8px" font-weight="bold" font-family="sans-serif">
                        f:${fVal} d:${n.depth}
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
            <span>Max Tree Depth: <strong>${maxY / (nodeHeight + vGap)}</strong></span> • 
            <span style="color: #34d399;">Solution Path Length: <strong>${solutionNodes} steps</strong></span>
        `;
    }
}
