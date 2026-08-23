/**
 * app.js - Main Application Orchestrator for PCB AutoRoute AI Visualizer
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

        this.canvasElement = document.getElementById('pcb-canvas');
        this.canvas = new PcbCanvas(this.canvasElement, this.grid, {
            onComponentMoved: (comp) => this.onComponentMoved(comp),
            onPinClicked: (pin) => this.onPinClicked(pin),
            onSelectionChanged: (comp) => this.onSelectionChanged(comp)
        });

        this.treeModal = new StateSpaceTreeModal();
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
            const res = await fetch('api/presets.php');
            const json = await res.json();
            if (json.success && json.data) {
                this.presets = json.data;
                const select = document.getElementById('preset-select');
                if (select) {
                    select.innerHTML = '<option value="" disabled>-- Select Preset Circuit --</option>';
                    json.data.forEach((p, idx) => {
                        const opt = document.createElement('option');
                        opt.value = p.id;
                        opt.textContent = p.name;
                        if (idx === 0) opt.selected = true;
                        select.appendChild(opt);
                    });
                }
            }
        } catch (e) {
            console.warn('Could not load presets from backend, using fallback:', e);
            this.loadFallbackCircuit();
        }
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

        if (routed && routed.tree) {
            const algoInfo = ALGORITHMS[this.currentAlgorithm]?.name || this.currentAlgorithm;
            this.treeModal.show(pin, net, routed.tree, algoInfo);
        } else {
            // Find if any net was routed from this pin
            this.controls.setStatus(`Pin ${pin.label} clicked. Run routing to view search tree!`, 'idle');
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

    resetRouting() {
        this.pauseRouting();
        this.activeRouterGenerator = null;
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

        const btn = document.getElementById('btn-route');
        if (btn) {
            btn.innerHTML = '<i data-lucide="play"></i> Auto Route All';
            if (window.lucide) lucide.createIcons();
        }
        this.controls.setStatus('Ready to Route', 'ready');
    }

    _processRouterStep(step) {
        if (!step) return;

        if (step.type === 'search_step') {
            this.canvas.setSearchState(step.visited, step.frontier, step.currentNode);
            this.controls.updateMetrics({
                netsRouted: this.routedDataMap.size,
                netsTotal: this.nets.length,
                totalNodesExplored: step.totalNodesExplored
            });
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
        } else if (step.type === 'conflict_detected') {
            this.controls.setStatus(`Conflict detected on ${step.net.name}! Initiating Rip-Up...`, 'conflict');
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
            this.controls.setStatus(`Ripped up ${step.rippedNet.name}. Rerouting with congestion penalty...`, 'conflict');
        } else if (step.type === 'net_unroutable') {
            this.controls.setStatus(`Net ${step.net.name} is topologically unroutable (planar conflict)`, 'conflict');
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
            await fetch('api/boards.php?action=log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    algorithm: this.currentAlgorithm,
                    nets_total: summary.netsTotal,
                    nets_routed: summary.netsRouted,
                    nodes_explored: summary.totalNodesExplored,
                    conflicts_detected: summary.totalConflicts,
                    ripups_performed: summary.totalRipups,
                    total_wire_length_mm: summary.totalWireLengthMm,
                    execution_time_ms: summary.executionTimeMs
                })
            });
        } catch (e) {
            console.log('Metrics logging skipped:', e);
        }
    }

    async saveCurrentBoard() {
        const title = prompt('Enter a title for this board layout:', 'My Custom PCB Layout');
        if (!title) return;

        try {
            const res = await fetch('api/boards.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    components: this.components.map(c => c.toJSON()),
                    netlist: this.nets
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Board "${title}" saved successfully to SQLite database!`);
            } else {
                alert(`Error saving board: ${data.error}`);
            }
        } catch (e) {
            alert('Failed to connect to PHP backend database.');
        }
    }

    async showLoadBoardDialog() {
        try {
            const res = await fetch('api/boards.php');
            const json = await res.json();
            if (json.success && json.data && json.data.length > 0) {
                const names = json.data.map(b => `#${b.id}: ${b.title} (${b.created_at})`).join('\n');
                const selectedId = prompt(`Select Board ID to load:\n\n${names}`);
                if (selectedId) {
                    const boardRes = await fetch(`api/boards.php?id=${parseInt(selectedId, 10)}`);
                    const boardJson = await boardRes.json();
                    if (boardJson.success && boardJson.data) {
                        this.applyPresetData({
                            name: boardJson.data.title,
                            components: boardJson.data.components,
                            netlist: boardJson.data.netlist
                        });
                    }
                }
            } else {
                alert('No saved boards found in database. Save one first!');
            }
        } catch (e) {
            alert('Failed to retrieve boards from backend.');
        }
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
