/**
 * dataStore.js — JSON file-based persistence layer
 * 
 * Stores dynamic runtime data (users, join requests, chat messages, settings)
 * in a single JSON file. No external database required.
 */

const fs = require('fs');
const path = require('path');

const STORE_PATH = path.join(__dirname, '..', 'data', 'store.json');

// Random name parts for bulk generation
const FIRST_NAMES = ['Aarav','Vivaan','Aditya','Vihaan','Arjun','Reyansh','Sai','Arnav','Dhruv','Kabir','Rishi','Ananya','Diya','Myra','Sara','Isha','Kavya','Aanya','Priya','Neha','Rahul','Amit','Rohan','Kiran','Meera','Tanvi','Harsh','Neel','Zara','Tara','Riya','Aryan','Dev','Jay','Mira','Nisha','Pooja','Raj','Sid','Uma','Varun','Yash'];
const LAST_NAMES = ['Sharma','Patel','Singh','Kumar','Gupta','Jain','Shah','Verma','Reddy','Rao','Das','Nair','Iyer','Chopra','Mehta','Bose','Pal','Roy','Sen','Dutta'];

// Default store structure
const DEFAULT_STORE = {
  users: [],
  joinRequests: [],
  chatMessages: {},
  settings: { threshold: 0.3 },
  lastSccResult: null,
  sccDirty: true,
  eventLog: []              // { type, message, timestamp }
};

// All 38 interest tags from the C++ data generator
const ALL_INTERESTS = [
  "Python", "ML", "Graphs", "Algorithms", "C++", "Data Structures",
  "Competitive Programming", "Databases", "Web Development", "JavaScript",
  "Frontend", "Backend", "Deep Learning", "NLP", "Computer Vision",
  "Cloud", "DevOps", "Docker", "Kubernetes", "Blockchain",
  "Finance", "Investing", "Economics", "Mathematics", "Physics",
  "Quantum Computing", "Research", "Music", "Photography", "Writing",
  "Reading", "Gaming", "Art", "Painting", "Philosophy",
  "Psychology", "Systems", "Compilers"
];

let store = null;

function load() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf-8');
      store = JSON.parse(raw);
      // Merge in any missing keys from default
      for (const key of Object.keys(DEFAULT_STORE)) {
        if (!(key in store)) {
          store[key] = DEFAULT_STORE[key];
        }
      }
    } else {
      store = JSON.parse(JSON.stringify(DEFAULT_STORE));
      save();
    }
  } catch (err) {
    console.error('[DataStore] Error loading store, resetting:', err.message);
    store = JSON.parse(JSON.stringify(DEFAULT_STORE));
    save();
  }
  return store;
}

function save() {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[DataStore] Error saving store:', err.message);
  }
}

function getStore() {
  if (!store) load();
  return store;
}

// ── User operations ──────────────────────────────────

function getUsers() {
  return getStore().users;
}

function getUserById(id) {
  return getStore().users.find(u => u.id === id);
}

function addUser(name, interests) {
  const s = getStore();
  const id = s.users.length > 0 ? Math.max(...s.users.map(u => u.id)) + 1 : 0;
  const user = { id, name, interests: [...new Set(interests)] };
  s.users.push(user);
  s.sccDirty = true;
  save();
  return user;
}

function getNextUserId() {
  const s = getStore();
  return s.users.length > 0 ? Math.max(...s.users.map(u => u.id)) + 1 : 0;
}

// ── Bulk operations ──────────────────────────────────

function generateRandomUsers(count) {
  const s = getStore();
  const created = [];
  for (let i = 0; i < count; i++) {
    const id = s.users.length > 0 ? Math.max(...s.users.map(u => u.id)) + 1 : 0;
    const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
    const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
    const name = `${first} ${last.charAt(0)}.`;
    // Pick 3-5 interests with clustering: pick a base cluster of 2-3, then random extras
    const numInterests = 3 + Math.floor(Math.random() * 3);
    const pool = [...ALL_INTERESTS];
    const interests = [];
    // Cluster: pick a starting region in the array
    const clusterStart = Math.floor(Math.random() * (pool.length - 4));
    const clusterSize = 2 + Math.floor(Math.random() * 2);
    for (let j = 0; j < clusterSize && interests.length < numInterests; j++) {
      interests.push(pool[clusterStart + j]);
    }
    // Random extras
    while (interests.length < numInterests) {
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (!interests.includes(pick)) interests.push(pick);
    }
    const user = { id, name, interests };
    s.users.push(user);
    created.push(user);
  }
  s.sccDirty = true;
  save();
  return created;
}

function removeUsers(count) {
  const s = getStore();
  const toRemove = Math.min(count, s.users.length);
  const removed = s.users.splice(-toRemove, toRemove);
  s.sccDirty = true;
  save();
  return removed;
}

// ── Event log ────────────────────────────────────────

function addEvent(type, message) {
  const s = getStore();
  s.eventLog.push({ type, message, timestamp: new Date().toISOString() });
  if (s.eventLog.length > 100) s.eventLog = s.eventLog.slice(-100);
  save();
}

function getEventLog(limit = 20) {
  const s = getStore();
  return (s.eventLog || []).slice(-limit).reverse();
}

// ── Community / SCC operations ───────────────────────

function setSccResult(result) {
  const s = getStore();
  s.lastSccResult = result;
  s.sccDirty = false;
  save();
}

function getSccResult() {
  return getStore().lastSccResult;
}

function isSccDirty() {
  return getStore().sccDirty;
}

function markSccDirty() {
  const s = getStore();
  s.sccDirty = true;
  save();
}

// ── Join request operations ──────────────────────────

function addJoinRequest(userId, communityId) {
  const s = getStore();
  // Prevent duplicates
  const existing = s.joinRequests.find(
    r => r.userId === userId && r.communityId === communityId && r.status === 'pending'
  );
  if (existing) return existing;

  const req = {
    id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    communityId,
    status: 'pending',
    timestamp: new Date().toISOString()
  };
  s.joinRequests.push(req);
  save();
  return req;
}

function getJoinRequests(communityId) {
  return getStore().joinRequests.filter(
    r => r.communityId === communityId && r.status === 'pending'
  );
}

function resolveJoinRequest(requestId, accept) {
  const s = getStore();
  const req = s.joinRequests.find(r => r.id === requestId);
  if (!req) return null;
  req.status = accept ? 'accepted' : 'rejected';
  req.resolvedAt = new Date().toISOString();
  save();
  return req;
}

// ── Chat operations ──────────────────────────────────

function addChatMessage(communityId, userId, userName, text) {
  const s = getStore();
  if (!s.chatMessages[communityId]) {
    s.chatMessages[communityId] = [];
  }
  const msg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    userName,
    text,
    timestamp: new Date().toISOString()
  };
  s.chatMessages[communityId].push(msg);
  // Keep last 200 messages per community
  if (s.chatMessages[communityId].length > 200) {
    s.chatMessages[communityId] = s.chatMessages[communityId].slice(-200);
  }
  save();
  return msg;
}

function getChatMessages(communityId, limit = 50) {
  const s = getStore();
  const msgs = s.chatMessages[communityId] || [];
  return msgs.slice(-limit);
}

// ── Settings ─────────────────────────────────────────

function getThreshold() {
  return getStore().settings.threshold;
}

function setThreshold(val) {
  const s = getStore();
  s.settings.threshold = val;
  s.sccDirty = true;
  save();
}

// ── Seed from existing CSV ───────────────────────────

function seedFromCsv(csvPath) {
  const s = getStore();
  if (s.users.length > 0) return false; // Already seeded
  
  try {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    for (const line of lines) {
      const parts = line.trim().split(',');
      if (parts.length >= 3) {
        const id = parseInt(parts[0]);
        const name = parts[1];
        const interests = parts.slice(2).join(',').split(';').map(s => s.trim()).filter(Boolean);
        s.users.push({ id, name, interests });
      }
    }
    s.sccDirty = true;
    save();
    return true;
  } catch (err) {
    console.error('[DataStore] Error seeding from CSV:', err.message);
    return false;
  }
}

module.exports = {
  load, save, getStore,
  getUsers, getUserById, addUser, getNextUserId,
  generateRandomUsers, removeUsers,
  setSccResult, getSccResult, isSccDirty, markSccDirty,
  addJoinRequest, getJoinRequests, resolveJoinRequest,
  addChatMessage, getChatMessages,
  getThreshold, setThreshold,
  seedFromCsv, addEvent, getEventLog,
  ALL_INTERESTS
};
