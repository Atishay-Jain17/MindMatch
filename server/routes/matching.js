/**
 * matching.js — Smart matching and discovery routes
 */

const express = require('express');
const router = express.Router();
const matchEngine = require('../services/matchEngine');

/**
 * GET /api/match/:userId — Get matching communities for a user
 */
router.get('/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const matches = matchEngine.findMatches(userId);
    res.json({ success: true, userId, matches });
  } catch (err) {
    res.status(err.message.includes('not found') ? 404 : 500)
       .json({ success: false, error: err.message });
  }
});

/**
 * GET /api/discover — Get suggested/trending communities
 */
router.get('/', (req, res) => {
  try {
    const discover = matchEngine.getDiscoverData();
    res.json({ success: true, ...discover });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
