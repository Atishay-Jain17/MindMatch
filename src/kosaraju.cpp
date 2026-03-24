#include "kosaraju.h"
#include <stack>

void Kosaraju::dfs1(int v,
                    const std::vector<std::vector<int>>& adj,
                    std::vector<bool>& visited,
                    std::vector<int>& stk)
{
    visited[v] = true;
    for (int u : adj[v]) {
        if (!visited[u]) {
            dfs1(u, adj, visited, stk);
        }
    }
    stk.push_back(v);   
}

void Kosaraju::dfs2(int v,
                    const std::vector<std::vector<int>>& radj,
                    std::vector<bool>& visited,
                    std::vector<int>& component)
{
    visited[v] = true;
    component.push_back(v);
    for (int u : radj[v]) {
        if (!visited[u]) {
            dfs2(u, radj, visited, component);
        }
    }
}

std::vector<std::vector<int>> Kosaraju::findSCCs(const Graph& g) {
    int n = g.V;
    std::vector<bool> visited(n, false);
    std::vector<int>  stk;

    // Pass 1 – populate finish-order stack
    for (int i = 0; i < n; i++) {
        if (!visited[i]) {
            dfs1(i, g.adj, visited, stk);
        }
    }

    std::fill(visited.begin(), visited.end(), false);
    std::vector<std::vector<int>> sccs;

    while (!stk.empty()) {
        int v = stk.back();
        stk.pop_back();
        if (!visited[v]) {
            std::vector<int> comp;
            dfs2(v, g.radj, visited, comp);
            sccs.push_back(comp);
        }
    }

    return sccs;
}
