#pragma once
#include <vector>
#include <string>
#include <unordered_map>
#include "user.h"

// ─────────────────────────────────────────────
//  DIRECTED GRAPH  –  adjacency list
// ─────────────────────────────────────────────
class Graph {
public:
    int V;                                   // number of vertices
    std::vector<std::vector<int>> adj;       // adj[u] = list of v where edge u->v exists
    std::vector<std::vector<int>> radj;      // reversed graph (used by Kosaraju)
    std::vector<User> users;                 // user data indexed by vertex id

    explicit Graph(int V);

    // Add a directed edge u -> v
    void addEdge(int u, int v);

    // Build both graphs from users + similarity threshold
    void buildFromUsers(const std::vector<User>& users, double threshold);

    // Print adjacency list to stdout
    void printGraph() const;

    // Return number of edges
    int edgeCount() const;
};
