/**
 * cppBridge.js — Bridge to the C++ mindmatch executable
 * 
 * Writes current users to a temp CSV, executes mindmatch.exe --json,
 * parses the resulting JSON, and returns structured data.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const dataStore = require('./dataStore');

// Paths relative to the project root
const PROJECT_ROOT = path.join(__dirname, '..', '..');
const EXE_PATH = path.join(PROJECT_ROOT, 'mindmatch.exe');
const LIVE_CSV_PATH = path.join(PROJECT_ROOT, 'data', 'users_live.csv');
const RESULT_JSON_PATH = path.join(PROJECT_ROOT, 'ui', 'result.json');

/**
 * Write current users to a CSV file that the C++ engine can read.
 * Format: id,name,interest1;interest2;...
 */
function writeUsersCsv(users) {
  const lines = ['# Mind-Match live user dataset'];
  for (const u of users) {
    lines.push(`${u.id},${u.name},${u.interests.join(';')}`);
  }
  fs.writeFileSync(LIVE_CSV_PATH, lines.join('\n') + '\n', 'utf-8');
}

/**
 * Run the C++ mindmatch executable and return parsed JSON result.
 * 
 * @param {number} threshold - Jaccard similarity threshold
 * @returns {object} Parsed JSON result from C++ engine
 */
function runSccAnalysis(threshold) {
  const users = dataStore.getUsers();
  
  if (users.length < 2) {
    // Return a minimal result for < 2 users
    return {
      meta: {
        project: "Mind-Match",
        description: "SCC-based community detection",
        algorithm: "Kosaraju (canonical) + Tarjan (comparison)",
        validation_passed: true,
        version: "1.0"
      },
      metrics: {
        vertices: users.length,
        edges: 0,
        threshold: threshold,
        community_count: users.length,
        avg_community_size: users.length > 0 ? 1.0 : 0,
        isolated_users: users.length
      },
      timings_microseconds: {
        kosaraju_us: 0,
        tarjan_us: 0,
        speedup_ratio: 1.0,
        faster_algorithm: "Tarjan"
      },
      users: users.map(u => ({ id: u.id, name: u.name, interests: u.interests })),
      edges_list: [],
      communities: users.map((u, i) => ({
        id: i,
        size: 1,
        dominant_interest: u.interests[0] || "None",
        density: 0,
        internal_edges: 0,
        unique_interests: u.interests.length,
        members: [u.id],
        names: [u.name]
      }))
    };
  }

  // Write users to CSV
  writeUsersCsv(users);

  try {
    // Execute C++ engine
    const result = execFileSync(EXE_PATH, [
      '--json', LIVE_CSV_PATH, threshold.toString()
    ], {
      cwd: PROJECT_ROOT,
      timeout: 30000,        // 30s timeout
      maxBuffer: 50 * 1024 * 1024,  // 50MB buffer for large datasets
      encoding: 'utf-8'
    });

    // The C++ output might have informational lines before JSON
    // Find the first '{' and extract JSON from there
    const jsonStart = result.indexOf('{');
    if (jsonStart === -1) {
      throw new Error('No JSON object found in C++ output');
    }
    const jsonStr = result.substring(jsonStart);
    const parsed = JSON.parse(jsonStr);

    // Also save to ui/result.json for backward compatibility
    try {
      fs.writeFileSync(RESULT_JSON_PATH, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch (e) {
      // Non-critical
    }

    // Cache the result
    dataStore.setSccResult(parsed);
    
    return parsed;
  } catch (err) {
    console.error('[CppBridge] Error executing mindmatch:', err.message);
    
    // Fall back to cached result if available
    const cached = dataStore.getSccResult();
    if (cached) {
      console.log('[CppBridge] Using cached SCC result');
      return cached;
    }
    
    throw new Error(`C++ engine failed: ${err.message}`);
  }
}

/**
 * Get SCC result, recomputing if dirty or not cached.
 */
function getSccResult(forceRecompute = false) {
  if (forceRecompute || dataStore.isSccDirty() || !dataStore.getSccResult()) {
    const threshold = dataStore.getThreshold();
    return runSccAnalysis(threshold);
  }
  return dataStore.getSccResult();
}

/**
 * Check if C++ executable exists.
 */
function isEngineAvailable() {
  return fs.existsSync(EXE_PATH);
}

module.exports = {
  runSccAnalysis,
  getSccResult,
  isEngineAvailable,
  EXE_PATH,
  PROJECT_ROOT
};
