/**
 * handler.js — Socket.io event handler
 * 
 * Manages real-time connections, community chat rooms,
 * and notification broadcasting.
 */

const dataStore = require('../services/dataStore');

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ── Join a community chat room ───────────────────────
    socket.on('community:join', (communityId) => {
      const room = `community_${communityId}`;
      socket.join(room);
      console.log(`[Socket] ${socket.id} joined room ${room}`);
      
      // Send recent chat history
      const messages = dataStore.getChatMessages(communityId.toString(), 50);
      socket.emit('chat:history', { communityId, messages });
    });

    // ── Leave a community chat room ──────────────────────
    socket.on('community:leave', (communityId) => {
      const room = `community_${communityId}`;
      socket.leave(room);
      console.log(`[Socket] ${socket.id} left room ${room}`);
    });

    // ── Send a chat message ──────────────────────────────
    socket.on('chat:send', (data) => {
      const { communityId, userId, userName, text } = data;
      
      if (!communityId || !text || !userName) {
        socket.emit('error', { message: 'Invalid chat message data' });
        return;
      }

      const msg = dataStore.addChatMessage(
        communityId.toString(),
        userId,
        userName,
        text
      );

      // Broadcast to the community room
      const room = `community_${communityId}`;
      io.to(room).emit('chat:message', {
        communityId,
        message: msg
      });
    });

    // ── Typing indicator ─────────────────────────────────
    socket.on('chat:typing', (data) => {
      const { communityId, userName } = data;
      const room = `community_${communityId}`;
      socket.to(room).emit('chat:typing', { communityId, userName });
    });

    socket.on('chat:stopTyping', (data) => {
      const { communityId, userName } = data;
      const room = `community_${communityId}`;
      socket.to(room).emit('chat:stopTyping', { communityId, userName });
    });

    // ── Disconnect ───────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

module.exports = { setupSocket };
