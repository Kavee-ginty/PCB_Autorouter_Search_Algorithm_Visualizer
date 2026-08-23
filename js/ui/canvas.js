/**
 * canvas.js - High-DPI HTML5 Canvas PCB Renderer & Interaction Engine
 */

import { GRID_COLS, GRID_ROWS, PITCH_MM } from '../core/grid.js';

/**
 * Component SVG Visual Transformation Configuration
 * Modify scale, rotation offset (in degrees), and (X, Y) pixel position offsets here!
 */
export const COMPONENT_SVG_TRANSFORMS = {
    battery: {
        scale: 2.6,              // Scale multiplier relative to grid cell size
        rotationOffsetDeg: 90,   // Base rotation offset in degrees (-90 for vertical SVG asset)
        offsetX: 0,               // Local axis offset along pins (pixels)
        offsetY: 0                // Local axis offset perpendicular to pins (pixels)
    },
    resistor: {
        scale: 1.5,
        rotationOffsetDeg: -90,
        offsetX: 0,
        offsetY: 0
    },
    led: {
        scale: 1.7,
        rotationOffsetDeg: 0,
        offsetX: 0,
        offsetY: -13             // Moves lead tips into pins in local frame
    },
    sensor: {
        scale: 1.5,
        rotationOffsetDeg: 0,
        offsetX: 0,
        offsetY: -5              // Moves lead tips into pins in local frame
    },
    switch: {
        scale: 1,
        rotationOffsetDeg: 0,
        offsetX: 0,
        offsetY: 0
    }
};

export class PcbCanvas {
    constructor(canvasElement, grid, options = {}) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d');
        this.grid = grid;

        // Visual layout metrics
        this.margin = 24;
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
        // Zoom & Pan state
        this.scale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.minScale = 0.4;
        this.maxScale = 5.0;
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;

        // SVG Component Assets
        this.svgImages = {};
        this._loadSvgAssets();

        this._setupCanvasSize();
        this._bindEvents();
        this.render();
    }

    resetView() {
        this.scale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.render();
    }

    addRippedPath(net, path) {
        if (!path || path.length < 2) return;
        this.rippedPaths.push({
            netId: net.id,
            name: net.name,
            color: net.color || '#f59e0b',
            path: [...path]
        });
        this.render();
    }

    clearRippedPaths() {
        this.rippedPaths = [];
        this.render();
    }

    _loadSvgAssets() {
        const assets = {
            battery: 'resources/Battery.svg',
            switch: 'resources/Switch.svg',
            sensor: 'resources/Sensor.svg',
            resistor: 'resources/Resistor.svg',
            led: 'resources/LED.svg'
        };

        for (const [key, path] of Object.entries(assets)) {
            const img = new Image();
            img.src = path;
            img.onload = () => {
                this.svgImages[key] = img;
                this.render();
            };
            img.onerror = () => {
                const fallbackImg = new Image();
                fallbackImg.src = `resources/${key.charAt(0).toUpperCase() + key.slice(1)} .svg`;
                fallbackImg.onload = () => {
                    this.svgImages[key] = fallbackImg;
                    this.render();
                };
            };
        }
    }

    _setupCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        const displayWidth = rect.width || 800;
        const displayHeight = rect.height || 600;

        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.ctx.scale(dpr, dpr);

        this.width = displayWidth;
        this.height = displayHeight;

        // Balanced zoom-out default view with comfortable breathing room around the PCB
        const boardPad = 38;     // Padding from outer pin centers to PCB border
        const canvasMargin = 38; // Comfortable whitespace around the board
        const availableW = this.width - (canvasMargin * 2) - (boardPad * 2);
        const availableH = this.height - (canvasMargin * 2) - (boardPad * 2);
        this.cellSize = Math.min(availableW / (this.cols - 1), availableH / (this.rows - 1));

        this.originX = canvasMargin + boardPad + (availableW - (this.cols - 1) * this.cellSize) / 2;
        this.originY = canvasMargin + boardPad + (availableH - (this.rows - 1) * this.cellSize) / 2;
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

        ctx.save();
        ctx.translate(this.panX, this.panY);
        ctx.scale(this.scale, this.scale);

        this._renderBoardSubstrate(ctx);
        this._renderGridMatrix(ctx);
        this._renderRippedPaths(ctx);
        this._renderTraces(ctx);
        this._renderSearchOverlay(ctx);
        this._renderComponents(ctx);
        this._renderPins(ctx);
        this._renderHoverTooltip(ctx);

        ctx.restore();
    }

    _renderBoardSubstrate(ctx) {
        const pad = 18;
        const pcbW = (this.cols - 1) * this.cellSize + pad * 2;
        const pcbH = (this.rows - 1) * this.cellSize + pad * 2;
        const pcbX = this.originX - pad;
        const pcbY = this.originY - pad;

        // PCB Outer Soft Drop Shadow on Canvas
        ctx.shadowColor = 'rgba(0, 0, 0, 0.22)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 6;

        // Classic Emerald Solder Mask Green Substrate
        const bgGrad = ctx.createLinearGradient(pcbX, pcbY, pcbX + pcbW, pcbY + pcbH);
        bgGrad.addColorStop(0, '#188656');
        bgGrad.addColorStop(1, '#188656');
        ctx.fillStyle = bgGrad;

        ctx.beginPath();
        ctx.roundRect(pcbX, pcbY, pcbW, pcbH, 8);
        ctx.fill();
        ctx.shadowColor = 'transparent';

        // Crisp White Silkscreen Board Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Corner mounting holes
        ctx.fillStyle = '#030a06';
        ctx.strokeStyle = '#eab308';
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

        // Clean silkscreen watermark
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.font = '600 10px monospace';
        ctx.fillText('PCB AUTOROUTE AI VISUALIZER', pcbX + 16, pcbY + pcbH - 8);
    }

    _renderGridMatrix(ctx) {
        // Subtle grid lines on green PCB
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
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
                    ctx.fillStyle = '#739d8b';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                    ctx.fill();

                    // Center drill hole
                    ctx.fillStyle = '#188656';
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }
    }

    _renderRippedPaths(ctx) {
        if (!this.rippedPaths || this.rippedPaths.length === 0) return;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (const rip of this.rippedPaths) {
            if (!rip.path || rip.path.length < 2) continue;

            const color = rip.color || '#f59e0b';
            const isYellow = this._isYellowOrAmber(color);

            // Ghost trace: Dotted/dashed line in initial net path color
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.setLineDash([5, 5]);
            // Specifically soften yellow/amber dotted lines further to 0.20
            ctx.globalAlpha = isYellow ? 0.20 : 0.42;

            ctx.beginPath();
            const pStart = this.grid.toCoord(rip.path[0]);
            const pStartPx = this.gridToPixel(pStart.x, pStart.y);
            ctx.moveTo(pStartPx.x, pStartPx.y);

            for (let i = 1; i < rip.path.length; i++) {
                const p = this.grid.toCoord(rip.path[i]);
                const px = this.gridToPixel(p.x, p.y);
                ctx.lineTo(px.x, px.y);
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    _isYellowOrAmber(color) {
        if (!color) return false;
        const c = color.toLowerCase();
        return c.includes('f59e0b') || c.includes('eab308') || c.includes('facc15') || 
               c.includes('fbbf24') || c.includes('d97706') || c.includes('yellow') || 
               c.includes('amber') || c.includes('f59') || c.includes('eab');
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
            const pins = comp.getPins();

            const pTopLeft = this.gridToPixel(comp.x, comp.y);
            const wPx = (dims.w - 1) * this.cellSize + 28;
            const hPx = (dims.h - 1) * this.cellSize + 28;
            const xPx = pTopLeft.x - 14;
            const yPx = pTopLeft.y - 14;

            // Selection / Hover highlight box
            if (isSelected || isHovered) {
                ctx.save();
                ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.2)' : 'rgba(250, 204, 21, 0.15)';
                ctx.strokeStyle = isSelected ? '#3b82f6' : '#facc15';
                ctx.lineWidth = isSelected ? 2 : 1.5;
                ctx.setLineDash([4, 3]);
                ctx.beginPath();
                ctx.roundRect(xPx - 4, yPx - 4, wPx + 8, hPx + 8, 6);
                ctx.fill();
                ctx.stroke();
                ctx.restore();
            }

            const svgImg = this.svgImages[comp.type];
            if (svgImg && svgImg.complete && svgImg.naturalWidth > 0 && pins.length >= 2) {
                ctx.save();
                const p0 = this.gridToPixel(pins[0].x, pins[0].y);
                const p1 = this.gridToPixel(pins[1].x, pins[1].y);
                const midX = (p0.x + p1.x) / 2;
                const midY = (p0.y + p1.y) / 2;
                const dx = p1.x - p0.x;
                const dy = p1.y - p0.y;
                const angle = Math.atan2(dy, dx);

                const cfg = COMPONENT_SVG_TRANSFORMS[comp.type] || { scale: 1.8, rotationOffsetDeg: -90, offsetX: 0, offsetY: 0 };
                const rotOffsetRad = ((cfg.rotationOffsetDeg || 0) * Math.PI) / 180;

                ctx.translate(midX, midY);
                ctx.rotate(angle + rotOffsetRad);

                const drawSize = this.cellSize * (cfg.scale || 1.8);
                const drawX = -drawSize / 2 + (cfg.offsetX || 0);
                const drawY = -drawSize / 2 + (cfg.offsetY || 0);
                ctx.drawImage(svgImg, drawX, drawY, drawSize, drawSize);
                ctx.restore();
            } else {
                // Fallback rectangular body
                ctx.fillStyle = isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(15, 23, 42, 0.85)';
                ctx.strokeStyle = isSelected ? '#60a5fa' : (isHovered ? '#facc15' : 'rgba(255, 255, 255, 0.7)');
                ctx.lineWidth = isSelected ? 2.5 : 1.5;

                ctx.beginPath();
                ctx.roundRect(xPx, yPx, wPx, hPx, 4);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 9px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(comp.shortName, xPx + wPx / 2, yPx + hPx / 2);
            }
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
                ctx.fillStyle = '#0a1a12';
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
                ctx.fill();

                // Pin label text (+ or -)
                if (pin.label) {
                    ctx.save();
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 9px monospace';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
                    ctx.shadowBlur = 3;
                    ctx.fillText(pin.label, p.x, p.y - 8);
                    ctx.restore();
                }
            }
        }
    }

    _renderHoverTooltip(ctx) {
        if (!this.hoveredPin) return;

        const p = this.gridToPixel(this.hoveredPin.x, this.hoveredPin.y);
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
        const pinName = friendlyMap[this.hoveredPin.id] || (this.hoveredPin.label ? `Pin ${this.hoveredPin.label}` : 'Pin');
        const text = `${pinName} (${this.hoveredPin.x * this.pitchMm}mm, ${this.hoveredPin.y * this.pitchMm}mm)`;
        
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
        const getScreenCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };

        const screenToWorld = (screenX, screenY) => {
            return {
                x: (screenX - this.panX) / this.scale,
                y: (screenY - this.panY) / this.scale
            };
        };

        const getCanvasCoords = (e) => {
            const screen = getScreenCoords(e);
            return screenToWorld(screen.x, screen.y);
        };

        // Mouse wheel zoom using cursor pointer as origin
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();

            const rect = this.canvas.getBoundingClientRect();
            const cursorX = e.clientX - rect.left;
            const cursorY = e.clientY - rect.top;

            // World coordinate under cursor pointer before zoom
            const worldX = (cursorX - this.panX) / this.scale;
            const worldY = (cursorY - this.panY) / this.scale;

            // Zoom factor
            const zoomFactor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
            const newScale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * zoomFactor));

            if (newScale !== this.scale) {
                this.scale = newScale;
                // Pin the world coordinate under the cursor pointer
                this.panX = cursorX - worldX * this.scale;
                this.panY = cursorY - worldY * this.scale;
                this.render();
            }
        }, { passive: false });

        this.canvas.addEventListener('mousedown', (e) => {
            const pos = getCanvasCoords(e);
            const gridCoord = this.pixelToGrid(pos.x, pos.y);

            // Check if clicking a pin
            const pin = this._findPinAt(pos.x, pos.y);
            if (pin && e.button === 0) {
                if (this.onPinClicked) {
                    this.onPinClicked(pin);
                }
                return;
            }

            // Check if clicking a component body for dragging
            const comp = this._findComponentAt(gridCoord.x, gridCoord.y);
            if (comp && e.button === 0) {
                this.draggedComponent = comp;
                this.selectedComponent = comp;
                this.dragOffset = {
                    x: gridCoord.x - comp.x,
                    y: gridCoord.y - comp.y
                };
                if (this.onSelectionChanged) this.onSelectionChanged(comp);
                this.render();
                return;
            }

            // Middle-click or left-click on empty background: initiate panning
            if (e.button === 1 || (e.button === 0 && !comp && !pin)) {
                this.isPanning = true;
                this.panStartX = e.clientX - this.panX;
                this.panStartY = e.clientY - this.panY;
                this.canvas.style.cursor = 'grabbing';
                this.selectedComponent = null;
                if (this.onSelectionChanged) this.onSelectionChanged(null);
                this.render();
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.panX = e.clientX - this.panStartX;
                this.panY = e.clientY - this.panStartY;
                this.render();
                return;
            }

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
            if (this.isPanning) {
                this.isPanning = false;
                this.canvas.style.cursor = 'crosshair';
            }
            if (this.draggedComponent) {
                this.draggedComponent = null;
                this.render();
            }
        });

        // Double click to rotate component, or double click empty space to reset zoom
        this.canvas.addEventListener('dblclick', (e) => {
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
            } else {
                this.resetView();
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
