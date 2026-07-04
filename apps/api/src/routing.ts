import type { Tag, TargetRole } from "@profile/schema";

export const ROLE_WEIGHTS: Record<TargetRole, Partial<Record<Tag, number>>> = {
  anthropic_dx: { ai_safety: 10, dx_tooling: 9, mcp: 7, devsecops: 6, api_design: 5 },
  iot: { iot: 10, edge: 9, mcp: 6, ai_safety: 5, devsecops: 4 },
  plm_architect: { plm: 10, cloud: 7, security: 6, aerospace: 5 },
  default: {},
};

export function scoreItem(tags: Tag[], role: TargetRole): number {
  const w = ROLE_WEIGHTS[role];
  return tags.reduce((sum, t) => sum + (w[t] ?? 0), 0);
}

// Editorial override: featured_for pins curated items above any achievable tag score (max ≈ 37).
const FEATURED_BOOST = 100;

export function orderByRole<T extends { tags: Tag[]; featured_for?: TargetRole[] }>(
  items: T[],
  role: TargetRole,
): T[] {
  return items
    .map((item, i) => ({
      item,
      i,
      score: scoreItem(item.tags, role) + (item.featured_for?.includes(role) ? FEATURED_BOOST : 0),
    }))
    .sort((a, b) => b.score - a.score || a.i - b.i) // stable: original order breaks ties
    .map((x) => x.item);
}
