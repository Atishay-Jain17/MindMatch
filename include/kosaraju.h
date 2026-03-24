#pragma once
#include <vector>
#include "graph.h"

// ─────────────────────────────────────────────
//  KOSARAJU'S ALGORITHM  –  O(V + E)
//
//  Pass 1 : DFS on original graph G,
//           push vertices onto stack by finish time
//  Pass 2 : DFS on reversed graph G^T,
//           each DFS tree = one SCC
// ─────────────────────────────────────────────
class Kosaraju {
public:
    // Returns list of SCCs; each SCC is a list of vertex ids
    std::vector<std::vector<int>> findSCCs(const Graph& g);

private:
    void dfs1(int v,
              const std::vector<std::vector<int>>& adj,
              std::vector<bool>& visited,
              std::vector<int>& stk);

    void dfs2(int v,
              const std::vector<std::vector<int>>& radj,
              std::vector<bool>& visited,
              std::vector<int>& component);
};
