#pragma once
#include <vector>
#include "graph.h"

// ─────────────────────────────────────────────
//  TARJAN'S ALGORITHM  –  O(V + E)
//
//  Single DFS pass with:
//    disc[]     – discovery time
//    low[]      – lowest disc reachable
//    onStack[]  – whether vertex is on stack
//
//  SCC root: disc[v] == low[v]
// ─────────────────────────────────────────────
class Tarjan {
public:
    std::vector<std::vector<int>> findSCCs(const Graph& g);

private:
    int timer = 0;
    std::vector<int>  disc, low;
    std::vector<bool> onStack;
    std::vector<int>  stk;
    std::vector<std::vector<int>> result;

    void dfs(int v, const std::vector<std::vector<int>>& adj);
};
