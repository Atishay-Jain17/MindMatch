/**
 * socket.js — Socket.io client for real-time features
 */
let socket = null;

const Socket = {
  init() {
    socket = io(window.location.origin);

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
      Toast.show('Connected to server', 'success');
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Disconnected');
    });

    // Real-time events
    socket.on('user:added', (data) => {
      Toast.show(`New user joined: ${data.user.name}`, 'info');
      if (App.currentPage === 'dashboard' || App.currentPage === 'communities') {
        App.refreshCurrentPage();
      }
    });

    socket.on('community:updated', (data) => {
      // Silently refresh graph + stats during simulation
      Graph.loadData();
      App.updateStatus();
      if (data.events?.length) {
        data.events.forEach(ev => App.showEvent(ev));
      }
    });

    // Merge/split event log
    socket.on('event:log', (data) => {
      App.showEvent(data);
    });

    socket.on('request:new', (data) => {
      Toast.show(`${data.userName} wants to join Community #${data.communityId + 1}`, 'info');
    });

    socket.on('request:resolved', (data) => {
      const action = data.action === 'accepted' ? '✓ Accepted' : '✗ Rejected';
      Toast.show(`Join request ${action}`, data.action === 'accepted' ? 'success' : 'error');
    });

    // Chat
    socket.on('chat:message', (data) => {
      if (typeof Chat !== 'undefined') Chat.onMessage(data);
    });

    socket.on('chat:history', (data) => {
      if (typeof Chat !== 'undefined') Chat.onHistory(data);
    });

    socket.on('chat:typing', (data) => {
      if (typeof Chat !== 'undefined') Chat.onTyping(data);
    });

    socket.on('chat:stopTyping', (data) => {
      if (typeof Chat !== 'undefined') Chat.onStopTyping(data);
    });
  },

  joinCommunity(communityId) {
    if (socket) socket.emit('community:join', communityId);
  },

  leaveCommunity(communityId) {
    if (socket) socket.emit('community:leave', communityId);
  },

  sendMessage(communityId, userId, userName, text) {
    if (socket) socket.emit('chat:send', { communityId, userId, userName, text });
  },

  sendTyping(communityId, userName) {
    if (socket) socket.emit('chat:typing', { communityId, userName });
  },

  stopTyping(communityId, userName) {
    if (socket) socket.emit('chat:stopTyping', { communityId, userName });
  }
};

window.Socket = Socket;
