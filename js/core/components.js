/**
 * components.js - Component definitions, pin mapping, and footprint mechanics
 */

export const COMPONENT_TYPES = {
    battery: {
        type: 'battery',
        name: 'Battery Terminal (BT1)',
        shortName: 'BT1',
        color: '#dc2626',
        width: 2, // 2 grid pitch units (10mm)
        height: 1, // 1 grid pitch unit (5mm)
        pins: [
            { id: 'B+', label: 'B+', relX: 0, relY: 0, type: 'power', polarity: '+' },
            { id: 'B-', label: 'B-', relX: 1, relY: 0, type: 'ground', polarity: '-' }
        ]
    },
    switch: {
        type: 'switch',
        name: 'Power Switch (S1)',
        shortName: 'S1',
        color: '#d97706',
        width: 2,
        height: 1,
        pins: [
            { id: 'S1-A', label: 'S1-A', relX: 0, relY: 0, type: 'signal' },
            { id: 'S1-B', label: 'S1-B', relX: 1, relY: 0, type: 'signal' }
        ]
    },
    sensor: {
        type: 'sensor',
        name: 'Light Sensor (RLDR)',
        shortName: 'RLDR',
        color: '#059669',
        width: 2,
        height: 1,
        pins: [
            { id: 'L-in', label: 'L-in', relX: 0, relY: 0, type: 'signal' },
            { id: 'L-out', label: 'L-out', relX: 1, relY: 0, type: 'signal' }
        ]
    },
    resistor: {
        type: 'resistor',
        name: 'Resistor (R1)',
        shortName: 'R1',
        color: '#2563eb',
        width: 2,
        height: 1,
        pins: [
            { id: 'R-in', label: 'R-in', relX: 0, relY: 0, type: 'signal' },
            { id: 'R-out', label: 'R-out', relX: 1, relY: 0, type: 'signal' }
        ]
    },
    led: {
        type: 'led',
        name: 'Indicator LED (D1)',
        shortName: 'D1',
        color: '#7c3aed',
        width: 2,
        height: 1,
        pins: [
            { id: 'D-A', label: 'D-A', relX: 0, relY: 0, type: 'anode', polarity: '+' },
            { id: 'D-K', label: 'D-K', relX: 1, relY: 0, type: 'cathode', polarity: '-' }
        ]
    }
};

export class ComponentInstance {
    constructor(id, typeKey, x = 0, y = 0, orientation = 'horizontal') {
        const def = COMPONENT_TYPES[typeKey];
        if (!def) throw new Error(`Unknown component type: ${typeKey}`);

        this.id = id;
        this.type = typeKey;
        this.name = def.name;
        this.shortName = def.shortName;
        this.color = def.color;
        this.x = x;
        this.y = y;
        this.orientation = orientation; // 'horizontal' or 'vertical'
        this.definition = def;
    }

    getDimensions() {
        if (this.orientation === 'horizontal') {
            return { w: this.definition.width, h: this.definition.height };
        } else {
            return { w: this.definition.height, h: this.definition.width };
        }
    }

    getPins() {
        return this.definition.pins.map(p => {
            let px = this.x + p.relX;
            let py = this.y + p.relY;

            if (this.orientation === 'vertical') {
                px = this.x + p.relY;
                py = this.y + p.relX;
            }

            return {
                id: p.id,
                label: p.label,
                x: px,
                y: py,
                type: p.type,
                polarity: p.polarity || '',
                componentId: this.id
            };
        });
    }

    getOccupiedCells(grid) {
        const cells = [];
        const pins = this.getPins();
        const pinSet = new Set(pins.map(p => grid.toId(p.x, p.y)));

        const dims = this.getDimensions();
        for (let dy = 0; dy < dims.h; dy++) {
            for (let dx = 0; dx < dims.w; dx++) {
                const cx = this.x + dx;
                const cy = this.y + dy;
                const cellId = grid.toId(cx, cy);
                if (cellId !== -1) {
                    cells.push({
                        id: cellId,
                        x: cx,
                        y: cy,
                        isPin: pinSet.has(cellId),
                        pin: pins.find(p => p.x === cx && p.y === cy) || null
                    });
                }
            }
        }
        return cells;
    }

    rotate() {
        this.orientation = this.orientation === 'horizontal' ? 'vertical' : 'horizontal';
    }

    toJSON() {
        return {
            id: this.id,
            type: this.type,
            name: this.name,
            x: this.x,
            y: this.y,
            orientation: this.orientation,
            pins: this.getPins()
        };
    }
}
