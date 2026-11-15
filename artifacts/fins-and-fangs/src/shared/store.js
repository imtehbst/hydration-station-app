// Fins & Fangs — persistence + presence behind one interface.
//
// GameStore = {
//   me(): Promise<{uid, name}>
//   subscribe(cb(state|null, err?: 'broken'|'timeout'|'lost')): unsubscribe
//   write(next, expectedTurnNo|null, expectedStatus?, opts?): Promise<boolean>   // false = stale, not written
//     opts.apply(cur) => next|null recomputes from the freshest doc under the lease
//     opts.orCreate also calls apply (with null) when there is no doc yet
//     opts.refuseIfPlaying refuses to replace a game in progress
//   onPeers(cb(onlineUids[])): void
//   names(uids[]): Promise<Record<uid, string>>
// }

// ---------- local backend (two tabs on one computer, ?dev=<uid>) ----------

export function createLocalStore(KEY, uid, name, validateState, storage = globalThis.localStorage, win = globalThis.window ?? null) {
  const subs = new Set();
  const read = () => {
    const raw = storage.getItem(KEY);
    if (raw === null) return [null, undefined];
    try {
      const s = validateState(JSON.parse(raw));
      return s ? [s, undefined] : [null, 'broken'];
    } catch {
      return [null, 'broken'];
    }
  };
  const emit = () => { const [s, e] = read(); for (const cb of subs) cb(s, e); };
  if (win) win.addEventListener('storage', (ev) => { if (ev.key === KEY) emit(); });

  return {
    async me() { return { uid, name }; },
    subscribe(cb) {
      subs.add(cb);
      setTimeout(() => { const [s, e] = read(); cb(s, e); }, 0);
      return () => subs.delete(cb);
    },
    async write(next, expectedTurnNo, expectedStatus, opts = {}) {
      if (opts.apply) {
        const [cur] = read();
        let out = null;
        try { out = cur || opts.orCreate ? opts.apply(cur) : null; } catch { out = null; }
        if (!out) return false;
        storage.setItem(KEY, JSON.stringify(out));
        emit();
        return true;
      }
      if (opts.refuseIfPlaying && read()[0]?.status === 'playing') return false;
      if (expectedTurnNo !== null) {
        const [cur] = read();
        if (!cur || cur.turnNo !== expectedTurnNo) return false;
        if (expectedStatus && cur.status !== expectedStatus) return false;
      }
      storage.setItem(KEY, JSON.stringify(next));
      emit();
      return true;
    },
    onPeers(cb) {
      if (!win) return;
      const beat = () => storage.setItem(`fnf:presence:${uid}`, String(Date.now()));
      const scan = () => {
        const out = [];
        for (let i = 0; i < storage.length; i++) {
          const k = storage.key(i);
          if (k?.startsWith('fnf:presence:') && k !== `fnf:presence:${uid}` && Date.now() - Number(storage.getItem(k)) < 15000) {
            out.push(k.slice('fnf:presence:'.length));
          }
        }
        cb(out);
      };
      beat(); scan();
      setInterval(() => { beat(); scan(); }, 4000);
    },
    async names(uids) { return Object.fromEntries(uids.map((u) => [u, u])); },
  };
}

// ---------- artifact backend (db + user + room capabilities) ----------

export async function createArtifactStore(path, validateState) {
  const claude = globalThis.claude;
  if (!claude?.use) return null;
  const [db, user, room] = await Promise.all([claude.use('db'), claude.use('user'), claude.use('room')]);
  if (!db || !user) return null;
  const uid = await user.id();
  if (!uid) return null;
  // path may depend on who is playing: bot games are saved per person
  const ref = db.doc(typeof path === 'function' ? path(uid) : path);

  return {
    async me() { return { uid, name: '' }; },
    subscribe(cb) {
      let settled = false;
      const timer = setTimeout(() => { if (!settled) cb(null, 'timeout'); }, 10000);
      const off = ref.onSnapshot((snap) => {
        if (!snap.metadata.fromCache) { settled = true; clearTimeout(timer); }
        if (!snap.exists) return settled ? cb(null) : undefined; // a cached "no game" may be wrong
        const s = validateState(JSON.parse(JSON.stringify(snap.data())));
        cb(s, s ? undefined : 'broken');
      }, () => { settled = true; clearTimeout(timer); cb(null, 'lost'); });
      return () => { clearTimeout(timer); off?.(); };
    },
    async write(next, expectedTurnNo, expectedStatus, opts = {}) {
      // Short lease as a turn lock; the API has no release, so keep it
      // minimal (1 s) and retry while someone else's lease runs out.
      let lease = { acquired: false };
      for (let i = 0; i < 6 && !lease.acquired; i++) {
        try { lease = await ref.acquire({ holder: uid, ttlMs: 1000 }); } catch { console.warn('fins-and-fangs: lease unavailable, writing unlocked'); lease = { acquired: true }; }
        if (!lease.acquired) await new Promise((r) => setTimeout(r, 120 * (i + 1) + Math.random() * 80));
      }
      if (!lease.acquired) return false;
      if (opts.apply) {
        const snap = await ref.get();
        const cur = snap.exists ? validateState(JSON.parse(JSON.stringify(snap.data()))) : null;
        let out = null;
        try { out = cur || opts.orCreate ? opts.apply(cur) : null; } catch { out = null; }
        if (!out) return false;
        await ref.set(JSON.parse(JSON.stringify(out)));
        return true;
      }
      if (expectedTurnNo !== null || opts.refuseIfPlaying) {
        const snap = await ref.get();
        const cur = snap.exists ? validateState(JSON.parse(JSON.stringify(snap.data()))) : null;
        if (opts.refuseIfPlaying && cur?.status === 'playing') return false;
      }
      if (expectedTurnNo !== null) {
        const snap = await ref.get();
        const cur = snap.exists ? validateState(JSON.parse(JSON.stringify(snap.data()))) : null;
        if (!cur || cur.turnNo !== expectedTurnNo) return false;
        if (expectedStatus && cur.status !== expectedStatus) return false;
      }
      await ref.set(JSON.parse(JSON.stringify(next)));
      return true;
    },
    onPeers(cb) {
      if (!room) return;
      try { Promise.resolve(room.presence({ uid })).catch(() => {}); } catch { /* presence is optional */ }
      try {
        room.onPeers((ch) => cb([...new Set((ch?.peers || []).filter((p) => !p.isMe && p.kind !== 'agent').map((p) => p.by || p.presence?.uid).filter(Boolean))]), () => cb([]));
      } catch { cb([]); }
    },
    async names(uids) {
      try {
        const ps = await user.profiles(uids);
        return Object.fromEntries(uids.map((u) => [u, ps?.[u]?.name || 'Someone']));
      } catch {
        return Object.fromEntries(uids.map((u) => [u, 'Someone']));
      }
    },
  };
}
