#pragma once
#include <string>
#include <vector>
#include <set>

// ─────────────────────────────────────────────
//  USER  –  a vertex in the interest graph
// ─────────────────────────────────────────────
struct User {
    int         id;
    std::string name;
    std::set<std::string> interests;   // raw interest tags

    User() : id(-1) {}
    User(int id, const std::string& name, const std::set<std::string>& interests)
        : id(id), name(name), interests(interests) {}
};
