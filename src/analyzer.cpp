#include "analyzer.h"
#include <iostream>
#include <iomanip>
#include <sstream>
#include <map>
#include <algorithm>

namespace Analyzer {

std::vector<Community> buildCommunities(
    const std::vector<std::vector<int>>& sccs,
    const Graph& g)
{
    std::vector<Community> comms;
    int idx = 0;
    for (auto& scc : sccs) {
        Community c;
        c.id      = idx++;
        c.members = scc;

        for (int vid : scc) {
            if (vid < (int)g.users.size())
                c.names.push_back(g.users[vid].name);
        }

        std::map<std::string, int> freq;
        for (int vid : scc) {
            if (vid < (int)g.users.size()) {
                for (auto& tag : g.users[vid].interests)
                    freq[tag]++;
            }
        }
        if (!freq.empty()) {
            auto best = std::max_element(freq.begin(), freq.end(),
                [](auto& a, auto& b){ return a.second < b.second; });
            c.dominantInterest = best->first;
        } else {
            c.dominantInterest = "—";
        }

        int internal = 0;
        std::set<int> memberSet(scc.begin(), scc.end());
        for (int vid : scc) {
            if (vid < (int)g.adj.size()) {
                for (int nb : g.adj[vid]) {
                    if (memberSet.count(nb)) internal++;
                }
            }
        }
        int n = (int)scc.size();
        double maxEdges = (double)n * (n - 1);  // directed
        c.density = (maxEdges > 0) ? (double)internal / maxEdges : 0.0;

        comms.push_back(c);
    }
    return comms;
}

void printReport(const std::vector<Community>& communities) {
    std::cout << "\n╔══════════════════════════════════════════════════╗\n";
    std::cout <<   "║        MIND-MATCH  –  Community Report           ║\n";
    std::cout <<   "╚══════════════════════════════════════════════════╝\n\n";

    int total = (int)communities.size();
    std::cout << "Total communities detected: " << total << "\n\n";

    for (auto& c : communities) {
        std::cout << "  ── Community #" << c.id + 1 << " ──────────────────────────\n";
        std::cout << "  Size            : " << c.members.size() << " member(s)\n";
        std::cout << "  Dominant tag    : " << c.dominantInterest << "\n";
        std::cout << "  Density         : " << std::fixed << std::setprecision(2)
                  << c.density * 100.0 << "%\n";
        std::cout << "  Members         : ";
        for (auto& nm : c.names) std::cout << nm << "  ";
        std::cout << "\n\n";
    }
}

static std::string escapeJSON(const std::string& s) {
    std::string out;
    for (char ch : s) {
        if (ch == '"')  out += "\\\"";
        else if (ch == '\\') out += "\\\\";
        else if (ch == '\n') out += "\\n";
        else out += ch;
    }
    return out;
}

std::string toJSON(const std::vector<Community>& communities,
                   const Graph& g,
                   double threshold,
                   long long kosaraju_us,
                   long long tarjan_us)
{
    std::ostringstream j;
    j << "{\n";

    j << "  \"vertices\": " << g.V << ",\n";
    j << "  \"edges\": "    << g.edgeCount() << ",\n";
    j << "  \"threshold\": " << std::fixed << std::setprecision(3) << threshold << ",\n";
    j << "  \"kosaraju_us\": " << kosaraju_us << ",\n";
    j << "  \"tarjan_us\": "   << tarjan_us   << ",\n";
    j << "  \"community_count\": " << communities.size() << ",\n";

    j << "  \"users\": [\n";
    for (int i = 0; i < (int)g.users.size(); i++) {
        auto& u = g.users[i];
        j << "    {\"id\": " << u.id
          << ", \"name\": \"" << escapeJSON(u.name) << "\""
          << ", \"interests\": [";
        bool first = true;
        for (auto& tag : u.interests) {
            if (!first) j << ", ";
            j << "\"" << escapeJSON(tag) << "\"";
            first = false;
        }
        j << "]}";
        if (i + 1 < (int)g.users.size()) j << ",";
        j << "\n";
    }
    j << "  ],\n";

    j << "  \"edges_list\": [\n";
    bool firstEdge = true;
    for (int u = 0; u < g.V; u++) {
        for (int v : g.adj[u]) {
            if (!firstEdge) j << ",\n";
            j << "    {\"from\": " << u << ", \"to\": " << v << "}";
            firstEdge = false;
        }
    }
    j << "\n  ],\n";

    j << "  \"communities\": [\n";
    for (int ci = 0; ci < (int)communities.size(); ci++) {
        auto& c = communities[ci];
        j << "    {\n";
        j << "      \"id\": " << c.id << ",\n";
        j << "      \"dominant_interest\": \"" << escapeJSON(c.dominantInterest) << "\",\n";
        j << "      \"density\": " << std::fixed << std::setprecision(4) << c.density << ",\n";
        j << "      \"members\": [";
        for (int mi = 0; mi < (int)c.members.size(); mi++) {
            if (mi > 0) j << ", ";
            j << c.members[mi];
        }
        j << "],\n";
        j << "      \"names\": [";
        for (int ni = 0; ni < (int)c.names.size(); ni++) {
            if (ni > 0) j << ", ";
            j << "\"" << escapeJSON(c.names[ni]) << "\"";
        }
        j << "]\n";
        j << "    }";
        if (ci + 1 < (int)communities.size()) j << ",";
        j << "\n";
    }
    j << "  ]\n";

    j << "}\n";
    return j.str();
}

}
