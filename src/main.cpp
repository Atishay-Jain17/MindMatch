/*
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   MIND-MATCH  –  SCC-Based Community Detection              ║
 * ║   Course: TCS-409 (Design & Analysis of Algorithms)         ║
 * ║   Team:   DataStellar  (DAA-IV-T151)                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * USAGE:
 *   ./mindmatch                      → generate 20-user sample, run both algos
 *   ./mindmatch <csv_file>           → load users from CSV
 *   ./mindmatch <csv_file> <thresh>  → load users with custom threshold
 *   ./mindmatch --generate <n>       → generate n-user sample dataset
 *   ./mindmatch --json <csv> <thr>   → output JSON to stdout (for UI)
 */

#include <iostream>
#include <fstream>
#include <chrono>
#include <iomanip>
#include <string>
#include <cstdlib>

#include "user.h"
#include "graph.h"
#include "similarity.h"
#include "kosaraju.h"
#include "tarjan.h"
#include "dataloader.h"
#include "analyzer.h"

using Clock = std::chrono::high_resolution_clock;

template<typename AlgoFn>
std::pair<std::vector<std::vector<int>>, long long>
timeAlgo(AlgoFn fn) {
    auto t0  = Clock::now();
    auto res = fn();
    auto t1  = Clock::now();
    long long us = std::chrono::duration_cast<std::chrono::microseconds>(t1 - t0).count();
    return {res, us};
}

// ─────────────────────────────────────────────────────────────
// VALIDATION: Check if two SCC lists are equivalent
// Two SCC lists match if they partition vertices identically
// ─────────────────────────────────────────────────────────────
bool validateSCCMatch(const std::vector<std::vector<int>>& sccs1,
                      const std::vector<std::vector<int>>& sccs2,
                      int vertexCount) {
    // Quick check: same number of components
    if (sccs1.size() != sccs2.size()) {
        return false;
    }

    // Build membership maps: vertex → SCC index for each algorithm
    std::vector<int> member1(vertexCount, -1);
    std::vector<int> member2(vertexCount, -1);

    for (size_t i = 0; i < sccs1.size(); i++) {
        for (int v : sccs1[i]) {
            member1[v] = static_cast<int>(i);
        }
    }

    for (size_t i = 0; i < sccs2.size(); i++) {
        for (int v : sccs2[i]) {
            member2[v] = static_cast<int>(i);
        }
    }

    // Check if every pair of vertices that are in same SCC in algo1
    // are also in same SCC in algo2 (they partition identically)
    for (int u = 0; u < vertexCount; u++) {
        for (int v = u + 1; v < vertexCount; v++) {
            bool sameIn1 = (member1[u] == member1[v]) && (member1[u] != -1);
            bool sameIn2 = (member2[u] == member2[v]) && (member2[u] != -1);
            if (sameIn1 != sameIn2) {
                return false;
            }
        }
    }

    return true;
}

void printBenchmark(int V, int E, long long k_us, long long t_us,
                    int k_sccs, int t_sccs) {
    std::cout << "\n┌─────────────────────────────────────────────────┐\n";
    std::cout <<   "│           ALGORITHM COMPARISON                  │\n";
    std::cout <<   "├───────────────────┬──────────────┬──────────────┤\n";
    std::cout <<   "│ Metric            │  Kosaraju    │   Tarjan     │\n";
    std::cout <<   "├───────────────────┼──────────────┼──────────────┤\n";
    std::cout <<   "│ Time (µs)         │ " << std::setw(12) << k_us
              << " │ " << std::setw(12) << t_us << " │\n";
    std::cout <<   "│ SCCs found        │ " << std::setw(12) << k_sccs
              << " │ " << std::setw(12) << t_sccs << " │\n";
    std::cout <<   "│ DFS passes        │ " << std::setw(12) << "2"
              << " │ " << std::setw(12) << "1" << " │\n";
    std::cout <<   "│ Complexity        │ " << std::setw(12) << "O(V+E)"
              << " │ " << std::setw(12) << "O(V+E)" << " │\n";
    std::cout <<   "├───────────────────┼──────────────┼──────────────┤\n";
    std::cout <<   "│ Vertices (V)      │ " << std::setw(25) << V << " │\n";
    std::cout <<   "│ Edges (E)         │ " << std::setw(25) << E << " │\n";
    std::cout <<   "└─────────────────────────────────────────────────┘\n";
}

int main(int argc, char* argv[]) {

    bool jsonMode    = false;
    bool generateMode = false;
    std::string csvPath;
    double threshold = 0.3;
    int    genCount  = 20;

    for (int i = 1; i < argc; i++) {
        std::string arg = argv[i];
        if (arg == "--json") {
            jsonMode = true;
        } else if (arg == "--generate") {
            generateMode = true;
            if (i + 1 < argc) genCount = std::atoi(argv[++i]);
        } else if (csvPath.empty() && arg[0] != '-') {
            csvPath = arg;
        } else {
            try { threshold = std::stod(arg); } catch (...) {}
        }
    }

    std::vector<User> users;
    if (generateMode) {
        users = DataLoader::generateSample(genCount);
        DataLoader::saveCSV("data/generated.csv", users);
    } else if (!csvPath.empty()) {
        users = DataLoader::loadCSV(csvPath);
    } else {

        users = {
            {0, "Atishay",  {"Python","ML","Graphs","Algorithms"}},
            {1, "Sarthak",  {"Graphs","C++","Algorithms","Competitive Programming"}},
            {2, "Suhani",   {"Python","Data Structures","ML","Databases"}},
            {3, "Vinayak",  {"C++","Systems","Algorithms","Compilers"}},
            {4, "Ananya",   {"Music","Photography","Writing","Reading"}},
            {5, "Rohan",    {"Music","Gaming","Writing","Photography"}},
            {6, "Priya",    {"Finance","Investing","Economics","Mathematics"}},
            {7, "Arjun",    {"Mathematics","Physics","Algorithms","Graph Theory"}},
            {8, "Neha",     {"Web Development","JavaScript","Frontend","Backend"}},
            {9, "Karan",    {"Backend","Databases","Cloud","DevOps"}},
            {10,"Divya",    {"Deep Learning","ML","Python","NLP"}},
            {11,"Amit",     {"NLP","Computer Vision","Deep Learning","Python"}},
        };
    }

    if (users.empty()) {
        std::cerr << "No users loaded. Exiting.\n";
        return 1;
    }

    if (!jsonMode) {
        std::cout << "\n[MindMatch] Building directed interest graph...\n";
        std::cout << "  Users: " << users.size()
                  << "  |  Threshold: " << std::fixed << std::setprecision(2) << threshold << "\n";
    }

    Graph g(static_cast<int>(users.size()));
    g.buildFromUsers(users, threshold);

    if (!jsonMode) {
        std::cout << "  Vertices: " << g.V << "  |  Edges: " << g.edgeCount() << "\n";
    }


    // Run Kosaraju's algorithm
    Kosaraju kosaraju;
    auto [k_sccs, k_us] = timeAlgo([&]{ return kosaraju.findSCCs(g); });

    // Run Tarjan's algorithm
    Tarjan tarjan;
    auto [t_sccs, t_us] = timeAlgo([&]{ return tarjan.findSCCs(g); });

    // ─────────────────────────────────────────────────────────────
    // VALIDATION: Verify both algorithms produce identical SCCs
    // ─────────────────────────────────────────────────────────────
    bool sccsMatch = validateSCCMatch(k_sccs, t_sccs, g.V);
    
    if (!jsonMode && !sccsMatch) {
        std::cerr << "\n⚠ WARNING: SCC mismatch between Kosaraju and Tarjan!\n";
        std::cerr << "  Kosaraju SCCs: " << k_sccs.size() << "\n";
        std::cerr << "  Tarjan SCCs:   " << t_sccs.size() << "\n";
    }

    // Use Kosaraju results as canonical
    auto communities = Analyzer::buildCommunities(k_sccs, g);

    if (jsonMode) {
        std::cout << Analyzer::toJSON(communities, g, threshold, k_us, t_us, sccsMatch);
    } else {
        Analyzer::printReport(communities);
        printBenchmark(g.V, g.edgeCount(), k_us, t_us,
                       (int)k_sccs.size(), (int)t_sccs.size());
        std::cout << "\n[MindMatch] Done.\n\n";

        std::ofstream jf("ui/result.json");
        jf << Analyzer::toJSON(communities, g, threshold, k_us, t_us, sccsMatch);
        std::cout << "[MindMatch] JSON result saved to ui/result.json\n";
    }

    return 0;
}
