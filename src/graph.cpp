#include "graph.h"
#include "similarity.h"
#include <iostream>

Graph::Graph(int V) : V(V), adj(V), radj(V) {}

void Graph::addEdge(int u, int v) {
    adj[u].push_back(v);
    radj[v].push_back(u);
}

void Graph::buildFromUsers(const std::vector<User>& us, double threshold) {
    users = us;
    V = static_cast<int>(us.size());
    adj.assign(V, {});
    radj.assign(V, {});

    for (int i = 0; i < V; i++) {
        for (int j = 0; j < V; j++) {
            if (i == j) continue;
            double sim = Similarity::jaccard(us[i], us[j]);
            if (sim >= threshold) {
                addEdge(i, j);
            }
        }
    }
}

void Graph::printGraph() const {
    for (int i = 0; i < V; i++) {
        std::cout << "[" << i << "] " << users[i].name << " -> ";
        for (int nb : adj[i]) std::cout << nb << " ";
        std::cout << "\n";
    }
}

int Graph::edgeCount() const {
    int cnt = 0;
    for (auto& row : adj) cnt += static_cast<int>(row.size());
    return cnt;
}
