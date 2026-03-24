#include "dataloader.h"
#include <fstream>
#include <sstream>
#include <iostream>
#include <random>
#include <algorithm>

namespace DataLoader {

static std::set<std::string> parseInterests(const std::string& s) {
    std::set<std::string> out;
    std::stringstream ss(s);
    std::string token;
    while (std::getline(ss, token, ';')) {
        // trim whitespace
        token.erase(0, token.find_first_not_of(" \t\r\n"));
        token.erase(token.find_last_not_of(" \t\r\n") + 1);
        if (!token.empty()) out.insert(token);
    }
    return out;
}

std::vector<User> loadCSV(const std::string& filepath) {
    std::vector<User> users;
    std::ifstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "[DataLoader] Cannot open: " << filepath << "\n";
        return users;
    }

    std::string line;
    while (std::getline(file, line)) {
        if (line.empty() || line[0] == '#') continue;

        std::stringstream ss(line);
        std::string id_s, name, interests_s;

        if (!std::getline(ss, id_s,        ',')) continue;
        if (!std::getline(ss, name,        ',')) continue;
        if (!std::getline(ss, interests_s      )) continue;

        int id = std::stoi(id_s);
        users.emplace_back(id, name, parseInterests(interests_s));
    }

    std::cout << "[DataLoader] Loaded " << users.size() << " users from " << filepath << "\n";
    return users;
}

void saveCSV(const std::string& filepath, const std::vector<User>& users) {
    std::ofstream file(filepath);
    file << "# id,name,interests (semicolon-separated)\n";
    for (auto& u : users) {
        file << u.id << "," << u.name << ",";
        bool first = true;
        for (auto& interest : u.interests) {
            if (!first) file << ";";
            file << interest;
            first = false;
        }
        file << "\n";
    }
    std::cout << "[DataLoader] Saved " << users.size() << " users to " << filepath << "\n";
}

std::vector<User> generateSample(int count) {
    static const std::vector<std::string> ALL_INTERESTS = {
        "Python","C++","Java","JavaScript","Rust","Go",
        "Machine Learning","Deep Learning","NLP","Computer Vision",
        "Algorithms","Data Structures","Graph Theory","Competitive Programming",
        "Web Development","Backend","Frontend","DevOps","Cloud","Databases",
        "Cybersecurity","Networking","Operating Systems","Compilers",
        "Music","Photography","Painting","Writing","Reading","Gaming",
        "Football","Cricket","Basketball","Swimming","Hiking",
        "Finance","Investing","Blockchain","Economics",
        "Physics","Mathematics","Chemistry","Biology"
    };

    static const std::vector<std::string> FIRST_NAMES = {
        "Atishay","Sarthak","Suhani","Vinayak","Ananya","Rohan","Priya","Arjun",
        "Neha","Karan","Divya","Amit","Pooja","Ravi","Sneha","Vishal",
        "Ishaan","Nidhi","Aditya","Kavya","Rahul","Simran","Vikas","Megha",
        "Yash","Tanya","Kunal","Isha","Nikhil","Shreya","Harsh","Mansi"
    };

    std::mt19937 rng(42);  

    int numClusters = std::max(3, count / 8);
    std::vector<std::vector<std::string>> clusterCores(numClusters);

    for (int c = 0; c < numClusters; c++) {
        std::vector<std::string> pool = ALL_INTERESTS;
        std::shuffle(pool.begin(), pool.end(), rng);
        int coreSize = 3 + (rng() % 3);
        for (int i = 0; i < coreSize && i < (int)pool.size(); i++)
            clusterCores[c].push_back(pool[i]);
    }

    std::vector<User> users;
    std::uniform_int_distribution<int> clusterDist(0, numClusters - 1);
    std::uniform_int_distribution<int> extraDist(0, (int)ALL_INTERESTS.size() - 1);
    std::uniform_int_distribution<int> nameDist(0, (int)FIRST_NAMES.size() - 1);

    for (int i = 0; i < count; i++) {
        int cluster = clusterDist(rng);
        std::set<std::string> interests(clusterCores[cluster].begin(),
                                        clusterCores[cluster].end());

    
        int extras = 1 + (rng() % 3);
        for (int e = 0; e < extras; e++)
            interests.insert(ALL_INTERESTS[extraDist(rng)]);

        std::string name = FIRST_NAMES[nameDist(rng)] + "_" + std::to_string(i);
        users.emplace_back(i, name, interests);
    }

    return users;
}

}