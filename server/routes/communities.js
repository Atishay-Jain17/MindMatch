/**
 * communities.js — Community management routes
 */

const express = require('express');
const router = express.Router();
const dataStore = require('../services/dataStore');
const cppBridge = require('../services/cppBridge');

/**
 * GET /api/communities — Get all communities
 * Triggers C++ recomputation if SCC data is stale.
 */
router.get('/', (req, res) => {
  try {
    const forceRecompute = req.query.recompute === 'true';
    const result = cppBridge.getSccResult(forceRecompute);
    
    res.json({
      success: true,
      communities: result.communities || [],
      metrics: result.metrics || {},
      timings: result.timings_microseconds || {},
      meta: result.meta || {}
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/communities/:id — Get single community details
 */
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = cppBridge.getSccResult();
    
    if (!result || !result.communities) {
      return res.status(404).json({ success: false, error: 'No SCC data available' });
    }
    
    const community = result.communities.find(c => c.id === id);
    if (!community) {
      return res.status(404).json({ success: false, error: 'Community not found' });
    }

    // Enrich with member details
    const memberDetails = community.members.map(memberId => {
      const user = (result.users || []).find(u => u.id === memberId);
      return user || { id: memberId, name: `User ${memberId}`, interests: [] };
    });

    // Get chat messages
    const chatMessages = dataStore.getChatMessages(id.toString());

    // Get pending join requests
    const joinRequests = dataStore.getJoinRequests(id);

    res.json({
      success: true,
      community: {
        ...community,
        memberDetails,
        chatMessages,
        joinRequests
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/communities/:id — Remove a community
 * (Marks SCC as dirty so next computation will reassign)
 */
router.delete('/:id', (req, res) => {
  try {
    dataStore.markSccDirty();
    
    const io = req.app.get('io');
    if (io) {
      io.emit('community:updated', { action: 'deleted', communityId: parseInt(req.params.id) });
    }

    res.json({ success: true, message: 'Community marked for removal. Recompute to update.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/recompute — Force SCC recomputation
 */
router.post('/recompute', (req, res) => {
  try {
    const threshold = req.body.threshold || dataStore.getThreshold();
    if (req.body.threshold) {
      dataStore.setThreshold(req.body.threshold);
    }
    
    const result = cppBridge.getSccResult(true);
    
    const io = req.app.get('io');
    if (io) {
      io.emit('community:updated', {
        action: 'recomputed',
        communities: result.communities,
        metrics: result.metrics
      });
    }

    res.json({
      success: true,
      communities: result.communities || [],
      metrics: result.metrics || {},
      timings: result.timings_microseconds || {}
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/graph — Get full graph data (edges + nodes) for D3 visualization
 */
router.get('/graph/data', (req, res) => {
  try {
    const result = cppBridge.getSccResult();
    if (!result) {
      return res.status(404).json({ success: false, error: 'No SCC data available' });
    }

    res.json({
      success: true,
      users: result.users || [],
      edges: result.edges_list || [],
      communities: result.communities || [],
      metrics: result.metrics || {}
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
