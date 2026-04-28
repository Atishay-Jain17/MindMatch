/**
 * matchEngine.js — Intelligent community matching & explanation
 * 
 * Computes match scores between a user and each community,
 * generates human-readable explanations, and provides discovery/trending data.
 */

const dataStore = require('./dataStore');
const cppBridge = require('./cppBridge');

/**
 * Compute Jaccard similarity between two interest arrays.
 */
function jaccard(interestsA, interestsB) {
  const setA = new Set(interestsA);
  const setB = new Set(interestsB);
  const intersection = [...setA].filter(x => setB.has(x));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.length / union.size;
}

/**
 * Find the best matching communities for a user.
 * Returns an array sorted by match score (descending).
 * 
 * @param {number} userId - The user ID to match
 * @returns {Array} Matched communities with scores and explanations
 */
function findMatches(userId) {
  const user = dataStore.getUserById(userId);
  if (!user) throw new Error(`User ${userId} not found`);

  const sccResult = cppBridge.getSccResult();
  if (!sccResult || !sccResult.communities) {
    return [];
  }

  const matches = [];

  for (const community of sccResult.communities) {
    // Gather all interests of community members
    const communityInterests = new Set();
    const communityUsers = [];

    for (const memberId of community.members) {
      const sccUser = sccResult.users.find(u => u.id === memberId);
      if (sccUser) {
        sccUser.interests.forEach(i => communityInterests.add(i));
        communityUsers.push(sccUser);
      }
    }

    // Compute match
    const userInterests = new Set(user.interests);
    const sharedInterests = [...userInterests].filter(i => communityInterests.has(i));
    const matchScore = sharedInterests.length / Math.max(userInterests.size, 1);
    const jaccardScore = jaccard(user.interests, [...communityInterests]);

    // Check if user is already in this community
    const isMember = community.members.includes(userId);

    // Generate explanation
    let explanation;
    if (sharedInterests.length === 0) {
      explanation = "No shared interests with this community.";
    } else {
      explanation = `You share: ${sharedInterests.join(', ')} (${sharedInterests.length}/${user.interests.length} overlap)`;
    }

    matches.push({
      communityId: community.id,
      communitySize: community.size,
      dominantInterest: community.dominant_interest,
      density: community.density,
      matchScore: Math.round(matchScore * 100),
      jaccardScore: Math.round(jaccardScore * 100),
      sharedInterests,
      sharedCount: sharedInterests.length,
      totalUserInterests: user.interests.length,
      isMember,
      explanation,
      memberNames: community.names
    });
  }

  // Sort by match score descending
  matches.sort((a, b) => b.matchScore - a.matchScore);
  return matches;
}

/**
 * Get discover/trending communities.
 */
function getDiscoverData() {
  const sccResult = cppBridge.getSccResult();
  if (!sccResult || !sccResult.communities) {
    return { suggested: [], trending: [], largest: [] };
  }

  const communities = sccResult.communities;

  // Largest communities
  const largest = [...communities]
    .filter(c => c.size > 1)
    .sort((a, b) => b.size - a.size)
    .slice(0, 5);

  // Most dense (tightest-knit)
  const trending = [...communities]
    .filter(c => c.size > 1)
    .sort((a, b) => b.density - a.density)
    .slice(0, 5);

  // Most diverse interests
  const suggested = [...communities]
    .filter(c => c.size > 1)
    .sort((a, b) => (b.unique_interests || 0) - (a.unique_interests || 0))
    .slice(0, 5);

  return { suggested, trending, largest };
}

/**
 * Get analytics data across all communities.
 */
function getAnalytics() {
  const sccResult = cppBridge.getSccResult();
  if (!sccResult) {
    return {
      totalUsers: 0,
      totalCommunities: 0,
      totalEdges: 0,
      avgCommunitySize: 0,
      communitySizes: [],
      interestDistribution: {},
      densityDistribution: [],
      algorithmTimings: null
    };
  }

  // Interest distribution across all users
  const interestDist = {};
  for (const user of (sccResult.users || [])) {
    for (const interest of user.interests) {
      interestDist[interest] = (interestDist[interest] || 0) + 1;
    }
  }

  // Community size distribution
  const communitySizes = (sccResult.communities || []).map(c => ({
    id: c.id,
    size: c.size,
    dominantInterest: c.dominant_interest
  }));

  // Density distribution
  const densityDist = (sccResult.communities || []).map(c => ({
    id: c.id,
    density: c.density
  }));

  return {
    totalUsers: sccResult.metrics?.vertices || 0,
    totalCommunities: sccResult.metrics?.community_count || 0,
    totalEdges: sccResult.metrics?.edges || 0,
    threshold: sccResult.metrics?.threshold || 0.3,
    avgCommunitySize: sccResult.metrics?.avg_community_size || 0,
    isolatedUsers: sccResult.metrics?.isolated_users || 0,
    communitySizes,
    interestDistribution: interestDist,
    densityDistribution: densityDist,
    algorithmTimings: sccResult.timings_microseconds || null
  };
}

/**
 * Interest intelligence — given a set of interests, find matching
 * communities, top users, and connectivity scores.
 */
function getInterestIntelligence(interests) {
  const sccResult = cppBridge.getSccResult();
  if (!sccResult) return { communities: [], topUsers: [], connectivity: 0 };

  const querySet = new Set(interests);
  const allUsers = sccResult.users || [];
  const communities = sccResult.communities || [];

  // Find matching communities
  const commMatches = communities.filter(c => c.size > 1).map(c => {
    const commInterests = new Set();
    c.members.forEach(mid => {
      const u = allUsers.find(x => x.id === mid);
      if (u) u.interests.forEach(i => commInterests.add(i));
    });
    const shared = [...querySet].filter(i => commInterests.has(i));
    const score = Math.round((shared.length / Math.max(querySet.size, 1)) * 100);
    return { communityId: c.id, name: c.dominant_interest, size: c.size, density: c.density, score, shared };
  }).filter(m => m.score > 0).sort((a,b) => b.score - a.score).slice(0, 8);

  // Top users with these interests
  const userScores = allUsers.map(u => {
    const overlap = u.interests.filter(i => querySet.has(i));
    return { id: u.id, name: u.name, interests: u.interests, overlap, score: overlap.length };
  }).filter(u => u.score > 0).sort((a,b) => b.score - a.score).slice(0, 10);

  // Connectivity score: average Jaccard between all user-pairs who share these interests
  const relevant = allUsers.filter(u => u.interests.some(i => querySet.has(i)));
  let totalJ = 0, pairCount = 0;
  for (let i = 0; i < relevant.length && i < 100; i++) {
    for (let j = i + 1; j < relevant.length && j < 100; j++) {
      totalJ += jaccard(relevant[i].interests, relevant[j].interests);
      pairCount++;
    }
  }
  const connectivity = pairCount > 0 ? Math.round((totalJ / pairCount) * 100) : 0;

  return { communities: commMatches, topUsers: userScores, connectivity, totalRelevant: relevant.length };
}

module.exports = {
  findMatches,
  getDiscoverData,
  getAnalytics,
  getInterestIntelligence,
  jaccard
};
