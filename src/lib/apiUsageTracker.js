export class ApiUsageTracker {
  constructor({ limits = {}, onThreshold = () => {} }) {
    this.limits = limits;
    this.onThreshold = onThreshold;
    this.usage = {};
    this.load();
  }
  load() {
    try {
      const saved = localStorage.getItem("pw_api_tracker");
      if (saved) this.usage = JSON.parse(saved);
    } catch {}
  }
  save() {
    try { localStorage.setItem("pw_api_tracker", JSON.stringify(this.usage)); } catch {}
  }
  record(api) {
    const today = new Date().toISOString().slice(0, 10);
    if (!this.usage[api] || this.usage[api].date !== today) {
      this.usage[api] = { count: 0, date: today };
    }
    this.usage[api].count++;
    this.save();
    const limit = this.limits[api];
    if (limit && this.usage[api].count >= limit * 0.9) {
      this.onThreshold(Math.round(this.usage[api].count / limit * 100), { api, count: this.usage[api].count, limit });
    }
  }
  canCall(api) {
    const today = new Date().toISOString().slice(0, 10);
    if (!this.usage[api] || this.usage[api].date !== today) return true;
    return this.usage[api].count < (this.limits[api] || Infinity);
  }

  // ── Added: needed by ApiUsageDashboard (the "API Usage" tab UI) ──────────

  // Status for a single tracked API today: { api, count, limit, remaining, percent }
  status(api) {
    const today = new Date().toISOString().slice(0, 10);
    const entry = (this.usage[api] && this.usage[api].date === today) ? this.usage[api] : { count: 0, date: today };
    const limit = this.limits[api] ?? Infinity;
    const percent = limit === Infinity ? 0 : Math.round((entry.count / limit) * 100);
    return {
      api,
      count: entry.count,
      limit,
      remaining: limit === Infinity ? Infinity : Math.max(limit - entry.count, 0),
      percent,
    };
  }

  // Status for every API registered in `limits` — powers the usage table.
  statusAll() {
    return Object.keys(this.limits).map((api) => this.status(api));
  }

  // Manually reset one API's counter (used by the "Reset X counter" buttons).
  // reset(api) {
  //   const today = new Date().toISOString().slice(0, 10);
  //   this.usage[api] = { count: 0, date: today };
  //   this.save();
  // }
}

export function makeCache(key, ttlMs) {
  return {
    get() {
      try {
        const o = localStorage.getItem(key);
        if (!o) return null;
        const parsed = JSON.parse(o);
        if (Date.now() - parsed.at > ttlMs) return null;
        return parsed.value;
      } catch { return null; }
    },
    set(value) {
      try { localStorage.setItem(key, JSON.stringify({ value, at: Date.now() })); } catch {}
    },
  };
}