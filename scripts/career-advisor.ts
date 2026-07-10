import Anthropic from "@anthropic-ai/sdk";
import type { ResumeInput } from "@profile/schema";
import { buildAdvisorPrompt, renderInsights } from "./advisor.core";

if (import.meta.main) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { console.error("ANTHROPIC_API_KEY is required"); process.exit(1); }
  const resume = (await Bun.file("data/master_data.fr.json").json()) as ResumeInput;
  const upskilling = await Bun.file("docs/UPSKILLING.md").exists() ? await Bun.file("docs/UPSKILLING.md").text() : undefined;
  const client = new Anthropic({ apiKey: key });
  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    tools: [{ type: "web_search_20250305", name: "web_search" } as any],
    messages: [{ role: "user", content: buildAdvisorPrompt(resume, upskilling) }],
  });
  const text = msg.content.filter((b) => b.type === "text").map((b: any) => b.text).join("\n");
  const md = renderInsights([{ title: "Advisor Report", body: text }]);
  await Bun.write("docs/career_insights.md", md);
  console.log("Wrote docs/career_insights.md (git-ignored)");
}
