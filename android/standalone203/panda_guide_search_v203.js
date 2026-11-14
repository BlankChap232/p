/* Panda Tv Elite 2.0.3 standalone local Live Guide keyword search.
   Searches channel identity + the next 12h of verified EPG title/description
   metadata already on device. No network calls; no owner-console dependency. */
(function () {
  'use strict';
  if (window.PandaGuideSearch203) return;
  const HORIZON = 12 * 60 * 60 * 1000;
  const DB_NAME = 'PandaTvEliteEPG200', STORE = 'channels';
  const clean = v => String(v == null ? '' : v).toLowerCase().normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const isCurrent = p => {
    const now = Date.now(), start = Number(p?.start), stop = Number(p?.stop);
    return Number.isFinite(start) && Number.isFinite(stop) && stop > now && start < now + HORIZON;
  };
  function matchData(programs, q) {
    q = clean(q);
    if (q.length < 2 || !Array.isArray(programs)) return false;
    for (const p of programs) {
      if (!isCurrent(p)) continue;
      if (clean([p.title, p.subTitle, p.subtitle, p.desc, p.description, p.category].join(' ')).includes(q)) return true;
    }
    return false;
  }
  let query = '', results = new Set(), generation = 0, inputTimer = null;
  let indexing = false, scanned = 0, indexedHits = 0, indexFinished = false, lastSourceStamp = 0;
  const memory = new WeakMap();
  const st = () => typeof state === 'object' && state ? state : null;
  function stateSource(ch) {
    const epg = st()?.epg || {};
    for (const k of [ch?.epg, ch?.id, ch?.id == null ? '' : 'live:' + ch.id, ch?.name]) {
      const list = k == null ? null : epg[String(k)];
      if (Array.isArray(list) && list.length) return list;
    }
    return null;
  }
  function matches(ch, normalizedQuery) {
    const q = clean(normalizedQuery);
    if (q.length < 2) return false;
    if (results.has(String(ch?.id ?? ''))) return true;
    const list = stateSource(ch);
    if (!list) return false;
    const bucket = Math.floor(Date.now() / 60000);
    const cache = memory.get(list);
    if (cache && cache.bucket === bucket && cache.length === list.length) {
      return cache.content.includes(q);
    }
    // Limit to the EPG's documented 160-program per-channel cache.
    const content = list.slice(0, 160).filter(isCurrent)
      .map(p => clean([p.title, p.subTitle, p.subtitle, p.desc, p.description, p.category].join(' '))).join(' | ');
    memory.set(list, {bucket, length:list.length, content});
    return content.includes(q);
  }
  const status = () => {
    if (!query) return '';
    if (query.length < 2) return 'Type 2+ characters to include program details';
    if (indexing) return 'Checking saved EPG programs…';
    return indexFinished ? 'Channels + saved EPG (next 12h)' : 'Channels + available EPG';
  };
  function finish(token, found, inspected, ok) {
    if (token !== generation) return;
    indexing = false; indexFinished = ok; scanned = inspected;
    results = found; indexedHits = found.size;
    if (st()?.route === 'live' && clean(window.PandaSimple295?.guide?.query) === query) {
      try { window.p295GuideRefresh?.(); } catch (_) { /* guide remains usable */ }
    }
  }
  function scan(q) {
    const token = ++generation;
    query = clean(q).slice(0, 140); indexing = false; indexFinished = false;
    scanned = 0; indexedHits = 0; results = new Set();
    if (query.length < 2 || typeof indexedDB === 'undefined') return;
    indexing = true;
    let db;
    try {
      // Open without a schema version. Never create/upgrade the EPG store.
      const request = indexedDB.open(DB_NAME);
      request.onerror = () => finish(token, new Set(), 0, false);
      request.onsuccess = () => {
        db = request.result;
        if (token !== generation || !db.objectStoreNames.contains(STORE)) {
          db.close(); finish(token, new Set(), 0, false); return;
        }
        let inspected = 0;
        const found = new Set(), tx = db.transaction(STORE, 'readonly');
        const cursor = tx.objectStore(STORE).openCursor();
        cursor.onsuccess = e => {
          if (token !== generation) { try { tx.abort(); } catch (_) {} return; }
          const c = e.target.result;
          if (!c) return;
          inspected++;
          if (matchData(c.value?.programs, query)) found.add(String(c.key));
          c.continue();
        };
        cursor.onerror = () => { /* transaction onerror handles finish */ };
        tx.oncomplete = () => { db.close(); finish(token, found, inspected, true); };
        tx.onabort = () => { db.close(); finish(token, new Set(), inspected, false); };
        tx.onerror = () => { /* onabort follows */ };
      };
    } catch (_) { if (db) db.close(); finish(token, new Set(), 0, false); }
  }
  function begin(raw, force = false) {
    const next = clean(raw).slice(0, 140);
    if (!force && next === query && (indexing || indexFinished)) return;
    clearTimeout(inputTimer);
    // Immediately invalidate the old query and its results before the next
    // grid redraw; stale EPG hits must never appear under a new keyword.
    generation++;
    query = next; results = new Set(); indexing = false; indexFinished = false;
    scanned = 0; indexedHits = 0;
    if (next.length < 2) return;
    inputTimer = setTimeout(() => scan(next), 270);
  }
  const originalInput = window.p295GuideInput;
  if (typeof originalInput === 'function') {
    window.p295GuideInput = function (value) {
      // The existing grid filters channel names immediately without losing
      // input focus. The cached EPG results are added asynchronously.
      const result = originalInput(value);
      begin(value);
      return result;
    };
  }
  // The cloud-style EPG importer already refreshes IndexedDB. Reindex only
  // when a new import COMPLETES, never every time the user types or scrolls.
  setInterval(() => {
    const guide = window.PandaSimple295?.guide;
    if (!guide || st()?.route !== 'live' || clean(guide.query).length < 2) return;
    const stamp = Number(window.PandaEPG200?.status?.().lastComplete || 0);
    if (stamp && stamp !== lastSourceStamp) {
      lastSourceStamp = stamp;
      begin(guide.query, true);
    }
  }, 45000);
  window.PandaGuideSearch203 = Object.freeze({
    version:'2.0.3', matches, matchData, normalize:clean,
    begin, status, inspect: () => ({
      query, indexing, indexedHits, scanned, indexFinished,
      remoteRequests:0, nextHours:12
    })
  });
})();