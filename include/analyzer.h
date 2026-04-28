#pragma once
#include <vector>
#include <string>
#include "graph.h"

// ─────────────────────────────────────────────
//  COMMUNITY ANALYZER
//  Wraps raw SCC output with human-readable info
// ─────────────────────────────────────────────
struct Community {
    int              id;
    std::vector<int> members;          // vertex ids
    std::vector<std::string> names;    // user names
    std::string      dominantInterest; // most common tag
    double           density;          // internal edge density
};

namespace Analyzer {
    // Convert raw SCC lists to Community structs
    std::vector<Community> buildCommunities(
        const std::vector<std::vector<int>>& sccs,
        const Graph& g);

    // Print a formatted report to stdout
    void printReport(const std::vector<Community>& communities);

    // Export to JSON string (for the UI)
    // validation: true if Kosaraju and Tarjan produced identical SCCs
    std::string toJSON(const std::vector<Community>& communities,
                       const Graph& g,
                       double threshold,
                       long long kosaraju_us,
                       long long tarjan_us,
                       bool validation = true);
}
