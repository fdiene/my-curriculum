const samples: number[] = [];
const MAX = 500;

export function recordLatency(ms: number): void {
  samples.push(ms);
  if (samples.length > MAX) samples.shift();
}

export function latencySummary() {
  if (samples.length === 0) return { count: 0, avg_ms: 0, p95_ms: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]!;
  return { count: sorted.length, avg_ms: Math.round(avg * 100) / 100, p95_ms: p95 };
}

let cache: { repo: string | undefined; count: number; at: number } | null = null;
const TTL_MS = 5 * 60 * 1000;

export async function fetchCommitCount(fetchImpl: typeof fetch = fetch): Promise<number> {
  const repo = process.env.GITHUB_REPO;
  if (cache && cache.repo === repo && Date.now() - cache.at < TTL_MS) return cache.count;
  try {
    if (!repo) return 0;
    const headers: Record<string, string> = { "User-Agent": "profile-engine" };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/commits?per_page=1`, { headers });
    if (!res.ok) return 0;
    const link = res.headers.get("Link") ?? "";
    const m = link.match(/[?&]page=(\d+)>;\s*rel="last"/);
    const count = m ? parseInt(m[1]!, 10) : (Array.isArray(await res.clone().json()) ? 1 : 0);
    cache = { repo, count, at: Date.now() };
    return count;
  } catch { return 0; }
}

export async function getMetrics(fetchImpl: typeof fetch = fetch) {
  return {
    latency: latencySummary(),
    commits: await fetchCommitCount(fetchImpl),
    uptime_pct: Number(process.env.UPTIME_PCT ?? "99.9"),
  };
}
