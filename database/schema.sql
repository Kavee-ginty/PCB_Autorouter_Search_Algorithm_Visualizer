-- PCB AutoRouting Visualizer Database Schema
-- SQLite3 compatible schema

CREATE TABLE IF NOT EXISTS presets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    circuit_type TEXT DEFAULT 'series',
    components_json TEXT NOT NULL,
    netlist_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    components_json TEXT NOT NULL,
    netlist_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS routing_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER,
    algorithm TEXT NOT NULL,
    nets_total INTEGER NOT NULL,
    nets_routed INTEGER NOT NULL,
    nodes_explored INTEGER NOT NULL,
    conflicts_detected INTEGER DEFAULT 0,
    ripups_performed INTEGER DEFAULT 0,
    total_wire_length_mm REAL NOT NULL,
    execution_time_ms REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(board_id) REFERENCES saved_boards(id) ON DELETE SET NULL
);
