/**
 * app.js - Main Application Orchestrator for PCB AutoRouting Visualizer
 */

import { PcbGrid, GRID_COLS, GRID_ROWS, PITCH_MM } from './core/grid.js';
import { ComponentInstance, COMPONENT_TYPES } from './core/components.js';
import { GridGraphBridge } from './core/bridge.js';
import { SearchEngine, ALGORITHMS } from './algorithms/engine.js';
import { RipUpRouter } from './router/ripup.js';
import { PcbCanvas } from './ui/canvas.js';
import { StateSpaceTreeModal } from './ui/treeModal.js';
import { PcbControls } from './ui/controls.js';

class PcbApp {
    constructor() {
        this.grid = new PcbGrid(GRID_COLS, GRID_ROWS, PITCH_MM);
        this.bridge = new GridGraphBridge(this.grid);
        this.engine = new SearchEngine(this.bridge);
        this.router = new RipUpRouter(this.grid, this.bridge, this.engine);

        this.components = [];
        this.nets = [];
        this.pinLookup = new Map(); // pinId -> { x, y, id, componentId, nodeId, label }

        this.currentAlgorithm = 'astar';
        this.currentHeuristic = 'euclidean';
        this.depthLimit = 10;
        this.stepDelayMs = 40; // Default animation speed

        // Execution & Animation state
        this.isRunning = false;
        this.activeRouterGenerator = null;
        this.timerId = null;
        this.routedDataMap = new Map(); // netId -> routed summary
        this.stepHistory = [];
        this.historyIndex = -1;
        this.currentActiveNet = null;

        this.canvasElement = document.getElementById('pcb-canvas');
        this.canvas = new PcbCanvas(this.canvasElement, this.grid, {
            onComponentMoved: (comp) => this.onComponentMoved(comp),
            onPinClicked: (pin) => this.onPinClicked(pin),
            onSelectionChanged: (comp) => this.onSelectionChanged(comp)
        });

        this.treeModal = new StateSpaceTreeModal(this);
        this.controls = new PcbControls(this);

        this.init();
    }

    async init() {
        window.addEventListener('resize', () => this.canvas.resize());
        await this.fetchPresets();
        this.loadDefaultPreset();
    }

    async fetchPresets() {
        try {
            let res = await fetch('api/presets').catch(() => null);
            if (!res || !res.ok) {
                res = await fetch('api/presets.php').catch(() => null);
            }
            if (res && res.ok) {
                const json = await res.json();
                if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                    this.presets = json.data;
                    this._populatePresetDropdown(json.data);
                    return;
                }
            }
        } catch (e) {
            console.warn('Could not load presets from backend, using built-in presets:', e);
        }

        // Built-in presets fallback
        this.presets = this._getBuiltinPresets();
        this._populatePresetDropdown(this.presets);
    }

    _populatePresetDropdown(presetList) {
        const select = document.getElementById('preset-select');
        if (select) {
            select.innerHTML = '<option value="" disabled>-- Select Preset Circuit --</option>';
            presetList.forEach((p, idx) => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.textContent = p.name;
                if (idx === 0) opt.selected = true;
                select.appendChild(opt);
            });
        }
    }

    _getBuiltinPresets() {
        return [
            {
                id: 1,
                name: 'Automatic Night Light Circuit (Default)',
                description: 'Standard series loop connecting Battery -> Switch -> Light Sensor (LDR) -> Current Limiting Resistor -> LED -> Battery Ground.',
                circuit_type: 'series',
                components: [
                    { id: 'bat_1', type: 'battery', name: 'Battery (BT1)', x: 1, y: 1, orientation: 'horizontal', pins: [{ id: 'B+', label: '+', x: 1, y: 1, type: 'power' }, { id: 'B-', label: '-', x: 3, y: 1, type: 'ground' }] },
                    { id: 'sw_1', type: 'switch', name: 'Power Switch (S1)', x: 5, y: 1, orientation: 'horizontal', pins: [{ id: 'S1-A', label: '+', x: 5, y: 1, type: 'signal' }, { id: 'S1-B', label: '-', x: 6, y: 1, type: 'signal' }] },
                    { id: 'ldr_1', type: 'sensor', name: 'Light Sensor (RLDR)', x: 8, y: 3, orientation: 'vertical', pins: [{ id: 'L-in', label: '+', x: 8, y: 3, type: 'signal' }, { id: 'L-out', label: '-', x: 8, y: 4, type: 'signal' }] },
                    { id: 'res_1', type: 'resistor', name: 'Current Resistor (R1)', x: 5, y: 6, orientation: 'horizontal', pins: [{ id: 'R-in', label: '', x: 5, y: 6, type: 'signal' }, { id: 'R-out', label: '', x: 6, y: 6, type: 'signal' }] },
                    { id: 'led_1', type: 'led', name: 'Indicator LED (D1)', x: 1, y: 5, orientation: 'vertical', pins: [{ id: 'D-A', label: '+', x: 1, y: 5, type: 'anode' }, { id: 'D-K', label: '-', x: 1, y: 6, type: 'cathode' }] }
                ],
                netlist: [
                    { id: 'net_1', name: 'Net 1 (VCC)', source: 'B+', target: 'S1-A', color: '#ef4444' },
                    { id: 'net_2', name: 'Net 2 (Switched)', source: 'S1-B', target: 'L-in', color: '#f59e0b' },
                    { id: 'net_3', name: 'Net 3 (Sensor Out)', source: 'L-out', target: 'R-in', color: '#10b981' },
                    { id: 'net_4', name: 'Net 4 (LED Anode)', source: 'R-out', target: 'D-A', color: '#3b82f6' },
                    { id: 'net_5', name: 'Net 5 (GND Return)', source: 'D-K', target: 'B-', color: '#8b5cf6' }
                ]
            },
            {
                id: 2,
                name: 'Dense Routing Benchmark',
                description: 'Compact placement in center with narrow corridors to test shortest path algorithms.',
                circuit_type: 'dense',
                components: [
                    { id: 'bat_1', type: 'battery', name: 'Battery (BT1)', x: 2, y: 2, orientation: 'horizontal', pins: [{ id: 'B+', label: '+', x: 2, y: 2, type: 'power' }, { id: 'B-', label: '-', x: 4, y: 2, type: 'ground' }] },
                    { id: 'sw_1', type: 'switch', name: 'Power Switch (S1)', x: 6, y: 2, orientation: 'horizontal', pins: [{ id: 'S1-A', label: '+', x: 6, y: 2, type: 'signal' }, { id: 'S1-B', label: '-', x: 7, y: 2, type: 'signal' }] },
                    { id: 'ldr_1', type: 'sensor', name: 'Light Sensor (RLDR)', x: 6, y: 4, orientation: 'vertical', pins: [{ id: 'L-in', label: '+', x: 6, y: 4, type: 'signal' }, { id: 'L-out', label: '-', x: 6, y: 5, type: 'signal' }] },
                    { id: 'res_1', type: 'resistor', name: 'Current Resistor (R1)', x: 4, y: 5, orientation: 'horizontal', pins: [{ id: 'R-in', label: '', x: 4, y: 5, type: 'signal' }, { id: 'R-out', label: '', x: 5, y: 5, type: 'signal' }] },
                    { id: 'led_1', type: 'led', name: 'Indicator LED (D1)', x: 2, y: 4, orientation: 'vertical', pins: [{ id: 'D-A', label: '+', x: 2, y: 4, type: 'anode' }, { id: 'D-K', label: '-', x: 2, y: 5, type: 'cathode' }] }
                ],
                netlist: [
                    { id: 'net_1', name: 'Net 1 (VCC)', source: 'B+', target: 'S1-A', color: '#ef4444' },
                    { id: 'net_2', name: 'Net 2 (Switched)', source: 'S1-B', target: 'L-in', color: '#f59e0b' },
                    { id: 'net_3', name: 'Net 3 (Sensor Out)', source: 'L-out', target: 'R-in', color: '#10b981' },
                    { id: 'net_4', name: 'Net 4 (LED Anode)', source: 'R-out', target: 'D-A', color: '#3b82f6' },
                    { id: 'net_5', name: 'Net 5 (GND Return)', source: 'D-K', target: 'B-', color: '#8b5cf6' }
                ]
            },
            {
                id: 3,
                name: 'Rip-Up & Reroute Challenge',
                description: 'Cross-configured pins that trigger trace conflicts, demonstrating automated deadlock rip-up & reroute logic.',
                circuit_type: 'challenge',
                components: [
                    { id: 'bat_1', type: 'battery', name: 'Battery (BT1)', x: 1, y: 2, orientation: 'horizontal', pins: [{ id: 'B+', label: '+', x: 1, y: 2, type: 'power' }, { id: 'B-', label: '-', x: 3, y: 2, type: 'ground' }] },
                    { id: 'sw_1', type: 'switch', name: 'Power Switch (S1)', x: 7, y: 5, orientation: 'horizontal', pins: [{ id: 'S1-A', label: '+', x: 7, y: 5, type: 'signal' }, { id: 'S1-B', label: '-', x: 8, y: 5, type: 'signal' }] },
                    { id: 'ldr_1', type: 'sensor', name: 'Light Sensor (RLDR)', x: 7, y: 1, orientation: 'horizontal', pins: [{ id: 'L-in', label: '+', x: 7, y: 1, type: 'signal' }, { id: 'L-out', label: '-', x: 8, y: 1, type: 'signal' }] },
                    { id: 'res_1', type: 'resistor', name: 'Current Resistor (R1)', x: 1, y: 5, orientation: 'horizontal', pins: [{ id: 'R-in', label: '', x: 1, y: 5, type: 'signal' }, { id: 'R-out', label: '', x: 2, y: 5, type: 'signal' }] },
                    { id: 'led_1', type: 'led', name: 'Indicator LED (D1)', x: 4, y: 3, orientation: 'horizontal', pins: [{ id: 'D-A', label: '+', x: 4, y: 3, type: 'anode' }, { id: 'D-K', label: '-', x: 5, y: 3, type: 'cathode' }] }
                ],
                netlist: [
                    { id: 'net_1', name: 'Net 1 (VCC Cross)', source: 'B+', target: 'S1-A', color: '#ef4444' },
                    { id: 'net_2', name: 'Net 2 (Sensor Cross)', source: 'S1-B', target: 'L-in', color: '#f59e0b' },
                    { id: 'net_3', name: 'Net 3 (Sensor Out)', source: 'L-out', target: 'R-in', color: '#10b981' },
                    { id: 'net_4', name: 'Net 4 (LED Anode)', source: 'R-out', target: 'D-A', color: '#3b82f6' },
                    { id: 'net_5', name: 'Net 5 (GND Return)', source: 'D-K', target: 'B-', color: '#8b5cf6' }
                ]
            }
        ];
    }

    loadDefaultPreset() {
        if (this.presets && this.presets.length > 0) {
            this.applyPresetData(this.presets[0]);
        } else {
            this.loadFallbackCircuit();
        }
    }

    loadPreset(presetId) {
        const p = this.presets.find(item => item.id == presetId);
        if (p) {
            this.applyPresetData(p);
        }
    }

    applyPresetData(preset) {
        this.resetRouting();

        // Instantiate components
        this.components = preset.components.map(c => {
            const comp = new ComponentInstance(c.id, c.type, c.x, c.y, c.orientation);
            return comp;
        });

        this.nets = preset.netlist.map(n => ({
            ...n,
            path: null
        }));

        this._refreshPinLookup();
        this.canvas.setCircuit(this.components, this.nets);
        this.controls.renderNetlist(this.nets, this.routedDataMap);
        this.controls.setStatus(`Loaded: ${preset.name}`, 'ready');
    }

    loadFallbackCircuit() {
        // Fallback default circuit: Battery, Switch, Sensor, Resistor, LED in series
        this.components = [
            new ComponentInstance('bat_1', 'battery', 1, 1, 'horizontal'),
            new ComponentInstance('sw_1', 'switch', 5, 1, 'horizontal'),
            new ComponentInstance('ldr_1', 'sensor', 8, 3, 'vertical'),
            new ComponentInstance('res_1', 'resistor', 5, 6, 'horizontal'),
            new ComponentInstance('led_1', 'led', 1, 5, 'vertical')
        ];

        this.nets = [
            { id: 'net_1', name: 'Net 1 (VCC)', source: 'B+', target: 'S1-A', color: '#ef4444', path: null },
            { id: 'net_2', name: 'Net 2 (Switched)', source: 'S1-B', target: 'L-in', color: '#f59e0b', path: null },
            { id: 'net_3', name: 'Net 3 (Sensor Out)', source: 'L-out', target: 'R-in', color: '#10b981', path: null },
            { id: 'net_4', name: 'Net 4 (LED Anode)', source: 'R-out', target: 'D-A', color: '#3b82f6', path: null },
            { id: 'net_5', name: 'Net 5 (GND Return)', source: 'D-K', target: 'B-', color: '#8b5cf6', path: null }
        ];

        this._refreshPinLookup();
        this.canvas.setCircuit(this.components, this.nets);
        this.controls.renderNetlist(this.nets, this.routedDataMap);
        this.controls.setStatus('Ready to Route', 'ready');
    }

    _refreshPinLookup() {
        this.pinLookup.clear();
        for (const comp of this.components) {
            for (const pin of comp.getPins()) {
                this.pinLookup.set(pin.id, {
                    ...pin,
                    nodeId: this.grid.toId(pin.x, pin.y)
                });
            }
        }
    }

    onComponentMoved(comp) {
        this.resetRouting();
        this._refreshPinLookup();
        this.canvas.setCircuit(this.components, this.nets);
        this.controls.setStatus('Component moved - Layout updated', 'ready');
    }

    onSelectionChanged(comp) {
        // Selection feedback
    }

    onPinClicked(pin) {
        // Find net connected to this pin
        let net = this.nets.find(n => n.source === pin.id || n.target === pin.id);
        let routed = net ? this.routedDataMap.get(net.id) : null;
        let treeData = routed?.tree;

        if (!treeData && net) {
            // Check if active step or history has a tree for this net
            for (let i = this.stepHistory.length - 1; i >= 0; i--) {
                const s = this.stepHistory[i];
                if (s.activeNet?.id === net.id && s.searchState?.meta?.tree) {
                    treeData = s.searchState.meta.tree;
                    break;
                }
            }
        }

        if (treeData) {
            const algoInfo = ALGORITHMS[this.currentAlgorithm]?.name || this.currentAlgorithm;
            this.treeModal.show(pin, net, treeData, algoInfo);
        } else {
            // Find if any net was routed from this pin
            this.controls.setStatus(`Pin ${pin.label || pin.id} clicked. Run routing or step forward to explore search tree!`, 'idle');
        }
    }

    setAlgorithm(algo) {
        this.currentAlgorithm = algo;
        this.resetRouting();
        const info = ALGORITHMS[algo]?.name || algo;
        this.controls.setStatus(`Selected Algorithm: ${info}`, 'ready');
    }

    setStepDelay(ms) {
        this.stepDelayMs = ms;
    }

    toggleAutoRoute() {
        if (this.isRunning) {
            this.pauseRouting();
        } else {
            this.startAutoRoute();
        }
    }

    startAutoRoute() {
        if (!this.activeRouterGenerator) {
            this.resetRouting();
            this.activeRouterGenerator = this.router.routeAllNets(
                this.nets,
                this.pinLookup,
                this.currentAlgorithm,
                {
                    heuristicType: this.currentHeuristic,
                    depthLimit: parseInt(document.getElementById('depth-limit-input')?.value || '10', 10),
                    maxRipUpIterations: 6
                }
            );
        }

        this.isRunning = true;
        const btn = document.getElementById('btn-route');
        if (btn) {
            btn.innerHTML = '<i data-lucide="pause"></i> Pause';
            if (window.lucide) lucide.createIcons();
        }
        this.controls.setStatus('Routing in progress...', 'running');

        const startTime = performance.now();

        const stepLoop = () => {
            if (!this.isRunning) return;

            if (this.stepDelayMs === 0) {
                // Instant execution mode: exhaust generator
                while (this.isRunning) {
                    const step = this.activeRouterGenerator.next();
                    if (step.done) {
                        this._handleRoutingCompleted(step.value, performance.now() - startTime);
                        return;
                    }
                    this._processRouterStep(step.value);
                }
            } else {
                const step = this.activeRouterGenerator.next();
                if (step.done) {
                    this._handleRoutingCompleted(step.value, performance.now() - startTime);
                    return;
                }
                this._processRouterStep(step.value);
                this.timerId = setTimeout(stepLoop, this.stepDelayMs);
            }
        };

        stepLoop();
    }

    pauseRouting() {
        this.isRunning = false;
        if (this.timerId) clearTimeout(this.timerId);
        const btn = document.getElementById('btn-route');
        if (btn) {
            btn.innerHTML = '<i data-lucide="play"></i> Resume';
            if (window.lucide) lucide.createIcons();
        }
        this.controls.setStatus('Routing paused', 'idle');
    }

    stepRoute() {
        if (this.isRunning) this.pauseRouting();

        // If user has stepped back and wants to step forward in recorded history:
        if (this.historyIndex < this.stepHistory.length - 1) {
            this.historyIndex++;
            this._applySnapshot(this.stepHistory[this.historyIndex]);
            return;
        }

        if (!this.activeRouterGenerator) {
            this.resetRouting();
            this.activeRouterGenerator = this.router.routeAllNets(
                this.nets,
                this.pinLookup,
                this.currentAlgorithm,
                {
                    heuristicType: this.currentHeuristic,
                    depthLimit: parseInt(document.getElementById('depth-limit-input')?.value || '10', 10),
                    maxRipUpIterations: 6
                }
            );
        }

        const step = this.activeRouterGenerator.next();
        if (step.done) {
            this._handleRoutingCompleted(step.value, 0);
            return;
        }
        this._processRouterStep(step.value);
    }

    stepBack() {
        if (this.isRunning) this.pauseRouting();

        if (this.historyIndex > 0) {
            this.historyIndex--;
            this._applySnapshot(this.stepHistory[this.historyIndex]);
        } else if (this.historyIndex === 0) {
            this.controls.setStatus('At beginning of search history.', 'ready');
        }
    }

    _captureSnapshot(step, explanation = '') {
        const snapshot = {
            cells: [...this.grid.cells],
            occupants: this.grid.occupants.map(o => o ? { ...o } : null),
            penalties: [...this.grid.penalties],
            nets: this.nets.map(n => ({ ...n, path: n.path ? [...n.path] : null })),
            routedDataMap: new Map(this.routedDataMap),
            rippedPaths: [...this.canvas.rippedPaths],
            activeNet: step.net || this.currentActiveNet || null,
            searchState: {
                visited: step.visited ? [...step.visited] : [],
                frontier: step.frontier ? [...step.frontier] : [],
                currentNode: step.currentNode !== undefined ? step.currentNode : null,
                currentPath: step.currentPath ? [...step.currentPath] : [],
                treeEdges: step.treeEdges ? [...step.treeEdges] : [],
                treeEdgesF: step.treeEdgesF ? [...step.treeEdgesF] : [],
                treeEdgesB: step.treeEdgesB ? [...step.treeEdgesB] : [],
                net: step.net || this.currentActiveNet || null,
                direction: step.direction || null,
                meta: step
            },
            hudInfo: {
                net: step.net || this.currentActiveNet || null,
                action: step.action || (step.type === 'search_step' ? 'Exploring' : (step.type === 'net_routed' ? 'Routed' : step.type)),
                currentNode: step.currentNode,
                currentPath: step.currentPath,
                treeEdges: step.treeEdges,
                depth: step.depth,
                g: step.g !== undefined ? step.g : (step.cost !== undefined ? step.cost : 0),
                h: step.h !== undefined ? step.h : 0,
                f: step.f !== undefined ? step.f : 0,
                explanation: explanation
            },
            metrics: {
                netsRouted: this.routedDataMap.size,
                netsTotal: this.nets.length,
                totalNodesExplored: step.totalNodesExplored || 0,
                totalWireLengthMm: this._calculateCurrentWireLength(),
                totalRipups: this.totalRipups || 0,
                executionTimeMs: 0
            },
            status: {
                text: this.controls.statusBadge ? this.controls.statusBadge.textContent : '',
                type: this.controls.statusBadge ? (this.controls.statusBadge.className.match(/status-([a-z0-9_-]+)/)?.[1] || 'idle') : 'idle'
            }
        };

        if (this.historyIndex < this.stepHistory.length - 1) {
            this.stepHistory = this.stepHistory.slice(0, this.historyIndex + 1);
        }

        this.stepHistory.push(snapshot);
        this.historyIndex = this.stepHistory.length - 1;
    }

    _applySnapshot(snapshot) {
        if (!snapshot) return;

        // Restore grid
        if (snapshot.cells) {
            this.grid.cells = [...snapshot.cells];
        }
        if (snapshot.occupants) {
            for (let i = 0; i < this.grid.totalNodes; i++) {
                this.grid.occupants[i] = snapshot.occupants[i] ? { ...snapshot.occupants[i] } : null;
            }
        }
        if (snapshot.penalties) {
            this.grid.penalties = [...snapshot.penalties];
        }

        // Restore nets
        for (let i = 0; i < this.nets.length; i++) {
            const sn = snapshot.nets.find(n => n.id === this.nets[i].id);
            if (sn) {
                this.nets[i].path = sn.path ? [...sn.path] : null;
            }
        }

        // Restore routed map
        this.routedDataMap = new Map(snapshot.routedDataMap);

        // Restore canvas state
        this.canvas.rippedPaths = [...snapshot.rippedPaths];
        this.canvas.setSearchState(
            snapshot.searchState.visited,
            snapshot.searchState.frontier,
            snapshot.searchState.currentNode,
            snapshot.searchState.currentPath,
            snapshot.searchState.treeEdges,
            snapshot.searchState
        );
        this.canvas.setCircuit(this.components, this.nets);

        // Restore controls & HUD
        this.controls.renderNetlist(this.nets, this.routedDataMap);
        this.controls.updateMetrics(snapshot.metrics);
        this.controls.updateSearchHud(snapshot.hudInfo);
        this.controls.setStatus(snapshot.status.text, snapshot.status.type);
    }

    _calculateCurrentWireLength() {
        let len = 0;
        for (const net of this.nets) {
            if (net.path && net.path.length > 1) {
                len += (net.path.length - 1) * this.grid.pitch;
            }
        }
        return len;
    }

    resetRouting() {
        this.pauseRouting();
        this.activeRouterGenerator = null;
        this.stepHistory = [];
        this.historyIndex = -1;
        this.currentActiveNet = null;
        this.grid.clearTraces();
        this.grid.resetPenalties();
        this.routedDataMap.clear();

        for (const n of this.nets) {
            n.path = null;
        }

        this.canvas.clearSearchState();
        this.canvas.clearRippedPaths();
        this.canvas.setCircuit(this.components, this.nets);
        this.controls.renderNetlist(this.nets, this.routedDataMap);
        this.controls.updateMetrics({
            netsRouted: 0,
            netsTotal: this.nets.length,
            totalNodesExplored: 0,
            totalWireLengthMm: 0,
            totalRipups: 0,
            executionTimeMs: 0
        });
        this.controls.updateSearchHud({
            action: 'Ready',
            explanation: 'Ready to route. Click "Auto Route All" or "Step Next" to begin.'
        });

        const btn = document.getElementById('btn-route');
        if (btn) {
            btn.innerHTML = '<i data-lucide="play"></i> Auto Route All';
            if (window.lucide) lucide.createIcons();
        }
        this.controls.setStatus('Ready to Route', 'ready');
    }

    _processRouterStep(step) {
        if (!step) return;

        if (step.type === 'net_start') {
            this.currentActiveNet = step.net;
            const srcName = this.controls.getFriendlyPinName(step.net.source);
            const tgtName = this.controls.getFriendlyPinName(step.net.target);

            this.canvas.setSearchState([], [], step.startNodeId, [step.startNodeId], [], {
                net: step.net
            });
            const expl = `Starting search for ${step.net.name} from pin ${srcName} towards ${tgtName}...`;
            this.controls.setStatus(`Routing ${step.net.name} (${srcName} ➜ ${tgtName})...`, 'running');
            this.controls.updateSearchHud({
                net: step.net,
                action: 'Start',
                currentNode: step.startNodeId,
                currentPath: [step.startNodeId],
                treeEdges: [],
                explanation: expl
            });
            this._captureSnapshot(step, expl);
        } else if (step.type === 'search_step' || step.type === 'step') {
            this.currentActiveNet = step.net;
            this.canvas.setSearchState(
                step.visited,
                step.frontier,
                step.currentNode,
                step.currentPath,
                step.treeEdges,
                {
                    treeEdgesF: step.treeEdgesF,
                    treeEdgesB: step.treeEdgesB,
                    net: step.net,
                    direction: step.direction,
                    meta: step
                }
            );

            const c = this.grid.toCoord(step.currentNode);
            const fVal = step.f !== undefined ? `f=${step.f.toFixed(1)}mm` : `step`;
            const branchCount = step.treeEdges ? step.treeEdges.length : 0;
            const expl = `Exploring node (${c?.x}, ${c?.y}) [${fVal}] • ${branchCount} branch paths visited in search tree`;

            this.controls.updateMetrics({
                netsRouted: this.routedDataMap.size,
                netsTotal: this.nets.length,
                totalNodesExplored: step.totalNodesExplored
            });
            this.controls.updateSearchHud({
                net: step.net,
                action: step.action || 'Explore',
                currentNode: step.currentNode,
                currentPath: step.currentPath,
                treeEdges: step.treeEdges,
                depth: step.depth,
                g: step.g,
                h: step.h,
                f: step.f,
                explanation: expl
            });

            this._captureSnapshot(step, expl);
        } else if (step.type === 'net_routed') {
            // Net successfully placed
            const net = this.nets.find(n => n.id === step.net.id);
            if (net) {
                net.path = step.path;
            }
            this.routedDataMap.set(step.net.id, step);
            this.controls.renderNetlist(this.nets, this.routedDataMap);
            this.canvas.clearSearchState();
            this.canvas.setCircuit(this.components, this.nets);

            const expl = `Goal pin reached! Committed trace for ${step.net.name} (${step.path.length} cells, ${step.cost.toFixed(1)}mm).`;
            this.controls.setStatus(expl, 'ready');
            this.controls.updateSearchHud({
                net: step.net,
                action: 'Routed',
                currentNode: step.path[step.path.length - 1],
                currentPath: step.path,
                cost: step.cost,
                g: step.cost,
                f: step.cost,
                explanation: expl
            });
            this._captureSnapshot(step, expl);
        } else if (step.type === 'conflict_detected') {
            const expl = `Conflict detected on ${step.net.name}! Path blocked by existing traces. Initiating Rip-Up...`;
            this.controls.setStatus(expl, 'conflict');
            this.controls.updateSearchHud({
                net: step.net,
                action: 'Conflict',
                explanation: expl
            });
            this._captureSnapshot(step, expl);
        } else if (step.type === 'ripup_performed') {
            // Track ripped path as dotted historical trace
            if (step.rippedNet && step.rippedPath) {
                this.canvas.addRippedPath(step.rippedNet, step.rippedPath);
            }
            // Update ripped net
            const ripped = this.nets.find(n => n.id === step.rippedNet.id);
            if (ripped) ripped.path = null;
            this.routedDataMap.delete(step.rippedNet.id);
            this.controls.renderNetlist(this.nets, this.routedDataMap);
            this.canvas.setCircuit(this.components, this.nets);

            const expl = `Ripped up ${step.rippedNet.name}. Applied congestion penalty to corridor. Re-queuing...`;
            this.controls.setStatus(expl, 'conflict');
            this.controls.updateSearchHud({
                net: step.rippedNet,
                action: 'Rip-Up',
                explanation: expl
            });
            this._captureSnapshot(step, expl);
        } else if (step.type === 'net_unroutable') {
            const expl = `Net ${step.net.name} is topologically unroutable (planar obstacle crossing).`;
            this.controls.setStatus(expl, 'conflict');
            this.controls.updateSearchHud({
                net: step.net,
                action: 'Blocked',
                explanation: expl
            });
            this._captureSnapshot(step, expl);
        }
    }

    _handleRoutingCompleted(summary, elapsedMs) {
        this.isRunning = false;
        this.activeRouterGenerator = null;
        if (this.timerId) clearTimeout(this.timerId);

        const btn = document.getElementById('btn-route');
        if (btn) {
            btn.innerHTML = '<i data-lucide="rotate-ccw"></i> Route Again';
            if (window.lucide) lucide.createIcons();
        }

        if (summary) {
            summary.executionTimeMs = elapsedMs;
            if (summary.ripUpHistory) {
                for (const item of summary.ripUpHistory) {
                    if (item.rippedNet && item.rippedPath) {
                        this.canvas.addRippedPath(item.rippedNet, item.rippedPath);
                    }
                }
            }
            this.controls.updateMetrics(summary);
            this.controls.renderNetlist(this.nets, this.routedDataMap);

            if (summary.success) {
                this.controls.setStatus(`Routing Complete! 100% Routed (${summary.netsRouted}/${summary.netsTotal} Nets)`, 'success');
            } else {
                this.controls.setStatus(`Routing Completed with ${summary.netsUnrouted} unroutable net(s).`, 'conflict');
            }

            // Save metrics to PHP/SQL backend log
            this._logRoutingResult(summary);
        }
    }

    async _logRoutingResult(summary) {
        try {
            const payload = {
                algorithm: this.currentAlgorithm,
                nets_total: summary.netsTotal,
                nets_routed: summary.netsRouted,
                nodes_explored: summary.totalNodesExplored,
                conflicts_detected: summary.totalConflicts,
                ripups_performed: summary.totalRipups,
                total_wire_length_mm: summary.totalWireLengthMm,
                execution_time_ms: summary.executionTimeMs
            };

            let res = await fetch('api/boards?action=log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(() => null);

            if (!res || !res.ok) {
                await fetch('api/boards.php?action=log', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(() => null);
            }
        } catch (e) {
            console.log('Metrics logging skipped:', e);
        }
    }

    async saveCurrentBoard() {
        const title = prompt('Enter a title for this board layout:', 'My Custom PCB Layout');
        if (!title) return;

        const boardPayload = {
            title: title.trim(),
            components: this.components.map(c => c.toJSON()),
            netlist: this.nets
        };

        // Always save to browser localStorage for offline & serverless resilience
        try {
            const localList = JSON.parse(localStorage.getItem('pcb_saved_boards') || '[]');
            const localId = Date.now();
            const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
            localList.unshift({
                id: localId,
                title: title.trim(),
                created_at: nowStr,
                updated_at: nowStr,
                components: boardPayload.components,
                netlist: boardPayload.netlist
            });
            localStorage.setItem('pcb_saved_boards', JSON.stringify(localList.slice(0, 30)));
        } catch (e) {
            console.warn('Could not cache board to localStorage:', e);
        }

        // Also try backend API
        let apiSaved = false;
        try {
            let res = await fetch('api/boards', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(boardPayload)
            }).catch(() => null);

            if (!res || !res.ok) {
                res = await fetch('api/boards.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(boardPayload)
                }).catch(() => null);
            }

            if (res && res.ok) {
                const data = await res.json();
                if (data.success) apiSaved = true;
            }
        } catch (e) {
            // Handled via local storage
        }

        alert(`Board "${title}" saved successfully!`);
    }

    async showLoadBoardDialog() {
        let boards = [];

        // 1. Try remote API
        try {
            let res = await fetch('api/boards').catch(() => null);
            if (!res || !res.ok) {
                res = await fetch('api/boards.php').catch(() => null);
            }
            if (res && res.ok) {
                const json = await res.json();
                if (json.success && Array.isArray(json.data)) {
                    boards = json.data;
                }
            }
        } catch (e) {
            console.log('Remote boards lookup skipped:', e);
        }

        // 2. Merge with localStorage boards
        try {
            const localList = JSON.parse(localStorage.getItem('pcb_saved_boards') || '[]');
            if (Array.isArray(localList)) {
                for (const lb of localList) {
                    if (!boards.find(b => b.id == lb.id)) {
                        boards.push(lb);
                    }
                }
            }
        } catch (e) {
            console.warn('LocalStorage lookup skipped:', e);
        }

        if (boards.length === 0) {
            alert('No saved boards found. Customize the circuit and click Save first!');
            return;
        }

        const names = boards.map(b => `#${b.id}: ${b.title} (${b.created_at || 'Saved'})`).join('\n');
        const selectedId = prompt(`Select Board ID to load:\n\n${names}`);
        if (!selectedId) return;

        const targetId = selectedId.trim().replace(/^#/, '');

        // Check in-memory/localStorage list first
        const localMatch = boards.find(b => String(b.id) === targetId && b.components && b.netlist);
        if (localMatch) {
            this.applyPresetData({
                name: localMatch.title,
                components: localMatch.components,
                netlist: localMatch.netlist
            });
            return;
        }

        // Otherwise fetch full details from API
        try {
            let boardRes = await fetch(`api/boards?id=${encodeURIComponent(targetId)}`).catch(() => null);
            if (!boardRes || !boardRes.ok) {
                boardRes = await fetch(`api/boards.php?id=${encodeURIComponent(targetId)}`).catch(() => null);
            }
            if (boardRes && boardRes.ok) {
                const boardJson = await boardRes.json();
                if (boardJson.success && boardJson.data) {
                    this.applyPresetData({
                        name: boardJson.data.title,
                        components: boardJson.data.components,
                        netlist: boardJson.data.netlist
                    });
                    return;
                }
            }
        } catch (e) {
            console.error('Failed to load board by id:', e);
        }

        alert(`Could not load board #${targetId}.`);
    }

    showAddNetDialog() {
        const allPins = [];
        for (const comp of this.components) {
            for (const p of comp.getPins()) {
                allPins.push(`${p.id} (${comp.shortName})`);
            }
        }

        const src = prompt(`Enter Source Pin ID:\nAvailable: ${allPins.join(', ')}`, 'B+');
        if (!src) return;
        const tgt = prompt(`Enter Target Pin ID:\nAvailable: ${allPins.join(', ')}`, 'D-A');
        if (!tgt) return;

        const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];
        const newNet = {
            id: `net_${Date.now()}`,
            name: `Net ${this.nets.length + 1} (${src}➜${tgt})`,
            source: src.trim(),
            target: tgt.trim(),
            color: colors[this.nets.length % colors.length],
            path: null
        };

        this.nets.push(newNet);
        this.resetRouting();
        this.controls.renderNetlist(this.nets, this.routedDataMap);
        this.controls.setStatus(`Added net: ${newNet.name}`, 'ready');
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PcbApp();
    if (window.lucide) {
        lucide.createIcons();
    }
});
