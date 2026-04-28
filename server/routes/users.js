/**
 * users.js — User management routes
 */

const express = require('express');
const router = express.Router();
const dataStore = require('../services/dataStore');
const cppBridge = require('../services/cppBridge');

/**
 * GET /api/users — List all users
 */
router.get('/', (req, res) => {
  try {
    const users = dataStore.getUsers();
    res.json({ success: true, users, count: users.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/users/interests — Get all available interest tags
 */
router.get('/interests', (req, res) => {
  res.json({ success: true, interests: dataStore.ALL_INTERESTS });
});

/**
 * GET /api/users/:id — Get single user
 */
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = dataStore.getUserById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/users — Create a new user
 * Body: { name: string, interests: string[] }
 */
router.post('/', (req, res) => {
  try {
    const { name, interests } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }
    if (!interests || !Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one interest is required' });
    }

    const user = dataStore.addUser(name.trim(), interests);

    // Emit socket event if io is available
    const io = req.app.get('io');
    if (io) {
      io.emit('user:added', { user });
    }

    res.status(201).json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
