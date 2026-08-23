/**
 * grid.js - 10x8 PCB Grid Matrix (50mm x 40mm, 5mm pitch)
 */

export const GRID_COLS = 10; // 50mm / 5mm
export const GRID_ROWS = 8;  // 40mm / 5mm
export const PITCH_MM = 5;

export const DIRECTIONS = {
    UP:    { dx: 0, dy: -1, name: 'UP' },
    RIGHT: { dx: 1, dy: 0,  name: 'RIGHT' },
    DOWN:  { dx: 0, dy: 1,  name: 'DOWN' },
    LEFT:  { dx: -1, dy: 0, name: 'LEFT' }
};

export const DIR_LIST = [DIRECTIONS.UP, DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.LEFT];

export class PcbGrid {
    constructor(cols = GRID_COLS, rows = GRID_ROWS, pitch = PITCH_MM) {
        this.cols = cols;
        this.rows = rows;
        this.pitch = pitch;
        this.totalNodes = cols * rows;

        // Cell matrix: 0 = empty, 1 = obstacle/body, 2 = pin, 3 = trace
        this.cells = new Array(this.totalNodes).fill(0);
        // Occupant info per cell: { type: 'body'|'pin'|'trace', componentId, pinId, netId }
        this.occupants = new Array(this.totalNodes).fill(null);
        // Congestion / hazard penalties for rip-up & reroute (multiplier >= 1.0)
        this.penalties = new Array(this.totalNodes).fill(1.0);
    }

    toId(x, y) {
        if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return -1;
        return y * this.cols + x;
    }

    toCoord(id) {
        if (id < 0 || id >= this.totalNodes) return null;
        return {
            x: id % this.cols,
            y: Math.floor(id / this.cols)
        };
    }

    isValid(x, y) {
        return x >= 0 && x < this.cols && y >= 0 && y < this.rows;
    }

    clearTraces() {
        for (let i = 0; i < this.totalNodes; i++) {
            if (this.occupants[i] && this.occupants[i].type === 'trace') {
                this.cells[i] = 0;
                this.occupants[i] = null;
            }
        }
    }

    resetPenalties() {
        this.penalties.fill(1.0);
    }

    addPenalty(id, amount = 2.5) {
        if (id >= 0 && id < this.totalNodes) {
            this.penalties[id] += amount;
        }
    }

    setObstacle(id, occupant) {
        if (id >= 0 && id < this.totalNodes) {
            this.cells[id] = 1;
            this.occupants[id] = occupant;
        }
    }

    setPin(id, occupant) {
        if (id >= 0 && id < this.totalNodes) {
            this.cells[id] = 2;
            this.occupants[id] = occupant;
        }
    }

    setTrace(id, occupant) {
        if (id >= 0 && id < this.totalNodes) {
            this.cells[id] = 3;
            this.occupants[id] = occupant;
        }
    }

    clearCell(id) {
        if (id >= 0 && id < this.totalNodes) {
            this.cells[id] = 0;
            this.occupants[id] = null;
        }
    }

    isPassable(x, y, currentNetId = null, targetPinId = null) {
        if (!this.isValid(x, y)) return false;
        const id = this.toId(x, y);
        const occupant = this.occupants[id];
        
        if (!occupant) return true; // empty cell
        
        // Target pin is passable for the search targeting it
        if (occupant.type === 'pin' && occupant.pinId === targetPinId) return true;
        
        // Allow passing through starting pin of current net
        if (occupant.type === 'pin' && occupant.netId === currentNetId) return true;
        
        // Everything else (component body, other pins, existing traces) is an obstacle
        return false;
    }
}
