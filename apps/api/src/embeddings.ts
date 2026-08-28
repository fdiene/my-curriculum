import { pipeline } from "@huggingface/transformers";

let extractorPromise: ReturnType<typeof pipeline<"feature-extraction">> | null = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });
  }
  return extractorPromise;
}

export async function embedText(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const out = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(out.data as Float32Array);
}

// Call once at server startup (see app.ts) so the first real visitor request
// does not pay for model load time - it should already be resident in memory.
export function warmEmbeddingModel(): Promise<void> {
  return embedText("warmup").then(() => undefined);
}
