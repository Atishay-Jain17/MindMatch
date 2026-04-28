/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   MIND-MATCH  –  Real-Time Community Platform Server        ║
 * ║   Node.js + Express + Socket.io                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Bridge between the C++ SCC engine and the modern web UI.
 * Provides REST APIs and real-time WebSocket communication.
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// Services
const dataStore = require('./services/dataStore');
const cppBridge = require('./services/cppBridge');
const matchEngine = require('./services/matchEngine');
const { setupSocket } = require('./socket/handler');

// Routes
const usersRouter = require('./routes/users');
const communitiesRouter = require('./routes/communities');
const matchingRouter = require('./routes/matching');
const requestsRouter = require('./routes/requests');

// ── Configuration ────────────────────────────────────
const PORT = process.env.PORT || 3000;
const UI_PATH = path.join(__dirname, '..', 'ui');
const CSV_PATH = path.join(__dirname, '..', 'data', 'sample.csv');

// ── Express App ──────────────────────────────────────
const app = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Make io available to routes
app.set('io', io);

// ── Middleware ────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files — serve the UI
app.use(express.static(UI_PATH));

// ── API Routes ───────────────────────────────────────
app.use('/api/users', usersRouter);
app.use('/api/communities', communitiesRouter);
app.use('/api/match', matchingRouter);
app.use('/api/join-request', requestsRouter);

// Analytics endpoint
app.get('/api/analytics', (req, res) => {
  try {
    const analytics = matchEngine.getAnalytics();
    res.json({ success: true, ...analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Discover endpoint
app.get('/api/discover', (req, res) => {
  try {
    const discover = matchEngine.getDiscoverData();
    res.json({ success: true, ...discover });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Recompute endpoint with merge/split detection
app.post('/api/recompute', (req, res) => {
  try {
    const threshold = req.body.threshold || dataStore.getThreshold();
    if (req.body.threshold) dataStore.setThreshold(req.body.threshold);

    // Snapshot old communities for merge/split detection
    const oldResult = dataStore.getSccResult();
    const oldComms = (oldResult?.communities || []).filter(c => c.size > 1);
    
    const result = cppBridge.getSccResult(true);
    const newComms = (result.communities || []).filter(c => c.size > 1);

    // Merge/split detection
    const events = detectMergeSplit(oldComms, newComms);
    events.forEach(ev => {
      dataStore.addEvent(ev.type, ev.message);
      io.emit('event:log', ev);
    });
    
    io.emit('community:updated', {
      action: 'recomputed',
      communities: result.communities,
      metrics: result.metrics,
      events
    });

    res.json({
      success: true,
      communities: result.communities || [],
      metrics: result.metrics || {},
      timings: result.timings_microseconds || {},
      events
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Merge/split detection helper
function detectMergeSplit(oldComms, newComms) {
  const events = [];
  if (!oldComms.length || !newComms.length) return events;

  // Build member-set maps
  const oldSets = oldComms.map(c => new Set(c.members));
  const newSets = newComms.map(c => new Set(c.members));

  // Detect merges: if members of 2+ old comms now reside in 1 new comm
  for (let ni = 0; ni < newSets.length; ni++) {
    const contributing = [];
    for (let oi = 0; oi < oldSets.length; oi++) {
      let overlap = 0;
      for (const m of oldSets[oi]) { if (newSets[ni].has(m)) overlap++; }
      if (overlap >= 2) contributing.push(oi);
    }
    if (contributing.length >= 2) {
      const ids = contributing.map(i => `#${oldComms[i].id + 1}`).join(' + ');
      events.push({ type: 'merge', message: `Communities ${ids} merged → Community #${newComms[ni].id + 1} (${newComms[ni].size} members)` });
    }
  }

  // Detect splits: if members of 1 old comm now scattered across 2+ new comms
  for (let oi = 0; oi < oldSets.length; oi++) {
    const destinations = [];
    for (let ni = 0; ni < newSets.length; ni++) {
      let overlap = 0;
      for (const m of oldSets[oi]) { if (newSets[ni].has(m)) overlap++; }
      if (overlap >= 2) destinations.push(ni);
    }
    if (destinations.length >= 2) {
      const ids = destinations.map(i => `#${newComms[i].id + 1}`).join(', ');
      events.push({ type: 'split', message: `Community #${oldComms[oi].id + 1} split into ${destinations.length} groups (${ids})` });
    }
  }

  return events;
}

// ── Simulation routes ────────────────────────────────
app.post('/api/simulate/add', (req, res) => {
  try {
    const count = Math.min(parseInt(req.body.count) || 10, 200);
    const users = dataStore.generateRandomUsers(count);

    // Auto-recompute SCC
    const oldResult = dataStore.getSccResult();
    const oldComms = (oldResult?.communities || []).filter(c => c.size > 1);
    const result = cppBridge.getSccResult(true);
    const newComms = (result.communities || []).filter(c => c.size > 1);
    const events = detectMergeSplit(oldComms, newComms);
    events.forEach(ev => { dataStore.addEvent(ev.type, ev.message); io.emit('event:log', ev); });

    dataStore.addEvent('simulate', `Added ${count} users (total: ${dataStore.getUsers().length})`);

    io.emit('community:updated', { action: 'simulate_add', count, communities: result.communities, metrics: result.metrics, events });

    res.json({ success: true, added: users.length, total: dataStore.getUsers().length, communities: result.communities, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/simulate/remove', (req, res) => {
  try {
    const count = Math.min(parseInt(req.body.count) || 10, dataStore.getUsers().length);
    const removed = dataStore.removeUsers(count);

    const oldResult = dataStore.getSccResult();
    const oldComms = (oldResult?.communities || []).filter(c => c.size > 1);
    const result = cppBridge.getSccResult(true);
    const newComms = (result.communities || []).filter(c => c.size > 1);
    const events = detectMergeSplit(oldComms, newComms);
    events.forEach(ev => { dataStore.addEvent(ev.type, ev.message); io.emit('event:log', ev); });

    dataStore.addEvent('simulate', `Removed ${removed.length} users (total: ${dataStore.getUsers().length})`);

    io.emit('community:updated', { action: 'simulate_remove', count: removed.length, communities: result.communities, metrics: result.metrics, events });

    res.json({ success: true, removed: removed.length, total: dataStore.getUsers().length, communities: result.communities, events });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({ success: true, events: dataStore.getEventLog(limit) });
});

// Interest intelligence
app.post('/api/intelligence', (req, res) => {
  try {
    const interests = req.body.interests || [];
    if (!interests.length) return res.json({ success: false, error: 'No interests provided' });
    const result = matchEngine.getInterestIntelligence(interests);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    engine: cppBridge.isEngineAvailable() ? 'available' : 'missing',
    users: dataStore.getUsers().length,
    sccDirty: dataStore.isSccDirty(),
    timestamp: new Date().toISOString()
  });
});

// Catch-all: serve UI for any non-API route
app.get('*', (req, res) => {
  res.sendFile(path.join(UI_PATH, 'index.html'));
});

// ── Socket.io Setup ──────────────────────────────────
setupSocket(io);

// ── Server Startup ───────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║   🧠 MIND-MATCH Real-Time Community Platform               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  // Initialize data store
  dataStore.load();
  
  // Seed from sample CSV if no users exist
  if (dataStore.getUsers().length === 0) {
    console.log('[Server] Seeding users from sample.csv...');
    dataStore.seedFromCsv(CSV_PATH);
    console.log(`[Server] Loaded ${dataStore.getUsers().length} users`);
  } else {
    console.log(`[Server] ${dataStore.getUsers().length} users in store`);
  }

  // Check C++ engine
  if (cppBridge.isEngineAvailable()) {
    console.log('[Server] C++ engine: ✓ available');
    
    // Initial SCC computation
    try {
      console.log('[Server] Running initial SCC computation...');
      const result = cppBridge.getSccResult(true);
      console.log(`[Server] Communities detected: ${result.communities?.length || 0}`);
    } catch (err) {
      console.error('[Server] Initial SCC computation failed:', err.message);
    }
  } else {
    console.warn('[Server] C++ engine: ✗ not found at', cppBridge.EXE_PATH);
    console.warn('[Server] Build with: make (or manual g++ compilation)');
  }

  console.log('');
  console.log(`[Server] REST API:   http://localhost:${PORT}/api`);
  console.log(`[Server] WebSocket:  ws://localhost:${PORT}`);
  console.log(`[Server] Dashboard:  http://localhost:${PORT}`);
  console.log('');
});

module.exports = { app, server, io };
