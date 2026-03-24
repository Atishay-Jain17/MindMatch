#include "similarity.h"
#include <set>
#include <algorithm>

namespace Similarity {

double jaccard(const User& u, const User& v) {
    if (u.interests.empty() && v.interests.empty()) return 0.0;

    // Intersection
    std::vector<std::string> inter;
    std::set_intersection(
        u.interests.begin(), u.interests.end(),
        v.interests.begin(), v.interests.end(),
        std::back_inserter(inter));

    // Union
    std::vector<std::string> uni;
    std::set_union(
        u.interests.begin(), u.interests.end(),
        v.interests.begin(), v.interests.end(),
        std::back_inserter(uni));

    if (uni.empty()) return 0.0;
    return static_cast<double>(inter.size()) / static_cast<double>(uni.size());
}

} // namespace Similarity
