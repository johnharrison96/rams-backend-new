// Vercel Pro: allow up to 60s
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
    const temperature = 0.2;
    const top_p = 1;
    const seed = 42;

    // 1️⃣ Sequence of Works — natural, same as ChatGPT
    const promptSeq = `${task} sequence of works`;

    // 2️⃣ Plant & Materials — keep your previous perfect version
    const promptMat = `List the specific plant, tools, access equipment, and materials required to carry out ${task} on a construction site. Use a simple bullet-point list only. No sentences, commentary, or descriptions.`;

    // 3️⃣ PPE — keep your detailed, legally compliant version (EN/BS standards + protection levels)
    const promptPpe = `
For the task "${task}", list the Personal Protective Equipment (PPE) required.
Each line must include both the protection level/type and the relevant EN or BS standard.
Keep it concise and formatted as a bullet-point list suitable for RAMS submission.
Example:
- Safety boots (EN ISO 20345, S1P or SB-P)
- Safety helmet (EN 397)
- Safety glasses (EN 166, impact grade F)
- High-visibility clothing (EN ISO 20471, Class 2 or 3)
- Cut-resistant gloves (EN 388, cut level 5)
- Respiratory protection (FFP3, EN 149)
- Hearing protection (EN 352, SNR ≥ 30 dB)
- Fall arrest harness (EN 361)
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
      try { return await run(); }
      catch { await new Promise(r => setTimeout(r, 500)); return await run(); }
    };

    const clean = (txt) =>
      (txt || "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/\*\*/g, "")
        .replace(/__|~~/g, "")
        .replace(/^\s*(Certainly|Sure|Of course)[!.,\s-]*/i, "")
        .trim();

    // Run all three prompts in parallel
    const [sRaw, mRaw, pRaw] = await Promise.all([
      ask(promptSeq, 2000),
      ask(promptMat, 800),
      ask(promptPpe, 900),
    ]);

    return res.status(200).json({
      sequenceOfWorks: clean(sRaw),
      plantAndMaterials: clean(mRaw),
      ppe: clean(pRaw),
    });
  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({
      error: "Failed to generate RAMS",
      details: err?.message || "Unknown error",
    });
  }
}
