/**
 * canvas.js - High-DPI HTML5 Canvas PCB Renderer & Interaction Engine
 */

import { GRID_COLS, GRID_ROWS, PITCH_MM } from '../core/grid.js';

export class PcbCanvas {
    constructor(canvasElement, grid, options = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.grid = grid;

        // Visual layout metrics
        this.margin = 45; // mm ruler margin
        this.cols = GRID_COLS;
        this.rows = GRID_ROWS;
        this.pitchMm = PITCH_MM;

        // Callback hooks
        this.onComponentMoved = options.onComponentMoved || null;
        this.onPinClicked = options.onPinClicked || null;
        this.onSelectionChanged = options.onSelectionChanged || null;

        // Interactive state
        this.components = [];
        this.nets = [];
        this.draggedComponent = null;
        this.dragOffset = { x: 0, y: 0 };
        this.hoveredPin = null;
        this.hoveredComponent = null;
        this.selectedComponent = null;

        // Live animation overlay state
        this.activeVisited = new Set();
        this.activeFrontier = new Set();
        this.activeCurrentNode = null;
        this.activeSolutionPath = [];
        this.flashConflictCells = [];

        this._setupCanvasSize();
        this._bindEvents();
        this.render();
    }

    _setupCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width || 750;
        const displayHeight = rect.height || 600;

        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.ctx.scale(dpr, dpr);

        this.width = displayWidth;
        this.height = displayHeight;

        // Calculate cell size in pixels
        const availableW = this.width - this.margin * 2;
        const availableH = this.height - this.margin * 2;
        this.cellSize = Math.min(availableW / (this.cols - 1), availableH / (this.rows - 1));

        this.originX = this.margin + (availableW - (this.cols - 1) * this.cellSize) / 2;
        this.originY = this.margin + (availableH - (this.rows - 1) * this.cellSize) / 2;
    }

    resize() {
        this._setupCanvasSize();
        this.render();
    }

    setCircuit(components, nets) {
        this.components = components;
        this.nets = nets;
        this._syncGridOccupants();
        this.render();
    }

    _syncGridOccupants() {
        // Clear obstacles & pins
        for (let i = 0; i < this.grid.totalNodes; i++) {
            if (this.grid.occupants[i] && this.grid.occupants[i].type !== 'trace') {
                this.grid.clearCell(i);
            }
        }

        // Register all component bodies & pins
        for (const comp of this.components) {
            const cells = comp.getOccupiedCells(this.grid);
            for (const cell of cells) {
                if (cell.isPin && cell.pin) {
                    this.grid.setPin(cell.id, {
                        type: 'pin',
                        componentId: comp.id,
                        pinId: cell.pin.id,
                        pinType: cell.pin.type,
                        x: cell.x,
                        y: cell.y
                    });
                } else {
                    this.grid.setObstacle(cell.id, {
                        type: 'body',
                        componentId: comp.id
                    });
                }
            }
        }
    }

    setSearchState(visited, frontier, currentNode = null, path = []) {
        this.activeVisited = new Set(visited || []);
        this.activeFrontier = new Set(frontier || []);
        this.activeCurrentNode = currentNode;
        this.activeSolutionPath = path || [];
        this.render();
    }

    clearSearchState() {
        this.activeVisited.clear();
        this.activeFrontier.clear();
        this.activeCurrentNode = null;
        this.activeSolutionPath = [];
        this.flashConflictCells = [];
        this.render();
    }

    gridToPixel(gx, gy) {
        return {
            x: this.originX + gx * this.cellSize,
            y: this.originY + gy * this.cellSize
        };
    }

    pixelToGrid(px, py) {
        const gx = Math.round((px - this.originX) / this.cellSize);
        const gy = Math.round((py - this.originY) / this.cellSize);
        return {
            x: Math.max(0, Math.min(this.cols - 1, gx)),
            y: Math.max(0, Math.min(this.rows - 1, gy))
        };
    }

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.width, this.height);

        this._renderBoardSubstrate(ctx);
        this._renderRulersAndCoordinates(ctx);
        this._renderGridMatrix(ctx);
        this._renderCongestionHeatmap(ctx);
        this._renderTraces(ctx);
        this._renderSearchOverlay(ctx);
        this._renderComponents(ctx);
        this._renderPins(ctx);
        this._renderHoverTooltip(ctx);
    }

    _renderBoardSubstrate(ctx) {
        const pcbW = (this.cols - 1) * this.cellSize + 30;
        const pcbH = (this.rows - 1) * this.cellSize + 30;
        const pcbX = this.originX - 15;
        const pcbY = this.originY - 15;

        // PCB Outer Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;

        // Dark matte solder-mask green/obsidian substrate
        const bgGrad = ctx.createLinearGradient(pcbX, pcbY, pcbX + pcbW, pcbY + pcbH);
        bgGrad.addColorStop(0, '#0c2419');
        bgGrad.addColorStop(1, '#06160f');
        ctx.fillStyle = bgGrad;

        ctx.beginPath();
        ctx.roundRect(pcbX, pcbY, pcbW, pcbH, 8);
        ctx.fill();
        ctx.shadowColor = 'transparent';

        // Board Silkscreen Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Corner mounting holes
        ctx.fillStyle = '#030805';
        ctx.strokeStyle = '#c5a059';
        ctx.lineWidth = 2;
        const corners = [
            { x: pcbX + 8, y: pcbY + 8 },
            { x: pcbX + pcbW - 8, y: pcbY + 8 },
            { x: pcbX + 8, y: pcbY + pcbH - 8 },
            { x: pcbX + pcbW - 8, y: pcbY + pcbH - 8 }
        ];
        for (const c of corners) {
            ctx.beginPath();
            ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Title silkscreen watermark
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.font = '600 10px monospace';
        ctx.fillText('PCB AUTOROUTE AI VISUALIZER • 50x40mm 5mm PITCH', pcbX + 16, pcbY + pcbH - 8);
    }

    _renderRulersAndCoordinates(ctx) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // X mm markings
        for (let x = 0; x < this.cols; x++) {
            const p = this.gridToPixel(x, 0);
            ctx.fillText(`${x * this.pitchMm}mm`, p.x, this.originY - 26);
            ctx.fillText(`X:${x}`, p.x, this.originY - 14);
        }

        // Y mm markings
        ctx.textAlign = 'right';
        for (let y = 0; y < this.rows; y++) {
            const p = this.gridToPixel(0, y);
            ctx.fillText(`${y * this.pitchMm}mm`, this.originX - 22, p.y);
            ctx.fillText(`Y:${y}`, this.originX - 8, p.y);
        }
    }

    _renderGridMatrix(ctx) {
        // Grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.lineWidth = 1;

        for (let x = 0; x < this.cols; x++) {
            const p1 = this.gridToPixel(x, 0);
            const p2 = this.gridToPixel(x, this.rows - 1);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        for (let y = 0; y < this.rows; y++) {
            const p1 = this.gridToPixel(0, y);
            const p2 = this.gridToPixel(this.cols - 1, y);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        // Grid nodes (unoccupied solder pads)
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const p = this.gridToPixel(x, y);
                const id = this.grid.toId(x, y);
                const occ = this.grid.occupants[id];

                if (!occ) {
                    // Empty pad
                    ctx.fillStyle = '#1e3a2b';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    ctx.fill();

                    // Center drill hole
                    ctx.fillStyle = '#06160f';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    _renderCongestionHeatmap(ctx) {
        for (let i = 0; i < this.grid.totalNodes; i++) {
            const penalty = this.grid.penalties[i];
            if (penalty > 1.0) {
                const coord = this.grid.toCoord(i);
                const p = this.gridToPixel(coord.x, coord.y);
                const alpha = Math.min(0.7, (penalty - 1.0) * 0.15);

                ctx.fillStyle = `rgba(239, 68, 68, ${alpha})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, this.cellSize * 0.45, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#fca5a5';
                ctx.font = '8px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`+${penalty.toFixed(1)}`, p.x, p.y + 12);
            }
        }
    }

    _renderTraces(ctx) {
        // Draw traces net by net for beautiful copper routes
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw traces stored on grid
        for (const net of this.nets) {
            if (!net.path || net.path.length < 2) continue;

            const color = net.color || '#f59e0b';

            // Outer copper track glow
            ctx.strokeStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 6;
            ctx.lineWidth = 4.5;

            ctx.beginPath();
            const pStart = this.grid.toCoord(net.path[0]);
            const pStartPx = this.gridToPixel(pStart.x, pStart.y);
            ctx.moveTo(pStartPx.x, pStartPx.y);

            for (let i = 1; i < net.path.length; i++) {
                const p = this.grid.toCoord(net.path[i]);
                const px = this.gridToPixel(p.x, p.y);
                ctx.lineTo(px.x, px.y);
            }
            ctx.stroke();

            // Inner copper highlight
            ctx.strokeStyle = '#ffffff';
            ctx.shadowColor = 'transparent';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }

    _renderSearchOverlay(ctx) {
        // Visited nodes in cyan
        for (const nodeId of this.activeVisited) {
            const coord = this.grid.toCoord(nodeId);
            if (!coord) continue;
            const p = this.gridToPixel(coord.x, coord.y);

            ctx.fillStyle = 'rgba(6, 182, 212, 0.45)';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fill();
        }

        // Frontier nodes in amber
        for (const nodeId of this.activeFrontier) {
            const coord = this.grid.toCoord(nodeId);
            if (!coord) continue;
            const p = this.gridToPixel(coord.x, coord.y);

            ctx.fillStyle = 'rgba(245, 158, 11, 0.7)';
            ctx.strokeStyle = '#fef08a';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Current search head in pulsing emerald
        if (this.activeCurrentNode !== null) {
            const coord = this.grid.toCoord(this.activeCurrentNode);
            if (coord) {
                const p = this.gridToPixel(coord.x, coord.y);
                ctx.fillStyle = '#10b981';
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        }
    }

    _renderComponents(ctx) {
        for (const comp of this.components) {
            const isSelected = this.selectedComponent === comp;
            const isHovered = this.hoveredComponent === comp;
            const dims = comp.getDimensions();

            const pTopLeft = this.gridToPixel(comp.x, comp.y);
            const wPx = (dims.w - 1) * this.cellSize + 28;
            const hPx = (dims.h - 1) * this.cellSize + 28;
            const xPx = pTopLeft.x - 14;
            const yPx = pTopLeft.y - 14;

            // Component body box
            ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(30, 41, 59, 0.85)';
            ctx.strokeStyle = isSelected ? '#60a5fa' : (isHovered ? '#facc15' : 'rgba(255, 255, 255, 0.7)');
            ctx.lineWidth = isSelected ? 2.5 : 1.5;

            ctx.beginPath();
            ctx.roundRect(xPx, yPx, wPx, hPx, 4);
            ctx.fill();
            ctx.stroke();

            // Silkscreen designator text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(comp.shortName, xPx + wPx / 2, yPx + hPx / 2);
        }
    }

    _renderPins(ctx) {
        for (const comp of this.components) {
            const pins = comp.getPins();
            for (const pin of pins) {
                const p = this.gridToPixel(pin.x, pin.y);
                const isHovered = this.hoveredPin && this.hoveredPin.id === pin.id;

                // Gold annular ring
                ctx.fillStyle = isHovered ? '#fbbf24' : '#eab308';
                ctx.strokeStyle = '#713f12';
                ctx.lineWidth = 1.5;

                ctx.beginPath();
                ctx.arc(p.x, p.y, isHovered ? 7.5 : 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                // Drill hole
                ctx.fillStyle = '#0f172a';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
                ctx.fill();

                // Pin label text
                ctx.fillStyle = '#f8fafc';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(pin.label, p.x, p.y - 8);
            }
        }
    }

    _renderHoverTooltip(ctx) {
        if (!this.hoveredPin) return;

        const p = this.gridToPixel(this.hoveredPin.x, this.hoveredPin.y);
        const text = `${this.hoveredPin.label} (${this.hoveredPin.x * this.pitchMm}mm, ${this.hoveredPin.y * this.pitchMm}mm)`;
        
        ctx.font = '10px sans-serif';
        const textWidth = ctx.measureText(text).width;
        const ttW = textWidth + 16;
        const ttH = 22;
        const ttX = p.x - ttW / 2;
        const ttY = p.y - 34;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.roundRect(ttX, ttY, ttW, ttH, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#38bdf8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, ttX + ttW / 2, ttY + ttH / 2);
    }

    _bindEvents() {
        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return; // Left-click only
            const pos = getCanvasCoords(e);
            const gridCoord = this.pixelToGrid(pos.x, pos.y);

            // Check if clicking a pin
            const pin = this._findPinAt(pos.x, pos.y);
            if (pin) {
                if (this.onPinClicked) {
                    this.onPinClicked(pin);
                }
                return;
            }

            // Check if clicking a component body for dragging
            const comp = this._findComponentAt(gridCoord.x, gridCoord.y);
            if (comp) {
                this.draggedComponent = comp;
                this.selectedComponent = comp;
                this.dragOffset = {
                    x: gridCoord.x - comp.x,
                    y: gridCoord.y - comp.y
                };
                if (this.onSelectionChanged) this.onSelectionChanged(comp);
                this.render();
            } else {
                this.selectedComponent = null;
                if (this.onSelectionChanged) this.onSelectionChanged(null);
                this.render();
            }
        });

        window.addEventListener('mousemove', (e) => {
            const pos = getCanvasCoords(e);

            if (this.draggedComponent) {
                const gridCoord = this.pixelToGrid(pos.x, pos.y);
                const dims = this.draggedComponent.getDimensions();
                
                const newX = Math.max(0, Math.min(this.cols - dims.w, gridCoord.x - this.dragOffset.x));
                const newY = Math.max(0, Math.min(this.rows - dims.h, gridCoord.y - this.dragOffset.y));

                if (newX !== this.draggedComponent.x || newY !== this.draggedComponent.y) {
                    this.draggedComponent.x = newX;
                    this.draggedComponent.y = newY;
                    this._syncGridOccupants();
                    if (this.onComponentMoved) this.onComponentMoved(this.draggedComponent);
                    this.render();
                }
            } else {
                const prevHoverPin = this.hoveredPin;
                this.hoveredPin = this._findPinAt(pos.x, pos.y);

                const gridCoord = this.pixelToGrid(pos.x, pos.y);
                const prevHoverComp = this.hoveredComponent;
                this.hoveredComponent = this._findComponentAt(gridCoord.x, gridCoord.y);

                if (this.hoveredPin !== prevHoverPin || this.hoveredComponent !== prevHoverComp) {
                    this.render();
                }
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.draggedComponent) {
                this.draggedComponent = null;
                this.render();
            }
        });

        // Double click or right click to rotate component
        this.canvas.addEventListener('dblclick', (e) => {
            const pos = getCanvasCoords(e);
            const gridCoord = this.pixelToGrid(pos.x, pos.y);
            const comp = this._findComponentAt(gridCoord.x, gridCoord.y);
            if (comp) {
                comp.rotate();
                // Ensure in bounds after rotation
                const dims = comp.getDimensions();
                comp.x = Math.max(0, Math.min(this.cols - dims.w, comp.x));
                comp.y = Math.max(0, Math.min(this.rows - dims.h, comp.y));
                this._syncGridOccupants();
                if (this.onComponentMoved) this.onComponentMoved(comp);
                this.render();
            }
        });

        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const pos = getCanvasCoords(e);
            const gridCoord = this.pixelToGrid(pos.x, pos.y);
            const comp = this._findComponentAt(gridCoord.x, gridCoord.y);
            if (comp) {
                comp.rotate();
                const dims = comp.getDimensions();
                comp.x = Math.max(0, Math.min(this.cols - dims.w, comp.x));
                comp.y = Math.max(0, Math.min(this.rows - dims.h, comp.y));
                this._syncGridOccupants();
                if (this.onComponentMoved) this.onComponentMoved(comp);
                this.render();
            }
        });
    }

    _findPinAt(px, py) {
        for (const comp of this.components) {
            for (const pin of comp.getPins()) {
                const p = this.gridToPixel(pin.x, pin.y);
                const dist = Math.hypot(px - p.x, py - p.y);
                if (dist <= 12) {
                    return { ...pin, nodeId: this.grid.toId(pin.x, pin.y) };
                }
            }
        }
        return null;
    }

    _findComponentAt(gx, gy) {
        for (const comp of this.components) {
            const dims = comp.getDimensions();
            if (gx >= comp.x && gx < comp.x + dims.w && gy >= comp.y && gy < comp.y + dims.h) {
                return comp;
            }
        }
        return null;
    }
}
