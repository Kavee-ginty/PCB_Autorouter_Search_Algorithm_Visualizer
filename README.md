# PCB Autorouter Search Algorithm Visualizer

An interactive AI-powered single-layer PCB autorouter and search algorithm visualizer. This tool demonstrates and benchmarks various artificial intelligence pathfinding and search algorithms on a discrete printed circuit board (PCB) grid, featuring dynamic component placement, trace routing, conflict resolution, and rip-up & reroute capabilities.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

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
  - Layout saving & loading via Serverless API and browser LocalStorage
  - Multi-format exports (PNG, SVG, JSON, CSV)
  - Standalone Python AI Search Engine (`aisearch-v2`)

---

## ☁️ Deploying to Vercel

The project is fully pre-configured for zero-configuration, production deployment on **Vercel**:

### Option 1: One-Click Deploy via Vercel Web Dashboard
1. Push your repository to GitHub / GitLab / Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) and import the repository.
3. Keep default settings (Framework Preset: **Other**) and click **Deploy**.

### Option 2: Deploy via Vercel CLI
```bash
npm install -g vercel
vercel
```
For production release:
```bash
vercel --prod
```

---

## 🛠️ Project Structure

```
├── .vercelignore           # Ignore rules for lightweight Vercel builds
├── vercel.json             # Vercel deployment configuration & API rewrites
├── package.json            # Node.js manifest and test scripts
├── index.html              # Main web visualizer interface (Production / Vercel)
├── index.php               # Local PHP development interface
├── api/
│   ├── presets.js          # Vercel Serverless Function for circuit presets
│   ├── boards.js           # Vercel Serverless Function for saved boards & logs
│   ├── presets.php         # Local PHP presets endpoint
│   ├── boards.php          # Local PHP boards endpoint
│   └── db.php              # Local SQLite database initialization
├── css/                    # Stylesheets for visualizer & search tree visualization
├── database/               # SQLite database schema and persistent storage
├── js/
│   ├── algorithms/         # Search algorithm implementations (BFS, DFS, A*, etc.)
│   ├── core/               # Grid, component, and graph bridge logic
│   ├── router/             # Multi-net router and conflict engine
│   ├── ui/                 # UI rendering and controls
│   └── app.js              # Application entry point
├── tests/                  # Automated verification test suites
├── aisearch-v2/            # Standalone Python AI search engine & web visualizer
├── start-server.bat        # Quick-start script for local PHP server
└── README.md
```

---

## 🚦 Local Development

### Running the Web Visualizer

**Option A: Local Static / Serverless Server (Node.js)**
```bash
npx serve .
```

**Option B: Local PHP Server**
```cmd
start-server.bat
```
*Or manually:*
```bash
php -S localhost:8000
```

### Running Test Suites
```bash
npm test
```
*Or individually:*
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
