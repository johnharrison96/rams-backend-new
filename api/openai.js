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

    const model = "gpt-4o";
    const temperature = 0;
    const top_p = 1;
    const seed = 42;

    // 1) Sequence of Works — keep natural “chat-style” phrasing
    const promptSeq = `${task} sequence of works`;

    // 2) Plant & Materials — basic list ONLY (no comments/sentences)
    const promptMat = `${task} plant and materials — Provide a basic bullet-point list ONLY. No comments, no descriptions, no sentences. One item per line.`;

    // 3) PPE — include EN/BS standards AND specific protection levels
    //    Keep it concise and submission-ready for main contractors.
    const promptPpe = `
${task} personal protection equipment (PPE) — Produce a concise bullet list suitable for RAMS submission to a main contractor.
REQUIREMENTS:
- Each line: item name + protection level/type + EN/BS standard in brackets.
- Be specific (examples: “FFP3”, “Cut level 5”, “Class 3 hi-vis”, “SNR 30 dB”, “toe & midsole protection SB-P/S1P”).
- No extra commentary or long sentences.

Example style (examples only — tailor to the task):
- Safety boots (EN ISO 20345, S1P or SB-P)
- Safety helmet (EN 397)
- Safety glasses (EN 166, impact grade F)
- High-visibility clothing (EN ISO 20471, Class 2 or 3)
- Cut-resistant gloves (EN 388, cut level 5)
- Respiratory protection (FFP3, EN 149)   // prefer FFP3 for dust/silica
- Hearing protection (EN 352, SNR ≥ 30 dB)
- Fall arrest harness where required (EN 361)
- Protective overalls (EN 13034, Type 6)

Output only the bullet list.
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
      } catch (e1) {
        await new Promise(r => setTimeout(r, 600)); // simple backoff
        return await run();
      }
    };

    // Token budgets
    const [sequenceOfWorks, plantAndMaterials, ppe] = await Promise.all([
      ask(promptSeq, 1400),
      ask(promptMat, 600),
      ask(promptPpe, 900),
    ]);

    return res.status(200).json({ sequenceOfWorks, plantAndMaterials, ppe });
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "Failed to generate RAMS", details: err?.message || "Unknown error" });
  }
}
