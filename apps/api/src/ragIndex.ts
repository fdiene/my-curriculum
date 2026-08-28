import { isAbsolute, join } from "node:path";
import { readFileSync } from "node:fs";
import type { EmbeddedChunk } from "@profile/core";

const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

export function loadRagIndex(path = "data/rag_index.json"): EmbeddedChunk[] {
  const file = isAbsolute(path) ? path : join(REPO_ROOT, path);
  return JSON.parse(readFileSync(file, "utf8")) as EmbeddedChunk[];
}

export const RAG_INDEX: EmbeddedChunk[] = loadRagIndex();
