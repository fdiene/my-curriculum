import { describe, expect, it } from "bun:test";
import { createRateLimiterState, checkAndRecordPerIp, checkGlobalDailyLimit, recordGlobalDailyUsage } from "./rateLimiter";

describe("checkAndRecordPerIp", () => {
  it("allows up to 10 requests per IP within an hour, then blocks", () => {
    const state = createRateLimiterState();
    const now = new Date("2026-01-01T12:00:00.000Z");
    for (let i = 0; i < 10; i++) {
      expect(checkAndRecordPerIp(state, "1.2.3.4", now)).toBe(true);
    }
    expect(checkAndRecordPerIp(state, "1.2.3.4", now)).toBe(false);
  });

  it("tracks different IPs independently", () => {
    const state = createRateLimiterState();
    const now = new Date("2026-01-01T12:00:00.000Z");
    for (let i = 0; i < 10; i++) checkAndRecordPerIp(state, "1.2.3.4", now);
    expect(checkAndRecordPerIp(state, "5.6.7.8", now)).toBe(true);
  });

  it("allows requests again after the 1-hour window has passed", () => {
    const state = createRateLimiterState();
    const t0 = new Date("2026-01-01T12:00:00.000Z");
    for (let i = 0; i < 10; i++) checkAndRecordPerIp(state, "1.2.3.4", t0);
    expect(checkAndRecordPerIp(state, "1.2.3.4", t0)).toBe(false);
    const tLater = new Date(t0.getTime() + 61 * 60 * 1000);
    expect(checkAndRecordPerIp(state, "1.2.3.4", tLater)).toBe(true);
  });
});

describe("checkAndRecordPerIp eviction sweep", () => {
  it("evicts stale IP entries from the map once enough calls cross the sweep threshold", () => {
    const state = createRateLimiterState();
    const t0 = new Date("2026-01-01T12:00:00.000Z");

    // 50 distinct IPs, each recorded once at t0 (simulating a spoofed/varying
    // x-forwarded-for header - each IP is only ever seen once, so it's never
    // re-filtered by a later lookup of that same IP).
    for (let i = 0; i < 50; i++) {
      checkAndRecordPerIp(state, `10.0.0.${i}`, t0);
    }
    expect(state.perIp.size).toBe(50);

    // Advance past the 1-hour window: every one of those 50 entries is now stale.
    const tLater = new Date(t0.getTime() + 61 * 60 * 1000);

    // Trigger enough further calls (each a fresh IP, so we're not just re-filtering
    // the same key) to cross the sweep threshold at least once.
    for (let i = 0; i < 100; i++) {
      checkAndRecordPerIp(state, `20.0.0.${i}`, tLater);
    }

    // If eviction never ran, the map would hold all 150 entries (50 stale + 100
    // live). Asserting the actual size proves the map itself shrank, not just that
    // a stale IP's individual timestamps are gone from a .get() lookup.
    expect(state.perIp.size).toBe(100);
  });
});

describe("checkGlobalDailyLimit and recordGlobalDailyUsage", () => {
  it("allows up to 200 calls per day, then blocks", () => {
    const state = createRateLimiterState();
    const now = new Date("2026-01-01T12:00:00.000Z");
    for (let i = 0; i < 200; i++) {
      expect(checkGlobalDailyLimit(state, now)).toBe(true);
      recordGlobalDailyUsage(state, now);
    }
    expect(checkGlobalDailyLimit(state, now)).toBe(false);
  });

  it("does not increment on check alone, only on recordGlobalDailyUsage", () => {
    const state = createRateLimiterState();
    const now = new Date("2026-01-01T12:00:00.000Z");
    checkGlobalDailyLimit(state, now);
    checkGlobalDailyLimit(state, now);
    checkGlobalDailyLimit(state, now);
    expect(state.globalDaily.count).toBe(0);
  });

  it("resets the count on a new day", () => {
    const state = createRateLimiterState();
    const day1 = new Date("2026-01-01T23:59:00.000Z");
    for (let i = 0; i < 200; i++) recordGlobalDailyUsage(state, day1);
    expect(checkGlobalDailyLimit(state, day1)).toBe(false);
    const day2 = new Date("2026-01-02T00:01:00.000Z");
    expect(checkGlobalDailyLimit(state, day2)).toBe(true);
  });
});
