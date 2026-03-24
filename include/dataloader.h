#pragma once
#include <vector>
#include <string>
#include "user.h"

// ─────────────────────────────────────────────
//  DATA LOADER
//  Reads CSV format:
//    id,name,interest1;interest2;interest3
//  Lines starting with '#' are comments.
// ─────────────────────────────────────────────
namespace DataLoader {
    std::vector<User> loadCSV(const std::string& filepath);
    void              saveCSV(const std::string& filepath, const std::vector<User>& users);
    std::vector<User> generateSample(int count);   // synthetic dataset
}
