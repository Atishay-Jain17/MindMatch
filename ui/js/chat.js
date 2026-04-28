/**
 * chat.js — Community chat UI (graph-first redesign)
 */
const Chat = {
  currentCommunity: null,
  currentUser: null,
  typingTimeout: null,

  open(communityId, userName, userId) {
    this.currentCommunity = communityId;
    this.currentUser = { id: userId || 0, name: userName || 'Guest' };
    Socket.joinCommunity(communityId);
  },

  close() {
    if (this.currentCommunity !== null) Socket.leaveCommunity(this.currentCommunity);
    this.currentCommunity = null;
  },

  send(text) {
    if (!text.trim() || this.currentCommunity === null) return;
    Socket.sendMessage(this.currentCommunity, this.currentUser.id, this.currentUser.name, text.trim());
  },

  onMessage(data) {
    const c = document.getElementById('chatMessages');
    if (!c || data.communityId != this.currentCommunity) return;
    this.appendMsg(c, data.message);
    c.scrollTop = c.scrollHeight;
  },

  onHistory(data) {
    const c = document.getElementById('chatMessages');
    if (!c || data.communityId != this.currentCommunity) return;
    c.innerHTML = '';
    (data.messages || []).forEach(m => this.appendMsg(c, m));
    c.scrollTop = c.scrollHeight;
  },

  onTyping(data) {
    const el = document.getElementById('chatTyping');
    if (el) el.textContent = `${data.userName} is typing...`;
  },

  onStopTyping() {
    const el = document.getElementById('chatTyping');
    if (el) el.textContent = '';
  },

  appendMsg(container, msg) {
    const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const d = document.createElement('div');
    d.className = 'chat-msg';
    d.innerHTML = `<span class="msg-user">${this.esc(msg.userName)}</span><div class="msg-text">${this.esc(msg.text)}</div><span class="msg-time">${time}</span>`;
    container.appendChild(d);
  },

  handleKey(e, communityId) {
    if (e.key === 'Enter') { this.sendFromInput(communityId); return; }
    Socket.sendTyping(communityId, this.currentUser?.name || 'Guest');
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => Socket.stopTyping(communityId, this.currentUser?.name || 'Guest'), 1500);
  },

  sendFromInput(communityId) {
    const input = document.getElementById('chatInput');
    if (!input) return;
    this.send(input.value);
    input.value = '';
  },

  esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
};

window.Chat = Chat;
