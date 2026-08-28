export interface RateLimiterState {
  perIp: Map<string, number[]>;
  globalDaily: { day: string; count: number };
  sweepCounter: number;
}

export function createRateLimiterState(): RateLimiterState {
  return { perIp: new Map(), globalDaily: { day: "", count: 0 }, sweepCounter: 0 };
}

const PER_IP_LIMIT = 10;
const PER_IP_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_DAILY_LIMIT = 200;

// The map key comes directly from the x-forwarded-for header, so a client that varies
// it on every request would otherwise grow `perIp` without bound - individual stale
// timestamps get filtered on lookup, but an IP that's never looked up again keeps its
// (now-empty-on-next-look) entry forever. Sweep the whole map opportunistically, but
// only every SWEEP_INTERVAL calls, so a single request stays cheap and this stays an
// amortized cost rather than an O(map size) operation on every request.
const SWEEP_INTERVAL = 100;

export function checkAndRecordPerIp(state: RateLimiterState, ip: string, now: Date = new Date()): boolean {
  const cutoff = now.getTime() - PER_IP_WINDOW_MS;
  const timestamps = (state.perIp.get(ip) ?? []).filter((t) => t > cutoff);
  let allowed: boolean;
  if (timestamps.length >= PER_IP_LIMIT) {
    state.perIp.set(ip, timestamps);
    allowed = false;
  } else {
    timestamps.push(now.getTime());
    state.perIp.set(ip, timestamps);
    allowed = true;
  }

  state.sweepCounter += 1;
  if (state.sweepCounter >= SWEEP_INTERVAL) {
    state.sweepCounter = 0;
    sweepStalePerIpEntries(state, cutoff);
  }

  return allowed;
}

// Deletes any IP entry whose newest timestamp already falls outside the current
// window, so entries that are never looked up again (e.g. a spoofed/varying
// x-forwarded-for header) actually get removed from the map, not just filtered
// internally the next time that same IP happens to be seen again.
function sweepStalePerIpEntries(state: RateLimiterState, cutoff: number): void {
  for (const [ip, timestamps] of state.perIp) {
    const newest = timestamps.length ? Math.max(...timestamps) : -Infinity;
    if (newest <= cutoff) {
      state.perIp.delete(ip);
    }
  }
}

// Note: this is a UTC calendar-day boundary, not a rolling 24h window - e.g. up to 200
// calls near 23:59 UTC plus 200 more just after 00:00 UTC. Accepted: cost is negligible
// at Haiku pricing and this matches the plan's own test expectations.
function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function checkGlobalDailyLimit(state: RateLimiterState, now: Date = new Date()): boolean {
  const key = dayKey(now);
  if (state.globalDaily.day !== key) return true;
  return state.globalDaily.count < GLOBAL_DAILY_LIMIT;
}

export function recordGlobalDailyUsage(state: RateLimiterState, now: Date = new Date()): void {
  const key = dayKey(now);
  if (state.globalDaily.day !== key) {
    state.globalDaily.day = key;
    state.globalDaily.count = 0;
  }
  state.globalDaily.count += 1;
}
