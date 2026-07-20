import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { appendFileSync } from "node:fs";
import type { ResumeInput } from "@profile/schema";
import { AdvisorReportSchema, buildAdvisorPrompt, renderInsights } from "./advisor.core";
import { buildTelemetryLine, diffUpskilling, readLastTelemetryLine } from "./career-telemetry.core";

if (import.meta.main) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }
  const resume = (await Bun.file("data/master_data.fr.json").json()) as ResumeInput;
  const upskilling = await Bun.file("docs/UPSKILLING.md").exists() ? await Bun.file("docs/UPSKILLING.md").text() : undefined;

  const jobOfferArg = process.argv[2];
  const targetJobOffer = jobOfferArg
    ? (await Bun.file(jobOfferArg).exists()) ? await Bun.file(jobOfferArg).text() : jobOfferArg
    : undefined;

  const telemetryPath = "docs/career_telemetry.jsonl";
  const previousJsonl = await Bun.file(telemetryPath).exists() ? await Bun.file(telemetryPath).text() : "";
  const previousLine = readLastTelemetryLine(previousJsonl);
  const upskillingDelta = diffUpskilling(previousLine?.upskilling ?? null, upskilling ?? "");

  const client = new Anthropic({ apiKey: key });
  console.log("Calling Anthropic (structured output + web_search, streaming - can take several minutes)...");
  const startedAt = Date.now();
  const stream = client.messages.stream({
    model: "claude-opus-4-8",
    max_tokens: 32000,
    tools: [{ type: "web_search_20260209", name: "web_search" }],
    output_config: { format: zodOutputFormat(AdvisorReportSchema) },
    messages: [{ role: "user", content: buildAdvisorPrompt(resume, upskilling, targetJobOffer) }],
  });
  const msg = await stream.finalMessage();
  console.log(`API call returned after ${Math.round((Date.now() - startedAt) / 1000)}s (stop_reason=${msg.stop_reason})`);

  if (msg.stop_reason === "max_tokens") {
    console.error("Response hit the max_tokens ceiling before completing; no files were written.");
    process.exit(1);
  }

  const textBlock = msg.content.find((b) => b.type === "text");
  let rawJson: unknown;
  try {
    rawJson = textBlock ? JSON.parse(textBlock.text) : undefined;
  } catch (error) {
    console.error("Structured output was not valid JSON; no files were written.", error);
    process.exit(1);
  }
  const parseResult = AdvisorReportSchema.safeParse(rawJson);
  if (!parseResult.success) {
    console.error("Structured output parsing failed; no files were written.", parseResult.error);
    process.exit(1);
  }
  const parsed = parseResult.data;

  const md = renderInsights([{ title: "Advisor Report", body: parsed.report_markdown }]);
  await Bun.write("docs/career_insights.md", md);

  const telemetryLine = buildTelemetryLine(upskillingDelta, parsed.telemetry);
  appendFileSync(telemetryPath, `${telemetryLine}\n`, "utf8");

  console.log("Wrote docs/career_insights.md and appended docs/career_telemetry.jsonl (both git-ignored)");
}
