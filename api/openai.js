// ✅ Vercel Pro optimization: allow up to 60s
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

    // Use the same family this chat runs on
    const model = "gpt-4o";
    const temperature = 0; // consistent, ChatGPT-like
    const top_p = 1;
    const seed = 42;

    // 👇 Prompts tailored to your spec
    // 1) Sequence should mirror a fresh chat: just the phrase you’d type here.
    const promptSeq = `${task} sequence of works`;

    // 2) Plant & Materials: list-only, no sentences/comments.
    const promptMat = `${task} plant and materials — Provide a basic bullet-point list ONLY (no comments, no descriptions, no sentences).`;

    // 3) PPE: clear, practical list WITHOUT UK standards.
    const promptPpe = `${task} personal protection equipment (PPE) — Provide a clear bullet-point list suitable for operatives. Do NOT include standards.`;

    const ask = async (content, max_tokens) => {
      const run = async () => {
        const r = await client.chat.completions.create({
          model,
          messages: [{ role: "user", content }], // no system prompt => closer to chat style
          temperature,
          top_p,
          max_tokens,
          seed, // helps repeatability (ChatGPT UI may not use it, but it's fine for API)
        });
        return r.choices?.[0]?.message?.content ?? "";
      };

      // simple retry once for transient errors
      try {
        return await run();
      } catch (e1) {
        await new Promise((r) => setTimeout(r, 600));
        return await run();
      }
    };

    // Token budgets: more for Sequence; smaller for list-only outputs
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
