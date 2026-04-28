#include "tarjan.h"
#include <algorithm>

// ── Recursive DFS with low-link tracking ──────────────────────────────────
// Tarjan's SCC algorithm in single DFS pass
// disc[v]   = discovery time when v is first visited
// low[v]    = minimum discovery time reachable from v (including back edges)
// onStack[] = true if v is currently on the stack
// When disc[v] == low[v], v is the root of an SCC
void Tarjan::dfs(int v, const std::vector<std::vector<int>>& adj) {
    // Mark discovery and initial low-link value
    disc[v] = low[v] = timer++;
    stk.push_back(v);
    onStack[v] = true;

    // Explore all neighbors
    for (int u : adj[v]) {
        if (disc[u] == -1) {
            // TREE EDGE: u is unvisited
            // Recursively visit u
            dfs(u, adj);
            // Pull up the lowest reachable discovery time from u's subtree
            low[v] = std::min(low[v], low[u]);
        } else if (onStack[u]) {
            // BACK EDGE: u is an ancestor still on the current DFS path
            // Update low[v] with u's discovery time (not u's low value!)
            // This is the key difference: back edges go to discovery time, not low value
            low[v] = std::min(low[v], disc[u]);
        }
        // FORWARD/CROSS edges: disc[u] != -1 && !onStack[u]
        // These are ignored in undirected SCC detection
    }

    // Check if v is an SCC root
    // If disc[v] == low[v], then v cannot reach any ancestor with lower disc time
    if (disc[v] == low[v]) {
        // Pop all vertices of this SCC from the stack
        std::vector<int> component;
        while (true) {
            int u = stk.back();
            stk.pop_back();
            onStack[u] = false;
            component.push_back(u);
            if (u == v) break;  // Stop after popping the root
        }
        result.push_back(component);
    }
}

// ── Main entry point ───────────────────────────────────────────────────────
std::vector<std::vector<int>> Tarjan::findSCCs(const Graph& g) {
    int n = g.V;
    
    // Initialize all tracking arrays
    timer   = 0;
    disc    .assign(n, -1);      // -1 means unvisited
    low     .assign(n, -1);
    onStack .assign(n, false);
    stk     .clear();
    result  .clear();

    // Call DFS from each unvisited vertex
    // This ensures we process all vertices even if graph is disconnected
    for (int i = 0; i < n; i++) {
        if (disc[i] == -1) {
            dfs(i, g.adj);
        }
    }

    return result;
}
