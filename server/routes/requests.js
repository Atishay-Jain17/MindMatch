/**
 * requests.js — Join request management routes
 */

const express = require('express');
const router = express.Router();
const dataStore = require('../services/dataStore');

/**
 * POST /api/join-request — Submit a join request
 * Body: { userId: number, communityId: number }
 */
router.post('/', (req, res) => {
  try {
    const { userId, communityId } = req.body;
    
    if (userId === undefined || communityId === undefined) {
      return res.status(400).json({
        success: false,
        error: 'userId and communityId are required'
      });
    }

    const user = dataStore.getUserById(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const request = dataStore.addJoinRequest(userId, communityId);

    const io = req.app.get('io');
    if (io) {
      io.emit('request:new', {
        request,
        userName: user.name,
        communityId
      });
    }

    res.status(201).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/join-request/:communityId — Get pending requests for a community
 */
router.get('/:communityId', (req, res) => {
  try {
    const communityId = parseInt(req.params.communityId);
    const requests = dataStore.getJoinRequests(communityId);
    
    // Enrich with user names
    const enriched = requests.map(r => {
      const user = dataStore.getUserById(r.userId);
      return { ...r, userName: user ? user.name : 'Unknown' };
    });

    res.json({ success: true, requests: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/accept-request — Accept a join request
 * Body: { requestId: string }
 */
router.post('/accept', (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ success: false, error: 'requestId is required' });
    }

    const resolved = dataStore.resolveJoinRequest(requestId, true);
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    // Mark SCC as dirty since community membership changed
    dataStore.markSccDirty();

    const io = req.app.get('io');
    if (io) {
      io.emit('request:resolved', { request: resolved, action: 'accepted' });
    }

    res.json({ success: true, request: resolved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reject-request — Reject a join request
 * Body: { requestId: string }
 */
router.post('/reject', (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ success: false, error: 'requestId is required' });
    }

    const resolved = dataStore.resolveJoinRequest(requestId, false);
    if (!resolved) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('request:resolved', { request: resolved, action: 'rejected' });
    }

    res.json({ success: true, request: resolved });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
