/**
 * controls.js - User Interface Toolbar, Netlist Manager & Playback Controller
 */

export class PcbControls {
    constructor(app) {
        this.app = app;
        this._bindUIElements();
    }

    _bindUIElements() {
        // Algorithm selection
        this.algoSelect = document.getElementById('algo-select');
        this.depthLimitContainer = document.getElementById('depth-limit-container');
        this.depthLimitInput = document.getElementById('depth-limit-input');
        this.heuristicSelect = document.getElementById('heuristic-select');
        this.heuristicContainer = document.getElementById('heuristic-container');

        // Playback buttons
        this.btnRoute = document.getElementById('btn-route');
        this.btnStep = document.getElementById('btn-step');
        this.btnReset = document.getElementById('btn-reset');
        this.speedSlider = document.getElementById('speed-slider');
        this.speedValue = document.getElementById('speed-value');

        // Preset selector
        this.presetSelect = document.getElementById('preset-select');

        // Board Save/Load
        this.btnSaveBoard = document.getElementById('btn-save-board');
        this.btnLoadBoard = document.getElementById('btn-load-board');

        // Netlist elements
        this.netlistContainer = document.getElementById('netlist-items');
        this.btnAddNet = document.getElementById('btn-add-net');

        // Metrics elements
        this.metricNets = document.getElementById('metric-nets');
        this.metricExplored = document.getElementById('metric-explored');
        this.metricLength = document.getElementById('metric-length');
        this.metricRipups = document.getElementById('metric-ripups');
        this.metricTime = document.getElementById('metric-time');
        this.statusBadge = document.getElementById('status-badge');

        this._attachEventListeners();
    }

    _attachEventListeners() {
        if (this.algoSelect) {
            this.algoSelect.addEventListener('change', () => {
                const algo = this.algoSelect.value;
                if (algo === 'dls') {
                    this.depthLimitContainer.style.display = 'block';
                } else {
                    this.depthLimitContainer.style.display = 'none';
                }

                if (algo === 'greedy' || algo === 'astar') {
                    this.heuristicContainer.style.display = 'block';
                } else {
                    this.heuristicContainer.style.display = 'none';
                }

                this.app.setAlgorithm(algo);
            });
        }

        if (this.btnRoute) {
            this.btnRoute.addEventListener('click', () => {
                this.app.toggleAutoRoute();
            });
        }

        if (this.btnStep) {
            this.btnStep.addEventListener('click', () => {
                this.app.stepRoute();
            });
        }

        if (this.btnReset) {
            this.btnReset.addEventListener('click', () => {
                this.app.resetRouting();
            });
        }

        if (this.speedSlider) {
            this.speedSlider.addEventListener('input', () => {
                const val = parseInt(this.speedSlider.value, 10);
                this.speedValue.textContent = val === 0 ? 'Instant' : `${val}ms`;
                this.app.setStepDelay(val);
            });
        }

        if (this.presetSelect) {
            this.presetSelect.addEventListener('change', () => {
                const presetId = this.presetSelect.value;
                if (presetId) {
                    this.app.loadPreset(presetId);
                }
            });
        }

        if (this.btnAddNet) {
            this.btnAddNet.addEventListener('click', () => {
                this.app.showAddNetDialog();
            });
        }

        if (this.btnSaveBoard) {
            this.btnSaveBoard.addEventListener('click', () => {
                this.app.saveCurrentBoard();
            });
        }

        if (this.btnLoadBoard) {
            this.btnLoadBoard.addEventListener('click', () => {
                this.app.showLoadBoardDialog();
            });
        }
    }

    updateMetrics(data) {
        if (this.metricNets) this.metricNets.textContent = `${data.netsRouted || 0}/${data.netsTotal || 0}`;
        if (this.metricExplored) this.metricExplored.textContent = (data.totalNodesExplored || 0).toLocaleString();
        if (this.metricLength) this.metricLength.textContent = `${(data.totalWireLengthMm || 0).toFixed(1)} mm`;
        if (this.metricRipups) this.metricRipups.textContent = (data.totalRipups || 0).toString();
        if (this.metricTime) this.metricTime.textContent = `${(data.executionTimeMs || 0).toFixed(1)} ms`;
    }

    setStatus(text, type = 'idle') {
        if (this.statusBadge) {
            this.statusBadge.textContent = text;
            this.statusBadge.className = `status-badge status-${type}`;
        }
    }

    renderNetlist(nets, routedMap = new Map()) {
        if (!this.netlistContainer) return;
        this.netlistContainer.innerHTML = '';

        nets.forEach((net, index) => {
            const routedInfo = routedMap.get(net.id);
            const isRouted = !!routedInfo;
            const lengthMm = isRouted ? `${((routedInfo.path.length - 1) * 5).toFixed(0)}mm` : 'Unrouted';

            const item = document.createElement('div');
            item.className = `net-card ${isRouted ? 'routed' : ''}`;
            item.innerHTML = `
                <div class="net-header">
                    <span class="net-color-pill" style="background: ${net.color};"></span>
                    <span class="net-name">${net.name}</span>
                    <span class="net-status ${isRouted ? 'badge-success' : 'badge-pending'}">${isRouted ? 'ROUTED' : 'PENDING'}</span>
                </div>
                <div class="net-details">
                    <span class="net-pin-chip">${net.source}</span>
                    <span class="net-arrow">➜</span>
                    <span class="net-pin-chip">${net.target}</span>
                    <span class="net-length">${lengthMm}</span>
                </div>
            `;

            // Click net to view route tree or highlight
            item.addEventListener('click', () => {
                if (routedInfo && routedInfo.tree) {
                    this.app.treeModal.show({ label: net.source }, net, routedInfo.tree, this.app.currentAlgorithm);
                }
            });

            this.netlistContainer.appendChild(item);
        });
    }
}
