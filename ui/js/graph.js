/**
 * graph.js — D3.js force-directed graph (graph-first redesign)
 * Palette: #ECA72C, #087E8B, plus derived community hues
 */

const COMM_COLORS = [
  '#ECA72C', '#087E8B', '#E07A5F', '#81B29A', '#F2CC8F',
  '#3D405B', '#D4A373', '#6D6875', '#B5838D', '#FFB703',
  '#219EBC', '#8ECAE6', '#E76F51', '#2A9D8F', '#F4A261'
];

const Graph = {
  svg: null, g: null, zoom: null, simulation: null,
  data: null, nodes: null, links: null, nodeEls: null, linkEls: null,

  async init() {
    const area = document.getElementById('graphArea');
    const svgEl = document.getElementById('graphSvg');
    if (!area || !svgEl) return;

    const w = area.clientWidth;
    const h = area.clientHeight;

    this.svg = d3.select('#graphSvg').attr('width', w).attr('height', h);
    this.svg.selectAll('*').remove();

    // Defs
    const defs = this.svg.append('defs');
    // Arrow marker
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 18).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#2a3d3a');

    // Highlighted arrow
    defs.append('marker')
      .attr('id', 'arrow-hl')
      .attr('viewBox', '0 -4 8 8')
      .attr('refX', 18).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L8,0L0,4')
      .attr('fill', '#ECA72C');

    this.zoom = d3.zoom()
      .scaleExtent([0.15, 6])
      .on('zoom', (e) => this.g.attr('transform', e.transform));

    this.svg.call(this.zoom);
    this.g = this.svg.append('g');

    await this.loadData();
  },

  async loadData() {
    try {
      const res = await Api.getGraphData();
      if (!res.success) return;
      this.data = res;
      this.render();
    } catch (err) { console.error('[Graph]', err); }
  },

  render() {
    if (!this.data || !this.g) return;
    this.g.selectAll('*').remove();

    const { users, edges, communities } = this.data;
    const w = parseInt(this.svg.attr('width'));
    const h = parseInt(this.svg.attr('height'));

    // Community membership
    const cMap = {};
    (communities || []).forEach((c, i) => c.members.forEach(m => { cMap[m] = i; }));

    this.nodes = users.map(u => ({
      id: u.id, name: u.name, interests: u.interests,
      comm: cMap[u.id] !== undefined ? cMap[u.id] : -1
    }));

    const nodeIdx = {};
    this.nodes.forEach(n => { nodeIdx[n.id] = n; });

    this.links = edges.map(e => ({ source: e.from, target: e.to }))
      .filter(l => nodeIdx[l.source] && nodeIdx[l.target]);

    // Simulation
    this.simulation = d3.forceSimulation(this.nodes)
      .force('link', d3.forceLink(this.links).id(d => d.id).distance(70))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide().radius(16));

    // Links
    this.linkEls = this.g.append('g')
      .selectAll('line').data(this.links).enter()
      .append('line')
      .attr('stroke', '#1e2e2c')
      .attr('stroke-width', 0.8)
      .attr('marker-end', 'url(#arrow)');

    // Nodes group
    this.nodeEls = this.g.append('g')
      .selectAll('g').data(this.nodes).enter()
      .append('g')
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => { if (!e.active) this.simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) this.simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    // Node circles
    this.nodeEls.append('circle')
      .attr('r', d => d.comm >= 0 ? 7 : 4)
      .attr('fill', d => d.comm >= 0 ? COMM_COLORS[d.comm % COMM_COLORS.length] : '#2a3d3a')
      .attr('stroke', d => d.comm >= 0 ? COMM_COLORS[d.comm % COMM_COLORS.length] : '#1e2e2c')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.3);

    // Labels
    this.nodeEls.append('text')
      .text(d => d.name)
      .attr('dx', 10).attr('dy', 3.5)
      .attr('font-size', '10px')
      .attr('fill', '#577399')
      .attr('pointer-events', 'none');

    // Events
    this.nodeEls
      .on('mouseover', (e, d) => this.onHover(e, d))
      .on('mouseout', () => this.onHoverEnd())
      .on('click', (e, d) => this.onNodeClick(d));

    // Tick
    this.simulation.on('tick', () => {
      this.linkEls.attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);
      this.nodeEls.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    this.buildLegend(communities);
    this.updateMetrics();
  },

  // ── Hover: highlight connected ─────────────────
  onHover(event, d) {
    const connected = new Set();
    connected.add(d.id);
    this.links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === d.id) connected.add(t);
      if (t === d.id) connected.add(s);
    });

    this.nodeEls.select('circle')
      .transition().duration(150)
      .attr('opacity', n => connected.has(n.id) ? 1 : 0.1)
      .attr('r', n => n.id === d.id ? 10 : (connected.has(n.id) ? 7 : 4));

    this.nodeEls.select('text')
      .transition().duration(150)
      .attr('opacity', n => connected.has(n.id) ? 1 : 0.05);

    this.linkEls.transition().duration(150)
      .attr('stroke', l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return (s === d.id || t === d.id) ? '#ECA72C' : '#1e2e2c';
      })
      .attr('stroke-width', l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return (s === d.id || t === d.id) ? 1.5 : 0.5;
      })
      .attr('stroke-opacity', l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return (s === d.id || t === d.id) ? 1 : 0.1;
      })
      .attr('marker-end', l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return (s === d.id || t === d.id) ? 'url(#arrow-hl)' : 'url(#arrow)';
      });

    // Tooltip
    const tip = document.getElementById('graphTooltip');
    const commLabel = d.comm >= 0 ? `Community #${d.comm + 1}` : 'Isolated';
    tip.innerHTML = `<strong>${d.name}</strong><br><span style="color:var(--text-sec)">${commLabel} · ID ${d.id}</span><br><span style="color:var(--teal)">${(d.interests || []).join(', ')}</span>`;
    tip.style.display = 'block';
    tip.style.left = (event.pageX + 14) + 'px';
    tip.style.top = (event.pageY - 8) + 'px';
  },

  onHoverEnd() {
    this.nodeEls.select('circle').transition().duration(200)
      .attr('opacity', 1).attr('r', d => d.comm >= 0 ? 7 : 4);
    this.nodeEls.select('text').transition().duration(200).attr('opacity', 1);
    this.linkEls.transition().duration(200)
      .attr('stroke', '#1e2e2c').attr('stroke-width', 0.8)
      .attr('stroke-opacity', 1).attr('marker-end', 'url(#arrow)');
    document.getElementById('graphTooltip').style.display = 'none';
  },

  onNodeClick(d) {
    App.showNodeInfo(d);
  },

  // ── Highlight community ────────────────────────
  highlightCommunity(commId) {
    if (!this.nodeEls) return;
    this.nodeEls.select('circle').transition().duration(200)
      .attr('opacity', d => d.comm === commId ? 1 : 0.08)
      .attr('r', d => d.comm === commId ? 10 : 4);
    this.nodeEls.select('text').transition().duration(200)
      .attr('opacity', d => d.comm === commId ? 1 : 0.05);
    this.linkEls.transition().duration(200).attr('stroke-opacity', 0.05);
  },

  resetHighlight() {
    if (!this.nodeEls) return;
    this.nodeEls.select('circle').transition().duration(200)
      .attr('opacity', 1).attr('r', d => d.comm >= 0 ? 7 : 4);
    this.nodeEls.select('text').transition().duration(200).attr('opacity', 1);
    this.linkEls.transition().duration(200).attr('stroke-opacity', 1);
  },

  zoomFit() {
    if (!this.svg || !this.g) return;
    const bounds = this.g.node().getBBox();
    const w = parseInt(this.svg.attr('width'));
    const h = parseInt(this.svg.attr('height'));
    const scale = 0.85 / Math.max(bounds.width / w, bounds.height / h);
    const tx = (w - bounds.width * scale) / 2 - bounds.x * scale;
    const ty = (h - bounds.height * scale) / 2 - bounds.y * scale;
    this.svg.transition().duration(500)
      .call(this.zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  },

  buildLegend(communities) {
    const el = document.getElementById('graphLegend');
    if (!el) return;
    const multi = (communities || []).filter(c => c.size > 1);
    if (!multi.length) { el.innerHTML = '<div class="legend-title">No communities</div>'; return; }
    el.innerHTML = `<div class="legend-title">Communities</div>` +
      multi.map((c, i) => `<div class="legend-row" onclick="Graph.highlightCommunity(${c.id})">
        <span class="legend-dot" style="background:${COMM_COLORS[i % COMM_COLORS.length]}"></span>
        <span>#${c.id + 1} ${c.dominant_interest} (${c.size})</span>
      </div>`).join('');
  },

  updateMetrics() {
    const el = document.getElementById('graphMetrics');
    if (!el || !this.data) return;
    const m = this.data.metrics || {};
    el.innerHTML = `
      <div class="hud-chip"><strong>${m.vertices || 0}</strong> nodes</div>
      <div class="hud-chip"><strong>${m.edges || 0}</strong> edges</div>
      <div class="hud-chip">θ <strong>${m.threshold || 0.3}</strong></div>`;
  }
};

window.Graph = Graph;
