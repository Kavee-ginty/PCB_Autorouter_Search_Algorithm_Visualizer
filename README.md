# PCB Autorouter Search Algorithm Visualizer

An interactive AI-powered single-layer PCB autorouter and search algorithm visualizer. This tool demonstrates and benchmarks various artificial intelligence pathfinding and search algorithms on a discrete printed circuit board (PCB) grid, featuring dynamic component placement, trace routing, conflict resolution, and rip-up & reroute capabilities.

---

## 🚀 Features

- **8 AI Search Algorithms**:
  - Breadth-First Search (BFS)
  - Depth-First Search (DFS)
  - Depth-Limited Search (DLS)
  - Iterative Deepening Search (IDS)
  - Uniform Cost Search (UCS / Dijkstra)
  - Greedy Best-First Search
  - A* Search (Manhattan & Euclidean heuristics)
  - Bidirectional Search
- **PCB Routing Engine**:
  - 50 mm × 40 mm board layout (10×8 grid with 5 mm pitch)
  - Component placement (Resistors, ICs, Headers, Capacitors, etc.)
  - Pin-to-pin netlist routing
  - Obstacle avoidance & clearance rules
  - Multi-net conflict detection and automated Rip-Up & Reroute
- **Interactive Visualizer**:
  - Step-by-step path exploration and search tree visualization
  - Real-time performance metrics (nodes explored, path cost, execution time)
  - Layout saving & loading via SQLite database
  - Standalone Python AI Search Engine (`aisearch-v2`)

---

## 🛠️ Project Structure

```
├── aisearch-v2/           # Standalone Python AI search engine & web visualizer
├── api/                   # PHP backend API for board layouts, presets & SQLite database
├── css/                   # Stylesheets for visualizer & search tree visualization
├── database/              # SQLite database schema and persistent storage
├── js/
│   ├── algorithms/        # Search algorithm implementations (BFS, DFS, A*, etc.)
│   ├── core/              # Grid, component, and graph bridge logic
│   ├── router/            # Multi-net router and conflict engine
│   ├── ui/                # UI rendering and controls
│   └── app.js             # Application entry point
├── tests/                 # Node.js automated verification test suites
├── index.php              # Main web visualizer interface
├── start-server.bat       # Quick-start script for local PHP server
└── README.md
```

---

## 🚦 Getting Started

### Prerequisites
- **PHP 8.x** (with PDO SQLite enabled)
- **Node.js** (for running test suites)
- **Python 3.x** (for `aisearch-v2` backend/tools, optional)

### Running the Web Visualizer
1. Start the local PHP development server:
   ```cmd
   start-server.bat
   ```
   *Or manually:*
   ```bash
   php -S localhost:8000
   ```
2. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

### Running Test Suites
```bash
node tests/verify_algorithms.mjs
node tests/verify_conflict_challenge.mjs
node tests/verify_ripup.mjs
```

---

## 📜 Acknowledgements & Credits

- The search algorithm engine and foundational AI components in `aisearch-v2/` are based on [aisearch-v2](https://github.com/ashfaknawshad/aisearch-v2) by [Ashfak Nawshad](https://github.com/ashfaknawshad), licensed under the MIT License.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
