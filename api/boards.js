/**
 * api/boards.js - Vercel Serverless Function for Board Saving/Loading & Routing Logs
 */

// In-memory store for serverless environment
let savedBoards = [
    {
        id: 1,
        title: 'Sample Saved Board',
        created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
        components: [
            {
                id: 'bat_1',
                type: 'battery',
                name: 'Battery (BT1)',
                x: 1,
                y: 1,
                orientation: 'horizontal',
                pins: [
                    { id: 'B+', label: '+', x: 1, y: 1, type: 'power' },
                    { id: 'B-', label: '-', x: 3, y: 1, type: 'ground' }
                ]
            },
            {
                id: 'led_1',
                type: 'led',
                name: 'Indicator LED (D1)',
                x: 1,
                y: 5,
                orientation: 'vertical',
                pins: [
                    { id: 'D-A', label: '+', x: 1, y: 5, type: 'anode' },
                    { id: 'D-K', label: '-', x: 1, y: 6, type: 'cathode' }
                ]
            }
        ],
        netlist: [
            { id: 'net_1', name: 'Net 1 (VCC)', source: 'B+', target: 'D-A', color: '#ef4444' },
            { id: 'net_2', name: 'Net 2 (GND)', source: 'D-K', target: 'B-', color: '#8b5cf6' }
        ]
    }
];

let routingLogs = [];
let nextBoardId = 2;
let nextLogId = 1;

export default function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id, action } = req.query || {};

    if (req.method === 'GET') {
        if (id !== undefined && id !== null && id !== '') {
            const board = savedBoards.find(b => b.id === parseInt(id, 10));
            if (board) {
                return res.status(200).json({ success: true, data: board });
            } else {
                return res.status(404).json({ success: false, error: 'Board not found' });
            }
        } else {
            const list = savedBoards.map(b => ({
                id: b.id,
                title: b.title,
                created_at: b.created_at,
                updated_at: b.updated_at
            }));
            return res.status(200).json({ success: true, data: list });
        }
    }

    if (req.method === 'POST') {
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
            }
        }
        body = body || {};

        if (action === 'log') {
            const logEntry = {
                id: nextLogId++,
                algorithm: body.algorithm || 'unknown',
                nets_total: body.nets_total || 0,
                nets_routed: body.nets_routed || 0,
                nodes_explored: body.nodes_explored || 0,
                conflicts_detected: body.conflicts_detected || 0,
                ripups_performed: body.ripups_performed || 0,
                total_wire_length_mm: body.total_wire_length_mm || 0,
                execution_time_ms: body.execution_time_ms || 0,
                created_at: new Date().toISOString()
            };
            routingLogs.push(logEntry);
            return res.status(200).json({ success: true, id: logEntry.id });
        }

        if (!body.title || !body.components || !body.netlist) {
            return res.status(400).json({ success: false, error: 'Title, components, and netlist are required' });
        }

        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

        if (body.id) {
            const existingIndex = savedBoards.findIndex(b => b.id === parseInt(body.id, 10));
            if (existingIndex !== -1) {
                savedBoards[existingIndex] = {
                    ...savedBoards[existingIndex],
                    title: body.title.trim(),
                    components: body.components,
                    netlist: body.netlist,
                    updated_at: now
                };
                return res.status(200).json({ success: true, id: body.id });
            }
        }

        const newId = nextBoardId++;
        const newBoard = {
            id: newId,
            title: body.title.trim(),
            components: body.components,
            netlist: body.netlist,
            created_at: now,
            updated_at: now
        };
        savedBoards.unshift(newBoard);
        return res.status(200).json({ success: true, id: newId });
    }

    if (req.method === 'DELETE') {
        if (!id) {
            return res.status(400).json({ success: false, error: 'Board ID is required' });
        }
        const initialLen = savedBoards.length;
        savedBoards = savedBoards.filter(b => b.id !== parseInt(id, 10));
        if (savedBoards.length < initialLen) {
            return res.status(200).json({ success: true });
        } else {
            return res.status(404).json({ success: false, error: 'Board not found' });
        }
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
}
