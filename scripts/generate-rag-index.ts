import { pipeline } from "@huggingface/transformers";
import { ResumeSchema, type Resume } from "@profile/schema";
import { buildRagChunks, type EmbeddedChunk } from "@profile/core";

if (import.meta.main) {
  const raw = await Bun.file("data/master_data.i18n.json").json();
  const data: Resume = ResumeSchema.parse(raw);
  const chunks = buildRagChunks(data);

  console.log(`Embedding ${chunks.length} chunks with Xenova/all-MiniLM-L6-v2 (quantized)...`);
  const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", { dtype: "q8" });

  const embedded: EmbeddedChunk[] = [];
  for (const chunk of chunks) {
    const out = await extractor(chunk.text, { pooling: "mean", normalize: true });
    embedded.push({ ...chunk, embedding: Array.from(out.data as Float32Array) });
  }

  await Bun.write("data/rag_index.json", JSON.stringify(embedded, null, 2));
  console.log(`Wrote data/rag_index.json with ${embedded.length} chunks.`);
}
