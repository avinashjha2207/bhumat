// public/geoWorker.js - Hardware-accelerated background spatial matcher
self.onmessage = function (e) {
  const { type, features, query } = e.data;

  if (type === 'SEARCH_SEATS') {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      self.postMessage({ type: 'SEARCH_RESULTS', matches: [] });
      return;
    }
    const matches = (features || []).filter((f) => {
      const p = f.properties || {};
      const pc = (p.PC_NAME || p.pc_name || p.name || '').toLowerCase();
      const st = (p.ST_NAME || p.st_name || p.state || '').toLowerCase();
      return pc.includes(q) || st.includes(q);
    }).map((f) => ({
      name: f.properties.PC_NAME || f.properties.pc_name || f.properties.name,
      state: f.properties.ST_NAME || f.properties.st_name || f.properties.state
    }));

    self.postMessage({ type: 'SEARCH_RESULTS', matches: matches.slice(0, 10) });
  }
};