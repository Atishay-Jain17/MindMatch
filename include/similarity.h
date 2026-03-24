#pragma once
#include "user.h"

// ─────────────────────────────────────────────
//  SIMILARITY  –  Jaccard coefficient
//  sim(u,v) = |A ∩ B| / |A ∪ B|
//  Returns value in [0.0, 1.0]
// ─────────────────────────────────────────────
namespace Similarity {
    double jaccard(const User& u, const User& v);
}
