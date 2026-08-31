export const ALGORITHM_INFO_DATA = {
    bfs: {
        name: 'Breadth-First Search (BFS)',
        strategy: 'Explores nodes level by level using a FIFO queue.',
        complete: 'Yes',
        optimal: 'Yes (for unweighted graphs)',
        time: 'O(V + E)',
        space: 'O(V)'
    },
    dfs: {
        name: 'Depth-First Search (DFS)',
        strategy: 'Explores as deep as possible using a LIFO stack.',
        complete: 'No (can get stuck in cycles)',
        optimal: 'No',
        time: 'O(V + E)',
        space: 'O(V)'
    },
    dls: {
        name: 'Depth-Limited Search (DLS)',
        strategy: 'DFS with a maximum depth limit to prevent infinite loops.',
        complete: 'No (only if goal within limit)',
        optimal: 'No',
        time: 'O(b^l)',
        space: 'O(l)'
    },
    ids: {
        name: 'Iterative Deepening Search (IDS)',
        strategy: 'Repeatedly applies DLS with increasing limits.',
        complete: 'Yes',
        optimal: 'Yes (for unweighted graphs)',
        time: 'O(b^d)',
        space: 'O(d)'
    },
    ucs: {
        name: 'Uniform Cost Search (UCS)',
        strategy: 'Always expands lowest-cost node using a priority queue.',
        complete: 'Yes',
        optimal: 'Yes',
        time: 'O(b^(1 + C*/ε))',
        space: 'O(b^(1 + C*/ε))'
    },
    bidirectional: {
        name: 'Bidirectional Search (BDS)',
        strategy: 'Searches from both source and goal simultaneously.',
        complete: 'Yes',
        optimal: 'Yes (for unweighted graphs)',
        time: 'O(b^(d/2))',
        space: 'O(b^(d/2))'
    },
    greedy: {
        name: 'Greedy Best-First Search',
        strategy: 'Expands node that appears closest to goal using heuristic h(n).',
        complete: 'No',
        optimal: 'No',
        time: 'O(b^m)',
        space: 'O(b^m)'
    },
    astar: {
        name: 'A* Search',
        strategy: 'Uses f(n) = g(n) + h(n) to find optimal path efficiently.',
        complete: 'Yes',
        optimal: 'Yes (with admissible heuristic)',
        time: 'O(b^d)',
        space: 'O(b^d)'
    }
};

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
        this.btnStepBack = document.getElementById('btn-step-back');
        this.btnReset = document.getElementById('btn-reset');
        this.speedSlider = document.getElementById('speed-slider');
        this.speedValue = document.getElementById('speed-value');

        // Search Step HUD elements
        this.hudNetBadge = document.getElementById('hud-net-badge');
        this.hudActionBadge = document.getElementById('hud-action-badge');
        this.hudNodeCoord = document.getElementById('hud-node-coord');
        this.hudDepthEdges = document.getElementById('hud-depth-edges');
        this.hudGVal = document.getElementById('hud-g-val');
        this.hudHVal = document.getElementById('hud-h-val');
        this.hudFVal = document.getElementById('hud-f-val');
        this.hudExplanation = document.getElementById('hud-explanation');

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

        // Export buttons
        this.btnExportPng = document.getElementById('btn-export-png');
        this.btnExportMetricsPng = document.getElementById('btn-export-metrics-png');
        this.btnExportMetricsCard = document.getElementById('btn-export-metrics-card');
        this.btnExportSvg = document.getElementById('btn-export-svg');
        this.btnExportJson = document.getElementById('btn-export-json');
        this.btnExportCsv = document.getElementById('btn-export-csv');

        // Live Data Panel elements (matching aisearch-v2)
        this.fringeList = document.getElementById('fringe-list');
        this.visitedList = document.getElementById('visited-list');
        this.traversalList = document.getElementById('traversal-list');
        this.pathList = document.getElementById('path-list');
        this.informedSearchInfo = document.getElementById('informed-search-info');
        this.fScore = document.getElementById('f-score');
        this.pathCostCurrent = document.getElementById('path-cost-current');
        this.dataNetSelect = document.getElementById('data-net-select');
        this.dataNetStatus = document.getElementById('data-net-status');

        // Canvas View Controls
        this.btnCanvasResetView = document.getElementById('btn-canvas-reset-view');

        this._attachEventListeners();
        this.updateAlgorithmInfo(this.app?.currentAlgorithm || 'astar');
        this.resetLiveDataPanel();
    }

    updateAlgorithmInfo(algoKey) {
        const info = ALGORITHM_INFO_DATA[algoKey] || ALGORITHM_INFO_DATA['astar'];
        const nameEl = document.getElementById('algo-info-name');
        const stratEl = document.getElementById('algo-info-strategy');
        const compEl = document.getElementById('algo-info-complete');
        const optEl = document.getElementById('algo-info-optimal');
        const timeEl = document.getElementById('algo-info-time');
        const spaceEl = document.getElementById('algo-info-space');

        if (nameEl) nameEl.textContent = info.name;
        if (stratEl) stratEl.textContent = info.strategy;
        if (compEl) compEl.textContent = info.complete;
        if (optEl) optEl.textContent = info.optimal;
        if (timeEl) timeEl.textContent = info.time;
        if (spaceEl) spaceEl.textContent = info.space;
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

                this.updateAlgorithmInfo(algo);
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

        if (this.btnStepBack) {
            this.btnStepBack.addEventListener('click', () => {
                this.app.stepBack();
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

        // Export Option handlers
        if (this.btnExportPng) {
            this.btnExportPng.addEventListener('click', () => this.exportPng());
        }
        if (this.btnExportMetricsPng) {
            this.btnExportMetricsPng.addEventListener('click', () => this.exportMetricsAndLiveDataPng());
        }
        if (this.btnExportMetricsCard) {
            this.btnExportMetricsCard.addEventListener('click', () => this.exportMetricsAndLiveDataPng());
        }
        if (this.btnExportSvg) {
            this.btnExportSvg.addEventListener('click', () => this.exportSvg());
        }
        if (this.btnExportJson) {
            this.btnExportJson.addEventListener('click', () => this.exportJson());
        }
        if (this.btnExportCsv) {
            this.btnExportCsv.addEventListener('click', () => this.exportCsv());
        }

        // Canvas View Controls
        if (this.btnCanvasResetView) {
            this.btnCanvasResetView.addEventListener('click', () => {
                this.app.canvas.resetView();
                this.setStatus('PCB Centered & View Reset', 'ready');
            });
        }

        // Live Data Net selector
        if (this.dataNetSelect) {
            this.dataNetSelect.addEventListener('change', () => {
                const val = this.dataNetSelect.value;
                this.updateInspectStatusBadge(val);
                if (this.app?.onInspectNetChanged) {
                    this.app.onInspectNetChanged(val);
                }
            });
        }
    }

    async exportPng() {
        const canvas = this.app.canvas.canvas;
        if (!canvas) return;

        this.setStatus('Generating PNG exports for PCB & Search Trees...', 'conflict');

        const filesToExport = [];

        // 1. PCB Board Layout PNG
        const pcbDataUrl = canvas.toDataURL('image/png');
        filesToExport.push({
            name: 'pcb-layout.png',
            dataUrl: pcbDataUrl
        });

        // 2. Search Tree PNG for each routed net
        if (this.app.routedDataMap && this.app.routedDataMap.size > 0) {
            let netIndex = 1;
            for (const [netId, routedInfo] of this.app.routedDataMap) {
                if (routedInfo && routedInfo.tree) {
                    const net = this.app.nets.find(n => n.id === netId);
                    const netName = (net?.name || `Net-${netIndex}`).replace(/[^a-zA-Z0-9_-]/g, '_');
                    try {
                        const { svgString, width, height } = this.generateTreeSvg(routedInfo.tree);
                        const treePngUrl = await this.svgStringToPng(svgString, width, height);
                        filesToExport.push({
                            name: `search-tree-${netName}.png`,
                            dataUrl: treePngUrl
                        });
                    } catch (e) {
                        console.warn(`Could not render tree PNG for net ${netName}:`, e);
                    }
                    netIndex++;
                }
            }
        }

        // Package all into ZIP via JSZip
        if (window.JSZip && filesToExport.length > 1) {
            try {
                const zip = new window.JSZip();
                for (const file of filesToExport) {
                    const base64Data = file.dataUrl.split(',')[1];
                    zip.file(file.name, base64Data, { base64: true });
                }
                const content = await zip.generateAsync({ type: 'blob' });
                const zipUrl = URL.createObjectURL(content);
                this._downloadFile(zipUrl, 'pcb-and-search-trees-png.zip');
                URL.revokeObjectURL(zipUrl);
            } catch (err) {
                console.warn('ZIP bundling error:', err);
            }
        }

        // Trigger individual PNG downloads
        filesToExport.forEach((file, idx) => {
            setTimeout(() => {
                this._downloadFile(file.dataUrl, file.name);
            }, idx * 200);
        });

        this.setStatus(`Exported ${filesToExport.length} PNGs (PCB + Search Trees)`, 'ready');
    }

    async exportMetricsAndLiveDataPng() {
        this.setStatus('Generating Performance & Live Data PNG snapshot...', 'conflict');

        const dpr = 2; // High-DPI crisp Retina export
        const sidebarEl = document.querySelector('.sidebar-panel');
        // Exact displayed width of the panel in the UI
        const width = sidebarEl ? Math.max(320, Math.round(sidebarEl.getBoundingClientRect().width)) : 340;
        const padX = 8;
        const cardW = width - (padX * 2);
        const cardInnerW = cardW - 20; // 10px internal card padding

        // 1. Gather live DOM data
        const metrics = [
            { label: 'NETS ROUTED', val: this.metricNets?.textContent || '0/0' },
            { label: 'NODES EXPLORED', val: this.metricExplored?.textContent || '0' },
            { label: 'WIRE LENGTH', val: this.metricLength?.textContent || '0.0 mm' },
            { label: 'RIP-UP RETRIES', val: this.metricRipups?.textContent || '0' },
            { label: 'EXECUTION TIME', val: this.metricTime?.textContent || '0.0 ms', color: '#0284c7' }
        ];

        const netInspectText = this.dataNetSelect?.options[this.dataNetSelect.selectedIndex]?.text || '⚡ Active / Live Step';
        const inspectStatus = this.dataNetStatus?.textContent || 'Live';

        const extractChips = (elementId) => {
            const el = document.getElementById(elementId);
            if (!el) return [];
            const items = el.querySelectorAll('.array-item');
            if (items && items.length > 0) {
                return Array.from(items).map(span => span.textContent.trim());
            }
            const text = el.textContent.trim();
            if (text === 'Empty' || text === 'No path found yet') return [];
            return text ? [text] : [];
        };

        const fringeChips = extractChips('fringe-list');
        const visitedChips = extractChips('visited-list');
        const traversalChips = extractChips('traversal-list');
        const pathChips = extractChips('path-list');

        const isInformed = (this.app.currentAlgorithm === 'astar' || this.app.currentAlgorithm === 'greedy' || this.app.currentAlgorithm === 'ucs');
        const fScoreText = this.fScore?.textContent || 'g(0) + h(0) = 0';
        const pathCostText = this.pathCostCurrent?.textContent || '0.0 mm';

        // Helper to measure dynamic box height inside exact value box width
        const innerBoxW = cardInnerW - 20; // 10px padding on .data-display
        const measureBoxHeight = (items) => {
            if (!items || items.length === 0) return 26;
            let curX = 14;
            let lines = 1;
            const itemH = 18;
            const lineGap = 4;
            for (let i = 0; i < items.length; i++) {
                const text = items[i];
                const chipW = (text.length * 6.4) + 12;
                if (curX + chipW > innerBoxW - 10) {
                    curX = 14;
                    lines++;
                }
                curX += chipW + 4;
            }
            return Math.max(26, lines * (itemH + lineGap) + 6);
        };

        const fringeH = measureBoxHeight(fringeChips);
        const visitedH = measureBoxHeight(visitedChips);
        const traversalH = measureBoxHeight(traversalChips);
        const pathH = measureBoxHeight(pathChips);

        // Height calculations
        const card1H = 204;
        const dataDisplayH = 16 + fringeH + visitedH + traversalH + pathH + (4 * 19) + (isInformed ? 58 : 0);
        const card2H = 10 + 20 + 8 + 48 + dataDisplayH + 10;
        const totalHeight = 8 + card1H + 10 + card2H + 8;

        // Create High-DPI canvas
        const canvas = document.createElement('canvas');
        canvas.width = width * dpr;
        canvas.height = totalHeight * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // Background: exact --bg-secondary (#f9fafb)
        ctx.fillStyle = '#f9fafb';
        ctx.fillRect(0, 0, width, totalHeight);

        // ==========================================
        // CARD 1: Performance Metrics (Exact UI Style)
        // ==========================================
        const card1Y = 8;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(padX, card1Y, cardW, card1H, 8);
        else ctx.rect(padX, card1Y, cardW, card1H);
        ctx.fill();
        ctx.stroke();

        // Section Header: Icon + "Performance Metrics"
        let curY = card1Y + 10;
        
        // Lucide Bar Chart Icon (Blue)
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(padX + 13, curY + 13); ctx.lineTo(padX + 13, curY + 6);
        ctx.moveTo(padX + 17, curY + 13); ctx.lineTo(padX + 17, curY + 2);
        ctx.moveTo(padX + 21, curY + 13); ctx.lineTo(padX + 21, curY + 9);
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Performance Metrics', padX + 28, curY + 11);

        // Metrics Grid (2 columns)
        const gridX = padX + 10;
        const gridY = curY + 20;
        const colW = (cardInnerW - 6) / 2;
        const miniCardH = 48;

        const drawMetricMiniCard = (label, val, x, y, w, h, valColor = '#0f172a') => {
            ctx.fillStyle = '#f8fafc';
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(x, y, w, h, 6);
            else ctx.rect(x, y, w, h);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#64748b';
            ctx.font = 'bold 8.5px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
            ctx.fillText(label, x + 8, y + 15);

            ctx.fillStyle = valColor;
            ctx.font = 'bold 14px "JetBrains Mono", "Fira Code", monospace';
            ctx.fillText(val, x + 8, y + 36);
        };

        // Row 1: Nets Routed & Nodes Explored
        drawMetricMiniCard(metrics[0].label, metrics[0].val, gridX, gridY, colW, miniCardH);
        drawMetricMiniCard(metrics[1].label, metrics[1].val, gridX + colW + 6, gridY, colW, miniCardH);

        // Row 2: Wire Length & Rip-Up Retries
        drawMetricMiniCard(metrics[2].label, metrics[2].val, gridX, gridY + miniCardH + 6, colW, miniCardH);
        drawMetricMiniCard(metrics[3].label, metrics[3].val, gridX + colW + 6, gridY + miniCardH + 6, colW, miniCardH);

        // Row 3: Execution Time (full width)
        drawMetricMiniCard(metrics[4].label, metrics[4].val, gridX, gridY + (miniCardH + 6) * 2, cardInnerW, 40, '#0284c7');

        // ==========================================
        // CARD 2: Live Data Panel (Exact UI Style)
        // ==========================================
        const card2Y = card1Y + card1H + 10;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(padX, card2Y, cardW, card2H, 8);
        else ctx.rect(padX, card2Y, cardW, card2H);
        ctx.fill();
        ctx.stroke();

        let curY2 = card2Y + 10;

        // Activity Icon (Blue)
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(padX + 11, curY2 + 8);
        ctx.lineTo(padX + 14, curY2 + 8);
        ctx.lineTo(padX + 17, curY2 + 3);
        ctx.lineTo(padX + 20, curY2 + 13);
        ctx.lineTo(padX + 23, curY2 + 8);
        ctx.lineTo(padX + 26, curY2 + 8);
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Live Data Panel', padX + 31, curY2 + 11);

        // Status Badge (Right aligned in header)
        const badgeText = inspectStatus;
        ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif';
        const badgeW = ctx.measureText(badgeText).width + 12;
        const badgeX = padX + cardW - 10 - badgeW;
        ctx.fillStyle = inspectStatus === 'Routed' ? 'rgba(16,185,129,0.12)' : (inspectStatus === 'Pending' ? 'rgba(245,158,11,0.12)' : 'rgba(37,99,235,0.08)');
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(badgeX, curY2 - 1, badgeW, 17, 9);
        else ctx.rect(badgeX, curY2 - 1, badgeW, 17);
        ctx.fill();
        ctx.fillStyle = inspectStatus === 'Routed' ? '#059669' : (inspectStatus === 'Pending' ? '#d97706' : '#2563eb');
        ctx.fillText(badgeText, badgeX + 6, curY2 + 11);

        // Dropdown Select Box Simulation
        let formY = curY2 + 20;
        ctx.fillStyle = '#475569';
        ctx.font = '500 9.5px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText('Inspect Trace / Net:', padX + 10, formY + 8);

        formY += 13;
        ctx.fillStyle = '#f8fafc';
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(padX + 10, formY, cardInnerW, 25, 4);
        else ctx.rect(padX + 10, formY, cardInnerW, 25);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#0f172a';
        ctx.font = '10.5px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(netInspectText, padX + 18, formY + 16);

        // Dropdown arrow
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(padX + 10 + cardInnerW - 14, formY + 10);
        ctx.lineTo(padX + 10 + cardInnerW - 10, formY + 14);
        ctx.lineTo(padX + 10 + cardInnerW - 6, formY + 10);
        ctx.stroke();

        // Data Display Outer Box (.data-display)
        let dispY = formY + 31;
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(padX + 10, dispY, cardInnerW, dataDisplayH, 6);
        else ctx.rect(padX + 10, dispY, cardInnerW, dataDisplayH);
        ctx.fill();
        ctx.stroke();

        let rowY = dispY + 8;
        const valBoxX = padX + 18;
        const valBoxW = cardInnerW - 16;

        const drawDataRow = (label, items, boxH, emptyMsg = 'Empty') => {
            ctx.fillStyle = '#475569';
            ctx.font = '600 8.5px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillText(label, valBoxX, rowY + 7);
            rowY += 11;

            // Value Box
            ctx.fillStyle = '#f8fafc';
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(valBoxX, rowY, valBoxW, boxH, 4);
            else ctx.rect(valBoxX, rowY, valBoxW, boxH);
            ctx.fill();
            ctx.stroke();

            if (!items || items.length === 0) {
                ctx.fillStyle = '#94a3b8';
                ctx.font = 'italic 9.5px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.fillText(emptyMsg, valBoxX + 6, rowY + boxH / 2 + 3);
            } else {
                let curX = valBoxX + 6;
                let lineY = rowY + 3;
                const itemH = 17;

                ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
                ctx.fillStyle = '#94a3b8';
                ctx.fillText('[', curX, lineY + 12);
                curX += 7;

                for (let i = 0; i < items.length; i++) {
                    const text = items[i];
                    const tw = ctx.measureText(text).width;
                    const cw = tw + 6;

                    if (curX + cw + 10 > valBoxX + valBoxW - 4) {
                        curX = valBoxX + 13;
                        lineY += itemH + 3;
                    }

                    // Chip background & text
                    ctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(curX, lineY, cw, itemH, 3);
                    else ctx.rect(curX, lineY, cw, itemH);
                    ctx.fill();

                    ctx.fillStyle = '#2563eb';
                    ctx.fillText(text, curX + 3, lineY + 12);

                    curX += cw;

                    if (i < items.length - 1) {
                        ctx.fillStyle = '#94a3b8';
                        ctx.fillText(',', curX, lineY + 12);
                        curX += 6;
                    }
                }

                ctx.fillStyle = '#94a3b8';
                ctx.fillText(']', curX + 1, lineY + 12);
            }

            rowY += boxH + 8;
        };

        drawDataRow('OPEN LIST (FRONTIER):', fringeChips, fringeH, 'Empty');
        drawDataRow('CLOSE LIST (EXPLORED):', visitedChips, visitedH, 'Empty');
        drawDataRow('TRAVERSAL ORDER:', traversalChips, traversalH, 'Empty');
        drawDataRow('PATH FOUND:', pathChips, pathH, 'No path found yet');

        // Informed Search Info Row
        if (isInformed) {
            ctx.strokeStyle = '#e5e7eb';
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(valBoxX, rowY - 2);
            ctx.lineTo(valBoxX + valBoxW, rowY - 2);
            ctx.stroke();
            ctx.setLineDash([]);

            rowY += 4;

            ctx.fillStyle = '#475569';
            ctx.font = '600 8.5px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillText('CURRENT NODE f(n):', valBoxX, rowY + 7);
            rowY += 11;

            ctx.fillStyle = '#f8fafc';
            ctx.strokeStyle = '#e5e7eb';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(valBoxX, rowY, valBoxW, 22, 4);
            else ctx.rect(valBoxX, rowY, valBoxW, 22);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
            ctx.fillText(fScoreText, valBoxX + 6, rowY + 15);

            rowY += 28;

            ctx.fillStyle = '#475569';
            ctx.font = '600 8.5px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.fillText('PATH COST SO FAR:', valBoxX, rowY + 7);
            rowY += 11;

            ctx.fillStyle = '#f8fafc';
            ctx.strokeStyle = '#e5e7eb';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(valBoxX, rowY, valBoxW, 22, 4);
            else ctx.rect(valBoxX, rowY, valBoxW, 22);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#0f172a';
            ctx.font = 'bold 9.5px "JetBrains Mono", monospace';
            ctx.fillText(pathCostText, valBoxX + 6, rowY + 15);
        }

        // Trigger instant download
        const dataUrl = canvas.toDataURL('image/png');
        this._downloadFile(dataUrl, `pcb-performance-and-live-data-${new Date().getTime()}.png`);
        this.setStatus('Exported Performance & Live Data Snapshot as PNG', 'ready');
    }

    generateTreeSvg(rootNode) {
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
            node._y = depth * (nodeRadius * 2 + vGap) + 50;

            layoutNodes.push(node);
            if (node.children) {
                for (const child of node.children) {
                    layoutEdges.push({ from: node, to: child });
                }
            }
        }

        layoutSubtree(rootNode, 0);

        let minX = Infinity, maxX = 0;
        let minY = Infinity, maxY = 0;
        for (const n of layoutNodes) {
            if (n._x < minX) minX = n._x;
            if (n._x > maxX) maxX = n._x;
            if (n._y < minY) minY = n._y;
            if (n._y > maxY) maxY = n._y;
        }

        const width = Math.max(600, maxX + nodeRadius * 2 + 60);
        const height = Math.max(400, maxY + nodeRadius * 2 + 60);

        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\n`;
        svg += `  <rect width="${width}" height="${height}" fill="#f8fafc"/>\n`;

        // Straight Line Edges
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

            const rawCost = Math.abs((edge.to.g || 0) - (edge.from.g || 0));
            let costText = '1';
            if (rawCost > 0) {
                const gridSteps = rawCost / 5;
                costText = Number.isInteger(gridSteps) ? gridSteps.toString() : gridSteps.toFixed(1);
            }

            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const badgeW = Math.max(18, costText.length * 7 + 8);

            svg += `  <line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>\n`;
            svg += `  <rect x="${midX - badgeW / 2}" y="${midY - 8}" width="${badgeW}" height="16" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="1"/>\n`;
            svg += `  <text x="${midX}" y="${midY + 3.5}" text-anchor="middle" font-size="9" font-weight="bold" fill="#334155" font-family="sans-serif">${costText}</text>\n`;
        }

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
                fill = '#ef4444';
                stroke = '#1e293b';
                strokeWidth = 2.5;
                titleColor = '#ffffff';
                subColor = '#fee2e2';
            } else if (isGoal) {
                fill = '#10b981';
                stroke = '#1e293b';
                strokeWidth = 2.5;
                titleColor = '#ffffff';
                subColor = '#d1fae5';
            } else if (isFrontier) {
                fill = '#8b5cf6';
                stroke = '#1e293b';
                strokeWidth = 2.5;
                titleColor = '#ffffff';
                subColor = '#ede9fe';
            } else if (isSolution) {
                fill = '#ffffff';
                stroke = '#10b981';
                strokeWidth = 3.0;
                titleColor = '#0f172a';
                subColor = '#059669';
            }

            let subText = `h=${Math.round((n.h || 0) * 10) / 10}`;
            if (isGoal) {
                subText = (n.h !== undefined && n.h > 0) ? `h=${Math.round(n.h * 10) / 10}` : 'Goal';
            }

            svg += `  <circle cx="${n._x}" cy="${n._y}" r="${nodeRadius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>\n`;
            svg += `  <text x="${n._x}" y="${n._y - 4}" text-anchor="middle" fill="${titleColor}" font-size="10" font-weight="bold" font-family="monospace">${n.name}</text>\n`;
            svg += `  <text x="${n._x}" y="${n._y + 10}" text-anchor="middle" fill="${subColor}" font-size="8.5" font-weight="bold" font-family="sans-serif">${subText}</text>\n`;
        }

        svg += `</svg>`;
        return { svgString: svg, width, height };
    }

    svgStringToPng(svgString, width, height) {
        return new Promise((resolve, reject) => {
            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const URL = window.URL || window.webkitURL || window;
            const blobURL = URL.createObjectURL(svgBlob);

            const image = new Image();
            image.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');

                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(0, 0, width, height);

                ctx.strokeStyle = 'rgba(226, 232, 240, 0.7)';
                ctx.lineWidth = 1;
                for (let x = 0; x < width; x += 28) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
                }
                for (let y = 0; y < height; y += 28) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
                }

                ctx.drawImage(image, 0, 0);
                URL.revokeObjectURL(blobURL);
                resolve(canvas.toDataURL('image/png'));
            };
            image.onerror = (err) => {
                URL.revokeObjectURL(blobURL);
                reject(err);
            };
            image.src = blobURL;
        });
    }

    exportJson() {
        const data = {
            metadata: {
                version: '1.0',
                created: new Date().toISOString(),
                boardSize: '50mm x 40mm',
                grid: '10x8 (5mm Pitch)',
                algorithm: this.app.currentAlgorithm,
                heuristic: this.app.currentHeuristic
            },
            components: this.app.components.map(c => c.toJSON()),
            netlist: this.app.nets.map(n => ({
                id: n.id,
                name: n.name,
                source: n.source,
                target: n.target,
                color: n.color,
                path: n.path || null
            }))
        };
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        this._downloadFile(url, 'pcb-circuit.json');
        URL.revokeObjectURL(url);
        this.setStatus('Exported PCB circuit as JSON', 'ready');
    }

    exportCsv() {
        let routedCount = 0;
        let totalLength = 0;
        for (const net of this.app.nets) {
            if (net.path && net.path.length > 1) {
                routedCount++;
                totalLength += (net.path.length - 1) * 5;
            }
        }

        let csv = 'Metric,Value\n';
        csv += `Algorithm,${this.app.currentAlgorithm}\n`;
        csv += `Heuristic,${this.app.currentHeuristic}\n`;
        csv += `Nets Total,${this.app.nets.length}\n`;
        csv += `Nets Routed,${routedCount}\n`;
        csv += `Wire Length (mm),${totalLength.toFixed(1)}\n`;

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        this._downloadFile(url, 'pcb-routing-metrics.csv');
        URL.revokeObjectURL(url);
        this.setStatus('Exported metrics as CSV', 'ready');
    }

    exportSvg() {
        const width = 500;
        const height = 400;
        const cellSize = 40;
        const originX = 50;
        const originY = 50;

        let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">\n`;
        svg += `  <rect x="20" y="20" width="460" height="360" rx="8" fill="#188656" stroke="#ffffff" stroke-width="1.5"/>\n`;

        for (let gx = 0; gx < 10; gx++) {
            for (let gy = 0; gy < 8; gy++) {
                const px = originX + gx * cellSize;
                const py = originY + gy * cellSize;
                svg += `  <circle cx="${px}" cy="${py}" r="3.5" fill="#030a06" stroke="#d97706" stroke-width="1.2"/>\n`;
            }
        }

        for (const net of this.app.nets) {
            if (net.path && net.path.length > 1) {
                let d = '';
                for (let i = 0; i < net.path.length; i++) {
                    const coord = this.app.grid.toCoord(net.path[i]);
                    const px = originX + coord.x * cellSize;
                    const py = originY + coord.y * cellSize;
                    d += (i === 0) ? `M ${px} ${py}` : ` L ${px} ${py}`;
                }
                svg += `  <path d="${d}" stroke="${net.color}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>\n`;
            }
        }

        for (const comp of this.app.components) {
            const dims = comp.getDimensions();
            const px = originX + comp.x * cellSize - 10;
            const py = originY + comp.y * cellSize - 10;
            const pw = (dims.w - 1) * cellSize + 20;
            const ph = (dims.h - 1) * cellSize + 20;
            svg += `  <rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="4" fill="rgba(255,255,255,0.88)" stroke="#1e293b" stroke-width="1.5"/>\n`;
            svg += `  <text x="${px + pw/2}" y="${py + ph/2 + 4}" text-anchor="middle" font-size="10" font-weight="bold" font-family="sans-serif" fill="#0f172a">${comp.shortName}</text>\n`;
        }

        svg += `</svg>`;

        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        this._downloadFile(url, 'pcb-layout.svg');
        URL.revokeObjectURL(url);
        this.setStatus('Exported PCB layout as SVG', 'ready');
    }

    _downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    updateSearchHud(info = {}) {
        if (!this.hudNetBadge) return;

        if (info.net) {
            const srcName = this.getFriendlyPinName(info.net.source);
            const tgtName = this.getFriendlyPinName(info.net.target);
            this.hudNetBadge.textContent = `${srcName} ➜ ${tgtName}`;
        } else {
            this.hudNetBadge.textContent = 'No Net Active';
        }

        if (this.hudActionBadge) {
            const action = info.action || (info.currentNode !== undefined && info.currentNode !== null ? 'Exploring' : 'Ready');
            this.hudActionBadge.textContent = action;
            this.hudActionBadge.className = `hud-action-badge action-${action.toLowerCase().replace(/[^a-z]/g, '')}`;
        }

        if (this.hudNodeCoord) {
            if (info.currentNode !== undefined && info.currentNode !== null) {
                const c = this.app.grid.toCoord(info.currentNode);
                this.hudNodeCoord.textContent = c ? `(${c.x}, ${c.y}) [${c.x * 5}mm, ${c.y * 5}mm]` : '--';
            } else {
                this.hudNodeCoord.textContent = '--';
            }
        }

        if (this.hudDepthEdges) {
            const depth = info.depth !== undefined ? info.depth : (info.currentPath ? info.currentPath.length - 1 : 0);
            const edges = info.treeEdges ? info.treeEdges.length : 0;
            this.hudDepthEdges.textContent = `Depth ${depth} • ${edges} Tree Branches`;
        }

        if (this.hudGVal) {
            const g = info.g !== undefined ? info.g : (info.cost !== undefined ? info.cost : 0);
            this.hudGVal.textContent = `${g.toFixed(1)} mm`;
        }

        if (this.hudHVal) {
            const h = info.h !== undefined ? info.h : 0;
            this.hudHVal.textContent = `${h.toFixed(1)} mm`;
        }

        if (this.hudFVal) {
            const f = info.f !== undefined ? info.f : ((info.g || 0) + (info.h || 0));
            this.hudFVal.textContent = `${f.toFixed(1)} mm`;
        }

        if (this.hudExplanation) {
            this.hudExplanation.textContent = info.explanation || 'Stepping through search tree nodes and pin paths...';
        }
    }

    updateMetrics(data) {
        if (this.metricNets) this.metricNets.textContent = `${data.netsRouted || 0}/${data.netsTotal || 0}`;
        if (this.metricExplored) this.metricExplored.textContent = (data.totalNodesExplored || 0).toLocaleString();
        if (this.metricLength) this.metricLength.textContent = `${(data.totalWireLengthMm || 0).toFixed(1)} mm`;
        if (this.metricRipups) this.metricRipups.textContent = (data.totalRipups || 0).toString();
        if (this.metricTime) this.metricTime.textContent = `${(data.executionTimeMs || 0).toFixed(1)} ms`;
    }

    updateLiveDataPanel(data = {}, grid = null, algoKey = 'astar') {
        const g = grid || this.app?.grid;
        if (!g) return;

        const formatCoordinateList = (element, idList, emptyText = 'Empty') => {
            if (!element) return;
            if (!idList || idList.length === 0) {
                element.innerHTML = `<span class="array-empty">${emptyText}</span>`;
                return;
            }

            const formattedItems = idList.map(item => {
                let text = '';
                if (typeof item === 'number') {
                    const c = g.toCoord(item);
                    text = c ? `(${c.x},${c.y})` : `${item}`;
                } else if (item && typeof item === 'object' && item.x !== undefined && item.y !== undefined) {
                    text = `(${item.x},${item.y})`;
                } else {
                    text = String(item);
                }
                return `<span class="array-item">${text}</span>`;
            });

            element.innerHTML = `<span class="array-bracket">[</span> ` +
                formattedItems.join('<span class="array-comma">, </span>') +
                ` <span class="array-bracket">]</span>`;
        };

        formatCoordinateList(this.fringeList, data.frontier, 'Empty');
        formatCoordinateList(this.visitedList, data.visited, 'Empty');
        formatCoordinateList(this.traversalList, data.traversal, 'Empty');
        formatCoordinateList(this.pathList, data.path, 'No path found yet');

        // Informed Search Info
        if (this.informedSearchInfo) {
            const isHeuristic = (algoKey === 'astar' || algoKey === 'greedy' || algoKey === 'ucs');
            if (isHeuristic) {
                this.informedSearchInfo.style.display = 'block';

                const gVal = data.g !== undefined ? data.g : (data.cost !== undefined ? data.cost : 0);
                const hVal = data.h !== undefined ? data.h : 0;
                const fVal = data.f !== undefined ? data.f : (gVal + hVal);

                if (this.fScore) {
                    if (algoKey === 'greedy') {
                        this.fScore.textContent = `h(${hVal.toFixed(1)}) = ${hVal.toFixed(1)} mm`;
                    } else if (algoKey === 'astar') {
                        this.fScore.textContent = `g(${gVal.toFixed(1)}) + h(${hVal.toFixed(1)}) = ${fVal.toFixed(1)} mm`;
                    } else {
                        this.fScore.textContent = `g(${gVal.toFixed(1)}) = ${gVal.toFixed(1)} mm`;
                    }
                }

                if (this.pathCostCurrent) {
                    this.pathCostCurrent.textContent = `${gVal.toFixed(1)} mm`;
                }
            } else {
                this.informedSearchInfo.style.display = 'none';
            }
        }
    }

    resetLiveDataPanel() {
        if (this.fringeList) this.fringeList.innerHTML = '<span class="array-empty">Empty</span>';
        if (this.visitedList) this.visitedList.innerHTML = '<span class="array-empty">Empty</span>';
        if (this.traversalList) this.traversalList.innerHTML = '<span class="array-empty">Empty</span>';
        if (this.pathList) this.pathList.innerHTML = '<span class="array-empty">No path found yet</span>';
        if (this.fScore) this.fScore.textContent = 'g(0) + h(0) = 0';
        if (this.pathCostCurrent) this.pathCostCurrent.textContent = '0.0 mm';
    }

    setStatus(text, type = 'idle') {
        if (this.statusBadge) {
            this.statusBadge.textContent = text;
            this.statusBadge.className = `status-badge status-${type}`;
        }
    }

    getFriendlyPinName(pinId) {
        if (!pinId) return '';
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

        if (friendlyMap[pinId]) return friendlyMap[pinId];

        const pinInfo = this.app?.pinLookup?.get(pinId);
        if (pinInfo && this.app?.components) {
            const comp = this.app.components.find(c => c.id === pinInfo.componentId);
            if (comp) {
                const compName = comp.type.charAt(0).toUpperCase() + comp.type.slice(1);
                const label = pinInfo.label ? ` ${pinInfo.label}` : '';
                return `${compName}${label}`;
            }
        }

        return pinId;
    }

    renderInspectNetDropdown(nets, routedMap = new Map(), currentSelectedId = null) {
        if (!this.dataNetSelect) return;
        const selectedVal = currentSelectedId !== null ? currentSelectedId : this.dataNetSelect.value || 'active';
        this.dataNetSelect.innerHTML = '';

        const optActive = document.createElement('option');
        optActive.value = 'active';
        optActive.textContent = '⚡ Active / Live Step';
        this.dataNetSelect.appendChild(optActive);

        nets.forEach(net => {
            const opt = document.createElement('option');
            opt.value = net.id;
            const isRouted = routedMap.has(net.id);
            const rInfo = routedMap.get(net.id);
            const len = (isRouted && rInfo?.path) ? `${((rInfo.path.length - 1) * 5).toFixed(0)}mm` : 'Pending';
            opt.textContent = `${isRouted ? '✅' : '⏳'} ${net.name} [${len}]`;
            this.dataNetSelect.appendChild(opt);
        });

        // Retain or select previous choice if exists
        const optionExists = Array.from(this.dataNetSelect.options).some(o => o.value === selectedVal);
        if (optionExists) {
            this.dataNetSelect.value = selectedVal;
        } else {
            this.dataNetSelect.value = 'active';
        }

        this.updateInspectStatusBadge(this.dataNetSelect.value);
    }

    updateInspectStatusBadge(selectedVal) {
        if (!this.dataNetStatus) return;
        if (selectedVal === 'active') {
            this.dataNetStatus.textContent = 'Live';
            this.dataNetStatus.style.color = '#2563eb';
            this.dataNetStatus.style.background = 'rgba(37,99,235,0.08)';
        } else {
            const isRouted = this.app?.routedDataMap?.has(selectedVal);
            if (isRouted) {
                this.dataNetStatus.textContent = 'Routed';
                this.dataNetStatus.style.color = '#059669';
                this.dataNetStatus.style.background = 'rgba(16,185,129,0.12)';
            } else {
                this.dataNetStatus.textContent = 'Pending';
                this.dataNetStatus.style.color = '#d97706';
                this.dataNetStatus.style.background = 'rgba(245,158,11,0.12)';
            }
        }
    }

    renderNetlist(nets, routedMap = new Map()) {
        if (this.dataNetSelect) {
            this.renderInspectNetDropdown(nets, routedMap);
        }

        if (!this.netlistContainer) return;
        this.netlistContainer.innerHTML = '';

        nets.forEach((net, index) => {
            const routedInfo = routedMap.get(net.id);
            const isRouted = !!routedInfo;
            const lengthMm = isRouted ? `${((routedInfo.path.length - 1) * 5).toFixed(0)}mm` : 'Unrouted';

            const sourceName = this.getFriendlyPinName(net.source);
            const targetName = this.getFriendlyPinName(net.target);

            const item = document.createElement('div');
            item.className = `net-card ${isRouted ? 'routed' : ''}`;
            item.innerHTML = `
                <div class="net-header">
                    <span class="net-color-pill" style="background: ${net.color};"></span>
                    <span class="net-name">${net.name}</span>
                    <span class="net-status ${isRouted ? 'badge-success' : 'badge-pending'}">${isRouted ? 'ROUTED' : 'PENDING'}</span>
                </div>
                <div class="net-details">
                    <span class="net-pin-chip">${sourceName}</span>
                    <span class="net-arrow">➜</span>
                    <span class="net-pin-chip">${targetName}</span>
                    <span class="net-length">${lengthMm}</span>
                </div>
            `;

            // Click net to inspect in Live Data Panel & view tree
            item.addEventListener('click', () => {
                if (this.dataNetSelect) {
                    this.dataNetSelect.value = net.id;
                    this.updateInspectStatusBadge(net.id);
                }
                if (this.app?.onInspectNetChanged) {
                    this.app.onInspectNetChanged(net.id);
                }
                if (routedInfo && routedInfo.tree) {
                    this.app.treeModal.show({ label: sourceName, id: net.source }, net, routedInfo.tree, this.app.currentAlgorithm);
                }
            });

            this.netlistContainer.appendChild(item);
        });
    }
}
