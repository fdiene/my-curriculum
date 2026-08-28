export interface RateLimiterState {
  perIp: Map<string, number[]>;
  globalDaily: { day: string; count: number };
}

export function createRateLimiterState(): RateLimiterState {
  return { perIp: new Map(), globalDaily: { day: "", count: 0 } };
}

const PER_IP_LIMIT = 10;
const PER_IP_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_DAILY_LIMIT = 200;

export function checkAndRecordPerIp(state: RateLimiterState, ip: string, now: Date = new Date()): boolean {
  const cutoff = now.getTime() - PER_IP_WINDOW_MS;
  const timestamps = (state.perIp.get(ip) ?? []).filter((t) => t > cutoff);
  if (timestamps.length >= PER_IP_LIMIT) {
    state.perIp.set(ip, timestamps);
    return false;
  }
  timestamps.push(now.getTime());
  state.perIp.set(ip, timestamps);
  return true;
}

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
