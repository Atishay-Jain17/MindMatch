# Mind-Match
### SCC-Based Community Detection in Directed Interest Graphs
**Course:** TCS-409 – Design & Analysis of Algorithms  
**Team:** DataStellar · DAA-IV-T151  
**Members:** Atishay Jain · Sarthak Kathait · Suhani Dangwal · Vinayak Singh

---

## Project Structure

```
mindmatch/
├── include/               # Header files (one per module)
│   ├── user.h             # User data struct
│   ├── graph.h            # Directed graph (adjacency list)
│   ├── similarity.h       # Jaccard similarity
│   ├── kosaraju.h         # Kosaraju's SCC algorithm
│   ├── tarjan.h           # Tarjan's SCC algorithm
│   ├── dataloader.h       # CSV I/O + sample generator
│   └── analyzer.h         # Community stats + JSON export
│
├── src/                   # Implementation files
│   ├── main.cpp           # Entry point (CLI)
│   ├── graph.cpp
│   ├── similarity.cpp
│   ├── kosaraju.cpp
│   ├── tarjan.cpp
│   ├── dataloader.cpp
│   └── analyzer.cpp
│
├── data/
│   └── sample.csv         # 20-user sample dataset
│
├── ui/
│   └── index.html         # Full web UI (open in browser)
│
├── Makefile
└── README.md
```

---

## Build & Run

### Prerequisites
- g++ with C++17 support
- `make`

### Build
```bash
make
```

### Run (demo 12-user dataset)
```bash
./mindmatch
```

### Run with your CSV
```bash
./mindmatch data/sample.csv 0.30
```

### Generate a synthetic dataset and run
```bash
./mindmatch --generate 100
./mindmatch data/generated.csv 0.25
```

### Export JSON for the UI
```bash
./mindmatch --json data/sample.csv 0.30 > ui/result.json
```

---

## CSV Format

```
# id,name,interest1;interest2;interest3
0,Atishay,Python;ML;Graphs;Algorithms
1,Sarthak,Graphs;C++;Algorithms
```

---

## Web UI

Open `ui/index.html` in any modern browser.

- **Graph tab** – interactive force-directed / circular / cluster layout
- **Users tab** – full user table with community membership
- **Benchmark tab** – Kosaraju vs Tarjan timing + SCC size chart
- **Detail tab** – per-community member cards with interest tags

To load your own run results:
```bash
./mindmatch --json data/sample.csv 0.30 > ui/result.json
```
Then click **Upload JSON result** in the UI and select `ui/result.json`.

Or click **Load Built-in Demo** to explore immediately.

---

## Algorithms

| Property | Kosaraju | Tarjan |
|---|---|---|
| DFS passes | 2 | 1 |
| Time complexity | O(V + E) | O(V + E) |
| Extra space | O(V) stack + reversed graph | O(V) stack + disc/low arrays |
| Key idea | Finish-time ordering on Gᵀ | Low-link values detect SCC roots |

---

## Phase Coverage

| Milestone | Status |
|---|---|
| M1 – Graph Modelling | ✓ Phase 1 |
| M2 – Kosaraju Implementation | ✓ Phase 1 |
| M3 – Tarjan Implementation | ✓ Phase 2 |
| M4 – Benchmarking & Analysis | ✓ Phase 2 |
