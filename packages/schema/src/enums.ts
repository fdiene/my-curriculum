import { z } from "zod";

export const Tag = z.enum([
  "ai_safety", "dx_tooling", "devsecops", "iot", "edge", "mcp",
  "plm", "cloud", "security", "api_design", "mlops", "aerospace", "product",
]);
export type Tag = z.infer<typeof Tag>;

export const TargetRole = z.enum(["ai_dx", "iot", "plm_architect", "default"]);
export type TargetRole = z.infer<typeof TargetRole>;
