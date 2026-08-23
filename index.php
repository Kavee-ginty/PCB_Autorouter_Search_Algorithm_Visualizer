<?php
/**
 * index.php - Main entrypoint for PCB AutoRoute AI Visualizer
 */
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PCB AutoRoute AI Visualizer • 50x40mm Single-Layer Router</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/tree.css">
    <script src="js/vendor/lucide.min.js"></script>
</head>
<body>

    <!-- Application Header -->
    <header class="app-header">
        <div class="brand-container">
            <div class="brand-icon">
                <i data-lucide="circuit-board"></i>
            </div>
            <div class="brand-title">
                <h1>PCB AutoRoute AI Visualizer</h1>
                <p class="brand-subtitle">50 mm × 40 mm (10×8 Grid, 5 mm Pitch) Single-Layer AI Pathfinding & Conflict Engine</p>
            </div>
        </div>
        <div class="header-actions">
            <span id="status-badge" class="status-badge status-ready">Ready to Route</span>
            <button id="btn-save-board" class="btn btn-secondary" title="Save Layout to Database">
                <i data-lucide="save"></i> Save Layout
            </button>
            <button id="btn-load-board" class="btn btn-secondary" title="Load Layout from Database">
                <i data-lucide="folder-open"></i> Load Layout
            </button>
        </div>
    </header>

    <!-- Main Workspace Layout -->
    <main class="main-layout">

        <!-- Left Controls & Configuration Panel -->
        <aside class="sidebar-panel">
            
            <!-- Preset Circuits -->
            <div class="panel-section">
                <div class="section-header">
                    <i data-lucide="layers"></i> Circuit Preset
                </div>
                <div class="form-group">
                    <select id="preset-select" class="select-input">
                        <option value="" disabled selected>Loading Presets...</option>
                    </select>
                </div>
            </div>

            <!-- Algorithm Selection -->
            <div class="panel-section">
                <div class="section-header">
                    <i data-lucide="cpu"></i> AI Search Algorithm
                </div>
                <div class="form-group">
                    <label class="form-label" for="algo-select">Select Pathfinding Method:</label>
                    <select id="algo-select" class="select-input">
                        <optgroup label="Informed Search (Heuristic-Guided)">
                            <option value="astar" selected>A* Search (Optimal f = g + h)</option>
                            <option value="greedy">Greedy Best-First Search</option>
                        </optgroup>
                        <optgroup label="Uninformed Search (Systematic)">
                            <option value="bfs">Breadth-First Search (BFS)</option>
                            <option value="ucs">Uniform Cost Search (UCS)</option>
                            <option value="bidirectional">Bidirectional Search (BDS)</option>
                            <option value="ids">Iterative Deepening Search (IDS)</option>
                            <option value="dfs">Depth-First Search (DFS)</option>
                            <option value="dls">Depth-Limited Search (DLS)</option>
                        </optgroup>
                    </select>
                </div>

                <!-- Depth Limit (for DLS) -->
                <div id="depth-limit-container" class="form-group" style="display: none;">
                    <label class="form-label" for="depth-limit-input">Max Depth Cutoff Limit (L):</label>
                    <input type="number" id="depth-limit-input" class="text-input" value="12" min="1" max="40">
                </div>

                <!-- Heuristic Option (for A* / Greedy) -->
                <div id="heuristic-container" class="form-group">
                    <label class="form-label" for="heuristic-select">Distance Metric Heuristic:</label>
                    <select id="heuristic-select" class="select-input">
                        <option value="euclidean" selected>Euclidean Distance √((Δx)²+(Δy)²)</option>
                        <option value="manhattan">Manhattan Distance (|Δx|+|Δy|)</option>
                    </select>
                </div>
            </div>

            <!-- Execution Controls -->
            <div class="panel-section">
                <div class="section-header">
                    <i data-lucide="play-circle"></i> Execution Controller
                </div>
                
                <button id="btn-route" class="btn btn-primary btn-full">
                    <i data-lucide="play"></i> Auto Route All
                </button>

                <div class="btn-group">
                    <button id="btn-step" class="btn btn-secondary">
                        <i data-lucide="step-forward"></i> Single Step
                    </button>
                    <button id="btn-reset" class="btn btn-danger">
                        <i data-lucide="rotate-ccw"></i> Reset Traces
                    </button>
                </div>

                <div class="form-group" style="margin-top: 6px;">
                    <div style="display: flex; justify-content: space-between;">
                        <label class="form-label">Step Animation Delay:</label>
                        <span id="speed-value" class="slider-val">40ms</span>
                    </div>
                    <div class="slider-container">
                        <input type="range" id="speed-slider" class="slider-input" min="0" max="250" step="10" value="40">
                    </div>
                </div>
            </div>

            <!-- Component Legend -->
            <div class="panel-section">
                <div class="section-header">
                    <i data-lucide="box"></i> Through-Hole Components
                </div>
                <div class="legend-grid">
                    <div class="legend-item"><span class="legend-dot" style="background: #dc2626;"></span> Battery (BT1)</div>
                    <div class="legend-item"><span class="legend-dot" style="background: #d97706;"></span> Switch (S1)</div>
                    <div class="legend-item"><span class="legend-dot" style="background: #059669;"></span> Sensor (RLDR)</div>
                    <div class="legend-item"><span class="legend-dot" style="background: #2563eb;"></span> Resistor (R1)</div>
                    <div class="legend-item"><span class="legend-dot" style="background: #7c3aed;"></span> LED (D1)</div>
                </div>
                <p style="font-size: 0.72rem; color: var(--text-muted); margin-top: 4px;">
                    💡 <em>Tip: Drag to move. Double-click or Right-click to rotate 90°.</em>
                </p>
            </div>

        </aside>

        <!-- Center Canvas PCB Board -->
        <section class="canvas-workspace">
            <canvas id="pcb-canvas"></canvas>
            <div class="canvas-hint">
                <i data-lucide="info" style="width: 14px; height: 14px;"></i>
                <span>Click any component pin after routing to explore its State-Space Tree</span>
            </div>
        </section>

        <!-- Right Netlist & Metrics Panel -->
        <aside class="sidebar-panel">
            
            <!-- Real-Time Metrics -->
            <div class="panel-section">
                <div class="section-header">
                    <i data-lucide="bar-chart-2"></i> Performance HUD
                </div>
                <div class="metrics-grid">
                    <div class="metric-card">
                        <span class="metric-label">Nets Routed</span>
                        <span id="metric-nets" class="metric-value">0/5</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-label">Nodes Explored</span>
                        <span id="metric-explored" class="metric-value">0</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-label">Wire Length</span>
                        <span id="metric-length" class="metric-value">0.0 mm</span>
                    </div>
                    <div class="metric-card">
                        <span class="metric-label">Rip-Up Retries</span>
                        <span id="metric-ripups" class="metric-value">0</span>
                    </div>
                </div>
                <div class="metric-card" style="margin-top: 4px;">
                    <span class="metric-label">Execution Time</span>
                    <span id="metric-time" class="metric-value" style="color: #38bdf8;">0.0 ms</span>
                </div>
            </div>

            <!-- Netlist / Connections Manager -->
            <div class="panel-section">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="section-header">
                        <i data-lucide="git-branch"></i> Schematic Netlist
                    </div>
                    <button id="btn-add-net" class="btn btn-secondary" style="padding: 4px 8px; font-size: 0.72rem;">
                        <i data-lucide="plus"></i> Add Net
                    </button>
                </div>
                
                <div id="netlist-items" class="netlist-container">
                    <!-- Dynamic netlist cards rendered here -->
                </div>
            </div>

        </aside>

    </main>

    <!-- State-Space Tree Exploration Modal -->
    <div id="tree-modal" class="tree-modal-backdrop hidden">
        <div class="tree-modal-container">
            <div class="tree-modal-header">
                <div class="tree-header-info">
                    <h2 id="tree-modal-title" class="tree-modal-title">
                        <i data-lucide="git-commit"></i> State-Space Exploration Tree
                    </h2>
                    <div id="tree-modal-stats" class="tree-modal-stats">
                        Loading tree structure...
                    </div>
                </div>
                <div class="tree-header-controls">
                    <button id="tree-zoom-in" class="tree-btn-icon" title="Zoom In"><i data-lucide="zoom-in"></i></button>
                    <button id="tree-zoom-out" class="tree-btn-icon" title="Zoom Out"><i data-lucide="zoom-out"></i></button>
                    <button id="tree-zoom-reset" class="tree-btn-icon" title="Reset View"><i data-lucide="maximize-2"></i></button>
                    <button id="tree-modal-close" class="tree-btn-icon" title="Close"><i data-lucide="x"></i></button>
                </div>
            </div>
            
            <div class="tree-modal-body">
                <div id="tree-svg-container"></div>

                <div class="tree-legend-bar">
                    <div class="tree-legend-pill"><span class="pill-dot dot-solution"></span> Solution Path</div>
                    <div class="tree-legend-pill"><span class="pill-dot dot-visited"></span> Visited / Closed Set</div>
                    <div class="tree-legend-pill"><span class="pill-dot dot-frontier"></span> Open Set / Frontier</div>
                    <div class="tree-legend-pill"><span class="pill-dot dot-pruned"></span> Pruned / Cutoff</div>
                </div>

                <div class="tree-instructions">
                    <span>🖱 Drag to Pan • Scroll to Zoom</span>
                </div>
            </div>
        </div>
    </div>

    <!-- Application Script Module -->
    <script type="module" src="js/app.js"></script>
</body>
</html>
