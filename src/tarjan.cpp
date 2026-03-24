#include "tarjan.h"
#include <algorithm>

// ── Recursive DFS with low-link tracking ──────────────────────────────────
void Tarjan::dfs(int v, const std::vector<std::vector<int>>& adj) {
    disc[v] = low[v] = timer++;
    stk.push_back(v);
    onStack[v] = true;

    for (int u : adj[v]) {
        if (disc[u] == -1) {
            // Tree edge: recurse then pull up low value
            dfs(u, adj);
            low[v] = std::min(low[v], low[u]);
        } else if (onStack[u]) {
            // Back edge to ancestor still on stack
            low[v] = std::min(low[v], disc[u]);
        }
    }

    // v is the root of an SCC when disc[v] == low[v]
    if (disc[v] == low[v]) {
        std::vector<int> comp;
        while (true) {
            int u = stk.back();
            stk.pop_back();
            onStack[u] = false;
            comp.push_back(u);
            if (u == v) break;
        }
        result.push_back(comp);
    }
}

// ── Main entry point ───────────────────────────────────────────────────────
std::vector<std::vector<int>> Tarjan::findSCCs(const Graph& g) {
    int n = g.V;
    timer   = 0;
    disc    .assign(n, -1);
    low     .assign(n, -1);
    onStack .assign(n, false);
    stk     .clear();
    result  .clear();

    for (int i = 0; i < n; i++) {
        if (disc[i] == -1) {
            dfs(i, g.adj);
        }
    }

    return result;
}
