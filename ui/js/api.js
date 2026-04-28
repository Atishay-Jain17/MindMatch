/**
 * api.js — REST API client for Mind-Match backend
 */
const API_BASE = window.location.origin + '/api';

const Api = {
  async get(path) {
    const res = await fetch(`${API_BASE}${path}`);
    return res.json();
  },
  async post(path, body) {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return res.json();
  },
  async del(path) {
    const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
    return res.json();
  },

  // Users
  getUsers: () => Api.get('/users'),
  getUser: (id) => Api.get(`/users/${id}`),
  createUser: (name, interests) => Api.post('/users', { name, interests }),
  getInterests: () => Api.get('/users/interests'),

  // Communities
  getCommunities: (recompute) => Api.get(`/communities${recompute ? '?recompute=true' : ''}`),
  getCommunity: (id) => Api.get(`/communities/${id}`),
  deleteCommunity: (id) => Api.del(`/communities/${id}`),
  getGraphData: () => Api.get('/communities/graph/data'),

  // Matching
  getMatches: (userId) => Api.get(`/match/${userId}`),

  // Requests
  submitJoinRequest: (userId, communityId) => Api.post('/join-request', { userId, communityId }),
  getJoinRequests: (communityId) => Api.get(`/join-request/${communityId}`),
  acceptRequest: (requestId) => Api.post('/join-request/accept', { requestId }),
  rejectRequest: (requestId) => Api.post('/join-request/reject', { requestId }),

  // Analytics & Discover
  getAnalytics: () => Api.get('/analytics'),
  getDiscover: () => Api.get('/discover'),

  // System
  recompute: (threshold) => Api.post('/recompute', { threshold }),
  health: () => Api.get('/health'),

  // Simulation
  simulateAdd: (count) => Api.post('/simulate/add', { count }),
  simulateRemove: (count) => Api.post('/simulate/remove', { count }),

  // Events
  getEvents: (limit) => Api.get(`/events?limit=${limit || 20}`),

  // Intelligence
  getIntelligence: (interests) => Api.post('/intelligence', { interests })
};

window.Api = Api;
