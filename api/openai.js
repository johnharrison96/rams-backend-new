// Vercel Pro: allow up to 60s for detailed generations
export const config = { maxDuration: 60 };

import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    const { task } = req.body || {};
    if (!task || typeof task !== "string") {
      return res.status(400).json({ error: "Missing or invalid task" });
    }

    // Use same family as this chat for similar tone/format
    const model = "gpt-4o";
    const temperature = 0;
    const top_p = 1;
    const seed = 42;

    // — Prompts —
    // 1) Chat-style SoW (exactly like you'd type here)
    const promptSeq = `${task} sequence of works`;

    // 2) Plant & Materials: list-only (no comments/sentences)
    const promptMat = `${task} plant and materials — Provide a basic bullet-point list ONLY. No comments, no descriptions, no sentences. One item per line.`;

    // 3) PPE: UK standards BASIC (concise item + standard)
    const promptPpe = `
${task} personal protection equipment (PPE) — Provide a concise bullet-point list for a formal RAMS submission.
Include relevant UK/EN standards in brackets, with minimal text. One item per line.
Example style:
- Safety boots (EN ISO 20345)
- Safety helmet (EN 397)
- Safety glasses (EN 166)
Avoid extra commentary or long sentences.
`.trim();

    const ask = async (content, max_tokens) => {
      const run = async () => {
        const r = await client.chat.completions.create({
          model,
          messages: [{ role: "user", content }],
          temperature,
          top_p,
          max_tokens,
          seed,
        });
        return r.choices?.[0]?.message?.content ?? "";
      };
      try {
        return await run();
      } catch {
        await new Promise(r => setTimeout(r, 600)); // simple backoff
        return await run();
      }
    };

    // Token budgets (plenty for detail, still safe under Pro’s window)
    const [sequenceOfWorks, plantAndMaterials, ppe] = await Promise.all([
      ask(promptSeq, 1400),
      ask(promptMat, 600),
      ask(promptPpe, 800),
    ]);

    return res.status(200).json({ sequenceOfWorks, plantAndMaterials, ppe });
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "Failed to generate RAMS", details: err?.message || "Unknown error" });
  }
}
