/**
 * app.js — Graph-first application controller
 */

const Toast = {
  show(msg, type = 'info') {
    let c = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 3000);
  }
};
window.Toast = Toast;

const App = {
  allInterests: [],
  selectedNode: null,
  currentCommunityId: null,
  evoInterval: null,
  evoRunning: false,

  async init() {
    Socket.init();
    this.bindTopNav();
    this.bindPanelTabs();
    this.listenEvents();
    try {
      const r = await Api.getInterests();
      if (r.success) this.allInterests = r.interests;
    } catch (e) {}

    // Load graph immediately
    await Graph.init();
    this.updateStatus();
  },

  // ── Top nav ───────────────────────────────────
  bindTopNav() {
    document.querySelectorAll('#topNav button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if (action === 'graph') {
          this.closeAllOverlays();
          document.querySelectorAll('#topNav button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
        } else if (action === 'adduser') {
          this.openAddUser();
        } else if (action === 'intelligence') {
          this.openIntelligence();
        } else if (action === 'analytics') {
          this.openAnalytics();
        } else if (action === 'crosschat') {
          this.openCrossChat();
        } else if (action === 'recompute') {
          this.recompute();
        }
      });
    });
  },

  // ── Panel tabs ────────────────────────────────
  bindPanelTabs() {
    document.querySelectorAll('.panel-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel-view').forEach(v => v.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab)?.classList.add('active');
      });
    });
  },

  switchTab(name) {
    document.querySelectorAll('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel-view').forEach(v => v.classList.toggle('active', v.id === 'tab-' + name));
  },

  // ── Global stats (Feature 5) ──────────────────
  async updateStatus() {
    try {
      const h = await Api.health();
      document.getElementById('statusUsers').textContent = `${h.users} users`;
      const c = await Api.getCommunities();
      const comms = (c.communities || []);
      const multi = comms.filter(x => x.size > 1);
      document.getElementById('statusComm').textContent = `${multi.length} communities`;
      const totalEdges = comms.reduce((s, x) => s + (x.internal_edges || 0), 0);
      document.getElementById('statusEdges').textContent = `${totalEdges} edges`;
      const avgDensity = multi.length ? (multi.reduce((s, x) => s + x.density, 0) / multi.length * 100).toFixed(0) : 0;
      document.getElementById('statusDensity').textContent = `${avgDensity}% avg density`;
    } catch (e) {}
  },

  // ── Socket event listeners ────────────────────
  listenEvents() {
    // Listen for event:log from server (merge/split/simulate)
    if (typeof io !== 'undefined') {
      const socket = io(window.location.origin, { autoConnect: false });
      // We already have Socket.init() handling connection;
      // just listen for event:log via the existing socket
    }
  },

  // ── Node click → Info panel ───────────────────
  async showNodeInfo(d) {
    this.selectedNode = d;
    this.switchTab('info');
    const el = document.getElementById('tab-info');

    const color = d.comm >= 0 ? Graph.data.communities?.[d.comm] : null;
    const commLabel = d.comm >= 0 ? `Community #${d.comm + 1}` : 'Isolated';
    const commColor = d.comm >= 0 ? `color:${COMM_COLORS[d.comm % COMM_COLORS.length]}` : 'color:var(--text-dim)';

    el.innerHTML = `
      <div class="detail-header">
        <div class="avatar">${d.name[0]}</div>
        <h3>${esc(d.name)}</h3>
        <div class="subtitle" style="${commColor}">${commLabel} · ID ${d.id}</div>
      </div>
      <div class="detail-section">
        <div class="section-label">Interests</div>
        <div class="tag-group">${(d.interests || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      </div>
      <div class="detail-section">
        <div class="section-label">Actions</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <button class="btn btn-teal btn-block btn-sm" onclick="App.showMatchesFor(${d.id})">Find matching communities</button>
          ${d.comm >= 0 ? `<button class="btn btn-block btn-sm" onclick="App.showCommunity(${d.comm})">View community</button>` : ''}
        </div>
      </div>
      <div id="matchResults"></div>`;

    // Auto-load community panel
    if (d.comm >= 0) this.loadCommunityTab(d.comm);
  },

  async showMatchesFor(userId) {
    const el = document.getElementById('matchResults');
    if (!el) return;
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await Api.getMatches(userId);
      const matches = (res.matches || []).filter(m => m.matchScore > 0).slice(0, 5);
      if (!matches.length) { el.innerHTML = '<p style="font-size:12px;color:var(--text-sec);padding:8px 0">No strong matches found.</p>'; return; }
      el.innerHTML = `<div class="detail-section" style="margin-top:8px">
        <div class="section-label">Best Matches</div>
        ${matches.map(m => `<div class="match-item">
          <div class="match-header">
            <span style="font-size:12px;font-weight:500">${esc(m.dominantInterest)} <span style="color:var(--text-dim)">(${m.communitySize})</span></span>
            <span class="match-score">${m.matchScore}%</span>
          </div>
          <div class="match-bar"><div class="match-bar-fill" style="width:${m.matchScore}%"></div></div>
          <div class="match-explanation">${esc(m.explanation)}</div>
          ${!m.isMember ? `<button class="btn btn-sm btn-teal" style="margin-top:6px" onclick="App.joinRequest(${userId},${m.communityId})">Request to join</button>` : `<span style="font-size:11px;color:var(--success)">✓ Member</span>`}
        </div>`).join('')}
      </div>`;
    } catch (err) {
      el.innerHTML = `<p style="font-size:12px;color:var(--danger)">${err.message}</p>`;
    }
  },

  // ── Community tab ─────────────────────────────
  async showCommunity(commId) {
    this.switchTab('community');
    this.loadCommunityTab(commId);
    Graph.highlightCommunity(commId);
  },

  async loadCommunityTab(commId) {
    this.currentCommunityId = commId;
    const el = document.getElementById('tab-community');
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await Api.getCommunity(commId);
      if (!res.success) throw new Error(res.error);
      const c = res.community;
      const density = (c.density * 100).toFixed(1);
      const color = COMM_COLORS[commId % COMM_COLORS.length];

      el.innerHTML = `
        <div class="detail-header">
          <div class="avatar" style="border-color:${color};color:${color};background:${color}15">C${c.id+1}</div>
          <h3>${esc(c.dominant_interest)} Community</h3>
          <div class="subtitle">Community #${c.id + 1}</div>
        </div>
        <div class="detail-section">
          <div class="section-label">Statistics</div>
          <div class="detail-row"><span class="label">Members</span><span class="value">${c.size}</span></div>
          <div class="detail-row"><span class="label">Internal Edges</span><span class="value">${c.internal_edges || 0}</span></div>
          <div class="detail-row"><span class="label">Density</span><span class="value">${density}%</span></div>
          <div class="detail-row"><span class="label">Unique Interests</span><span class="value">${c.unique_interests || '—'}</span></div>
        </div>
        <div class="detail-section">
          <div class="section-label">Members</div>
          ${(c.memberDetails || []).map(m => `<div class="member-row" onclick="App.focusNode(${m.id})">
            <div class="m-avatar" style="color:${color}">${m.name[0]}</div>
            <div class="m-info"><div class="m-name">${esc(m.name)}</div><div class="m-sub">${(m.interests||[]).join(', ')}</div></div>
          </div>`).join('')}
        </div>
        <div class="detail-section">
          <div class="section-label">Join Requests</div>
          <div id="commRequests"><span style="font-size:11px;color:var(--text-dim)">Loading...</span></div>
        </div>`;

      // Load pending requests
      const reqRes = await Api.getJoinRequests(commId);
      const reqEl = document.getElementById('commRequests');
      const pending = (reqRes.requests || []);
      if (pending.length === 0) {
        reqEl.innerHTML = '<span style="font-size:11px;color:var(--text-dim)">No pending requests</span>';
      } else {
        reqEl.innerHTML = pending.map(r =>
          `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:12px">${esc(r.userName)}</span>
            <div style="display:flex;gap:4px">
              <button class="btn btn-sm btn-teal" onclick="App.resolveRequest('${r.id}',true)">Accept</button>
              <button class="btn btn-sm" onclick="App.resolveRequest('${r.id}',false)">Reject</button>
            </div>
          </div>`).join('');
      }

      // Load chat tab
      this.loadChatTab(commId);
    } catch (err) {
      el.innerHTML = `<p style="color:var(--danger);font-size:12px;padding:20px">${err.message}</p>`;
    }
  },

  loadChatTab(commId) {
    const el = document.getElementById('tab-chat');
    Chat.close();
    Chat.open(commId, 'Guest', 0);
    el.innerHTML = `
      <div class="detail-section">
        <div class="section-label">Community #${commId + 1} Chat</div>
      </div>
      <div class="chat-wrap">
        <div class="chat-messages" id="chatMessages"></div>
        <div id="chatTyping"></div>
        <div class="chat-input-bar">
          <input type="text" id="chatInput" placeholder="Type a message..." autocomplete="off"
            onkeydown="Chat.handleKey(event, ${commId})">
          <button onclick="Chat.sendFromInput(${commId})">Send</button>
        </div>
      </div>`;
  },

  focusNode(nodeId) {
    const n = (Graph.nodes || []).find(x => x.id === nodeId);
    if (n) this.showNodeInfo(n);
  },

  // ── Add User overlay ──────────────────────────
  wizStep: 1, wizName: '', wizInterests: [],

  openAddUser() {
    this.wizStep = 1; this.wizName = ''; this.wizInterests = [];
    document.getElementById('overlayAddUser').classList.add('open');
    this.renderWizard();
  },

  renderWizard() {
    const el = document.getElementById('addUserBody');
    const s = this.wizStep;

    const dots = `<div class="wizard-dots">
      <div class="wizard-dot ${s > 1 ? 'done' : s === 1 ? 'active' : ''}"></div>
      <div class="wizard-dot ${s > 2 ? 'done' : s === 2 ? 'active' : ''}"></div>
      <div class="wizard-dot ${s === 3 ? 'active' : ''}"></div>
    </div>`;

    if (s === 1) {
      el.innerHTML = `
        <div class="overlay-title">Add new user</div>
        <div class="overlay-subtitle">Step 1 — Enter a display name</div>
        ${dots}
        <div style="margin-bottom:16px">
          <label class="form-label">Name</label>
          <input class="form-input" id="wizName" placeholder="e.g. Atishay" value="${esc(this.wizName)}" autofocus>
        </div>
        <button class="btn btn-accent btn-block" onclick="App.wizNext()">Continue</button>`;
      setTimeout(() => document.getElementById('wizName')?.focus(), 50);
    } else if (s === 2) {
      el.innerHTML = `
        <div class="overlay-title">Select interests</div>
        <div class="overlay-subtitle">Step 2 — Pick at least 2 interests (${this.wizInterests.length} selected)</div>
        ${dots}
        <div class="tag-group" style="margin-bottom:20px">
          ${this.allInterests.map(t => `<span class="tag selectable ${this.wizInterests.includes(t) ? 'selected' : ''}" onclick="App.toggleInt('${t}')">${t}</span>`).join('')}
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-block" onclick="App.wizStep=1;App.renderWizard()">Back</button>
          <button class="btn btn-accent btn-block" onclick="App.wizNext()" ${this.wizInterests.length < 2 ? 'disabled style="opacity:0.4"' : ''}>Create</button>
        </div>`;
    } else {
      el.innerHTML = '<div class="spinner"></div>';
      this.createUser();
    }
  },

  wizNext() {
    if (this.wizStep === 1) {
      const v = document.getElementById('wizName')?.value?.trim();
      if (!v) { Toast.show('Enter a name', 'error'); return; }
      this.wizName = v;
      this.wizStep = 2;
    } else if (this.wizStep === 2) {
      if (this.wizInterests.length < 2) { Toast.show('Pick at least 2', 'error'); return; }
      this.wizStep = 3;
    }
    this.renderWizard();
  },

  toggleInt(t) {
    const i = this.wizInterests.indexOf(t);
    if (i >= 0) this.wizInterests.splice(i, 1); else this.wizInterests.push(t);
    this.renderWizard();
  },

  async createUser() {
    const el = document.getElementById('addUserBody');
    try {
      const res = await Api.createUser(this.wizName, this.wizInterests);
      if (!res.success) throw new Error(res.error);
      Toast.show(`User "${res.user.name}" created`, 'success');

      await Api.recompute();
      const matchRes = await Api.getMatches(res.user.id);
      const top = (matchRes.matches || []).filter(m => m.matchScore > 0).slice(0, 3);

      el.innerHTML = `
        <div class="overlay-title">Welcome, ${esc(res.user.name)}</div>
        <div class="overlay-subtitle">User created and graph recomputed</div>
        ${top.length ? `<div class="detail-section"><div class="section-label">Top Matches</div>
          ${top.map(m => `<div class="match-item">
            <div class="match-header"><span style="font-size:12px">${esc(m.dominantInterest)} (${m.communitySize})</span><span class="match-score">${m.matchScore}%</span></div>
            <div class="match-bar"><div class="match-bar-fill" style="width:${m.matchScore}%"></div></div>
            <div class="match-explanation">${esc(m.explanation)}</div>
          </div>`).join('')}</div>` : ''}
        <button class="btn btn-accent btn-block" onclick="App.closeOverlay('overlayAddUser');Graph.loadData();App.updateStatus()">Back to graph</button>`;
    } catch (err) {
      el.innerHTML = `<p style="color:var(--danger)">${err.message}</p>
        <button class="btn btn-block" onclick="App.wizStep=2;App.renderWizard()">Retry</button>`;
    }
  },

  // ── Analytics overlay ─────────────────────────
  async openAnalytics() {
    document.getElementById('overlayAnalytics').classList.add('open');
    const el = document.getElementById('analyticsBody');
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const d = await Api.getAnalytics();
      const t = d.algorithmTimings || {};
      const interests = Object.entries(d.interestDistribution || {}).sort((a,b) => b[1]-a[1]).slice(0,12);
      const maxF = interests.length ? interests[0][1] : 1;
      const sizes = (d.communitySizes || []);

      el.innerHTML = `
        <div class="overlay-title">Analytics</div>
        <div class="overlay-subtitle">System overview and performance metrics</div>
        <div class="detail-section">
          <div class="section-label">Graph Metrics</div>
          <div class="detail-row"><span class="label">Users</span><span class="value">${d.totalUsers}</span></div>
          <div class="detail-row"><span class="label">Edges</span><span class="value">${d.totalEdges}</span></div>
          <div class="detail-row"><span class="label">Communities</span><span class="value">${d.totalCommunities}</span></div>
          <div class="detail-row"><span class="label">Threshold</span><span class="value">${d.threshold}</span></div>
          <div class="detail-row"><span class="label">Avg Size</span><span class="value">${(d.avgCommunitySize||0).toFixed(1)}</span></div>
          <div class="detail-row"><span class="label">Isolated</span><span class="value">${d.isolatedUsers||0}</span></div>
        </div>
        <div class="detail-section">
          <div class="section-label">Algorithm Performance</div>
          <div class="detail-row"><span class="label">Kosaraju</span><span class="value">${t.kosaraju_us||0} µs</span></div>
          <div class="detail-row"><span class="label">Tarjan</span><span class="value">${t.tarjan_us||0} µs</span></div>
          <div class="detail-row"><span class="label">Speedup</span><span class="value">${t.speedup_ratio||'—'}×</span></div>
          <div class="detail-row"><span class="label">Faster</span><span class="value">${t.faster_algorithm||'—'}</span></div>
        </div>
        <div class="detail-section">
          <div class="section-label">Community Sizes</div>
          ${sizes.map(c => {
            const maxS = Math.max(...sizes.map(x=>x.size),1);
            return `<div class="bar-chart-row">
              <span class="bar-label">C${c.id+1} ${c.dominantInterest}</span>
              <div class="bar-track"><div class="bar-fill" style="width:${(c.size/maxS)*100}%;background:var(--teal)"></div></div>
              <span class="bar-value">${c.size}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="detail-section">
          <div class="section-label">Interest Distribution</div>
          ${interests.map(([name, count]) => `<div class="bar-chart-row">
            <span class="bar-label">${name}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${(count/maxF)*100}%;background:var(--accent)"></div></div>
            <span class="bar-value">${count}</span>
          </div>`).join('')}
        </div>`;
    } catch (err) {
      el.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  // ── Overlays ──────────────────────────────────
  closeOverlay(id) { document.getElementById(id)?.classList.remove('open'); },
  closeAllOverlays() {
    document.querySelectorAll('.overlay-panel').forEach(o => o.classList.remove('open'));
  },

  // ── Simulation (Features 1 & 2) ───────────────
  async simulate(action, count) {
    Toast.show(`${action === 'add' ? 'Adding' : 'Removing'} ${count} users...`, 'info');
    try {
      const res = action === 'add'
        ? await Api.simulateAdd(count)
        : await Api.simulateRemove(count);

      if (!res.success) throw new Error(res.error || 'Failed');

      const label = action === 'add' ? `+${res.added || count}` : `-${res.removed || count}`;
      Toast.show(`${label} users (total: ${res.total})`, 'success');

      // Show events (merge/split)
      if (res.events?.length) {
        res.events.forEach(ev => this.showEvent(ev));
      }

      Graph.loadData();
      this.updateStatus();
    } catch (err) {
      Toast.show(err.message, 'error');
    }
  },

  // Live evolution mode (Feature 2)
  toggleEvolution() {
    const btn = document.getElementById('evoBtn');
    const indicator = document.getElementById('evoIndicator');
    if (this.evoRunning) {
      clearInterval(this.evoInterval);
      this.evoRunning = false;
      btn.textContent = '▶ Start Sim';
      btn.classList.remove('running');
      indicator.style.display = 'none';
    } else {
      this.evoRunning = true;
      btn.textContent = '⏸ Pause';
      btn.classList.add('running');
      indicator.style.display = 'flex';
      this.evoInterval = setInterval(() => this.evoTick(), 3000);
      this.evoTick(); // run immediately
    }
  },

  async evoTick() {
    try {
      const count = 3 + Math.floor(Math.random() * 5); // 3-7 users per tick
      const res = await Api.simulateAdd(count);
      if (res.events?.length) res.events.forEach(ev => this.showEvent(ev));
      Graph.loadData();
      this.updateStatus();
    } catch (e) {}
  },

  // ── Event log (Feature 6) ─────────────────────
  showEvent(ev) {
    const log = document.getElementById('eventLog');
    if (!log) return;
    const item = document.createElement('div');
    item.className = `event-item ${ev.type}`;
    item.innerHTML = `<div class="event-type">${ev.type}</div>${esc(ev.message)}`;
    log.prepend(item);
    // Keep max 5 visible
    while (log.children.length > 5) log.removeChild(log.lastChild);
    // Auto-fade after 8 seconds
    setTimeout(() => { item.style.opacity = '0'; setTimeout(() => item.remove(), 300); }, 8000);
  },

  // ── Intelligence panel (Feature 3) ────────────
  intInterests: [],

  openIntelligence() {
    this.intInterests = [];
    document.getElementById('overlayIntelligence').classList.add('open');
    this.renderIntelligence();
  },

  renderIntelligence() {
    const el = document.getElementById('intelligenceBody');
    const tags = this.allInterests.map(t =>
      `<span class="tag selectable ${this.intInterests.includes(t) ? 'selected' : ''}" onclick="App.toggleIntInterest('${t}')">${t}</span>`
    ).join('');

    el.innerHTML = `
      <div class="overlay-title">Interest Intelligence</div>
      <div class="overlay-subtitle">Select interests to analyze connectivity and community matches</div>
      <div class="tag-group" style="margin-bottom:16px">${tags}</div>
      ${this.intInterests.length >= 1 ? '<button class="btn btn-accent btn-block" onclick="App.runIntelligence()">Analyze</button>' : '<p style="font-size:12px;color:var(--text-dim)">Select at least 1 interest</p>'}
      <div id="intResults"></div>`;
  },

  toggleIntInterest(t) {
    const i = this.intInterests.indexOf(t);
    if (i >= 0) this.intInterests.splice(i, 1); else this.intInterests.push(t);
    this.renderIntelligence();
  },

  async runIntelligence() {
    const el = document.getElementById('intResults');
    if (!el) return;
    el.innerHTML = '<div class="spinner"></div>';
    try {
      const res = await Api.getIntelligence(this.intInterests);
      const comms = res.communities || [];
      const users = res.topUsers || [];

      el.innerHTML = `
        <div class="detail-section" style="margin-top:16px">
          <div class="section-label">Connectivity Score</div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="font-size:28px;font-weight:700;color:var(--accent);font-family:var(--mono)">${res.connectivity}%</div>
            <div style="font-size:11px;color:var(--text-sec)">${res.totalRelevant} users share these interests</div>
          </div>
          <div class="match-bar"><div class="match-bar-fill" style="width:${res.connectivity}%"></div></div>
        </div>
        ${comms.length ? `<div class="detail-section">
          <div class="section-label">Matching Communities (${comms.length})</div>
          ${comms.map(c => `<div class="match-item">
            <div class="match-header">
              <span style="font-size:12px;font-weight:500">${esc(c.name)} <span style="color:var(--text-dim)">(${c.size} members)</span></span>
              <span class="match-score">${c.score}%</span>
            </div>
            <div class="match-bar"><div class="match-bar-fill" style="width:${c.score}%"></div></div>
            <div class="match-explanation">Shared: ${c.shared.join(', ')}</div>
          </div>`).join('')}
        </div>` : ''}
        ${users.length ? `<div class="detail-section">
          <div class="section-label">Top Users (${users.length})</div>
          ${users.map(u => `<div class="member-row" onclick="App.focusNode(${u.id});App.closeOverlay('overlayIntelligence')">
            <div class="m-avatar">${u.name[0]}</div>
            <div class="m-info"><div class="m-name">${esc(u.name)} <span style="color:var(--accent);font-family:var(--mono);font-size:10px">${u.score}/${u.interests.length}</span></div>
              <div class="m-sub">${u.overlap.join(', ')}</div>
            </div>
          </div>`).join('')}
        </div>` : ''}`;
    } catch (err) {
      el.innerHTML = `<p style="color:var(--danger);font-size:12px">${err.message}</p>`;
    }
  },

  // ── Cross-Community Chat (Feature 4) ──────────
  crossCommA: null,
  crossCommB: null,

  async openCrossChat() {
    this.crossCommA = null;
    this.crossCommB = null;
    document.getElementById('overlayCrossChat').classList.add('open');
    await this.renderCrossChat();
  },

  async renderCrossChat() {
    const el = document.getElementById('crossChatBody');
    try {
      const res = await Api.getCommunities();
      const comms = (res.communities || []).filter(c => c.size > 1);

      // Find shared interests between selected communities
      let sharedHtml = '';
      if (this.crossCommA !== null && this.crossCommB !== null && this.crossCommA !== this.crossCommB) {
        const a = comms.find(c => c.id === this.crossCommA);
        const b = comms.find(c => c.id === this.crossCommB);
        if (a && b) {
          const aInt = new Set(a.interest_list || []);
          const bInt = new Set(b.interest_list || []);
          const shared = [...aInt].filter(i => bInt.has(i));
          const roomId = `cross_${Math.min(this.crossCommA, this.crossCommB)}_${Math.max(this.crossCommA, this.crossCommB)}`;

          sharedHtml = `
            <div class="detail-section" style="margin-top:12px">
              <div class="section-label">Shared Interests (${shared.length})</div>
              <div class="tag-group">${shared.length ? shared.map(i => `<span class="tag">${i}</span>`).join('') : '<span style="font-size:11px;color:var(--text-dim)">No shared interests</span>'}</div>
            </div>
            <div class="detail-section" style="margin-top:12px">
              <div class="section-label">Discussion Thread</div>
              <div class="chat-wrap">
                <div class="chat-messages" id="crossChatMessages"></div>
                <div class="chat-input-bar">
                  <input type="text" id="crossChatInput" placeholder="Type a message..." autocomplete="off"
                    onkeydown="if(event.key==='Enter')App.sendCrossMsg('${roomId}')">
                  <button onclick="App.sendCrossMsg('${roomId}')">Send</button>
                </div>
              </div>
            </div>`;
        }
      }

      el.innerHTML = `
        <div class="overlay-title">Cross-Community Communication</div>
        <div class="overlay-subtitle">Select two communities to open a shared discussion thread</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label class="form-label">Community A</label>
            <select class="form-input" onchange="App.crossCommA=parseInt(this.value);App.renderCrossChat()">
              <option value="">Select...</option>
              ${comms.map(c => `<option value="${c.id}" ${this.crossCommA === c.id ? 'selected' : ''}>#${c.id+1} ${c.dominant_interest}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="form-label">Community B</label>
            <select class="form-input" onchange="App.crossCommB=parseInt(this.value);App.renderCrossChat()">
              <option value="">Select...</option>
              ${comms.map(c => `<option value="${c.id}" ${this.crossCommB === c.id ? 'selected' : ''}>#${c.id+1} ${c.dominant_interest}</option>`).join('')}
            </select>
          </div>
        </div>
        ${sharedHtml}`;
    } catch (err) {
      el.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  sendCrossMsg(roomId) {
    const input = document.getElementById('crossChatInput');
    if (!input || !input.value.trim()) return;
    const container = document.getElementById('crossChatMessages');
    if (container) {
      const d = document.createElement('div');
      d.className = 'chat-msg';
      d.innerHTML = `<span class="msg-user">Guest</span><div class="msg-text">${esc(input.value)}</div><span class="msg-time">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>`;
      container.appendChild(d);
      container.scrollTop = container.scrollHeight;
    }
    input.value = '';
  },

  // ── Actions ───────────────────────────────────
  async recompute() {
    Toast.show('Recomputing SCC...', 'info');
    try {
      const res = await Api.recompute();
      Toast.show('SCC recomputed', 'success');
      if (res.events?.length) res.events.forEach(ev => this.showEvent(ev));
      Graph.loadData();
      this.updateStatus();
    } catch (err) { Toast.show(err.message, 'error'); }
  },

  async joinRequest(userId, commId) {
    try {
      const res = await Api.submitJoinRequest(userId, commId);
      if (res.success) Toast.show('Join request sent', 'success');
      else Toast.show(res.error || 'Failed', 'error');
    } catch (err) { Toast.show(err.message, 'error'); }
  },

  async resolveRequest(reqId, accept) {
    try {
      const res = accept ? await Api.acceptRequest(reqId) : await Api.rejectRequest(reqId);
      Toast.show(accept ? 'Request accepted' : 'Request rejected', accept ? 'success' : 'info');
      if (this.currentCommunityId !== null) this.loadCommunityTab(this.currentCommunityId);
    } catch (err) { Toast.show(err.message, 'error'); }
  }
};

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
window.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());
