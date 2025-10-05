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
    const temperature = 0;     // consistent wording
    const top_p = 1;
    const seed = 42;

    // --- helpers ---
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

    // Remove common Markdown leftovers and openings like "Certainly!"
    const clean = (txt) => (txt || "")
      .replace(/^\s*certainly!.*\n?/i, "")
      .replace(/```[\s\S]*?```/g, "")     // code fences
      .replace(/\*\*/g, "")               // bold markers
      .replace(/__|~~/g, "")              // underline/strike
      .replace(/^-{3,}\s*$/gm, "")        // --- rules
      .trim();

    // 1) Sequence of Works — plain text, no Markdown
    const promptSeq = `
For the task "${task}", write a professional RAMS Sequence of Works.

Formatting rules (strict):
- PLAIN TEXT ONLY. No Markdown, no asterisks, no bold, no headings with **, no code blocks.
- Start directly with "1. ..." (do not add an intro sentence).
- Use numbered stages: 1., 2., 3., ...
- Under each stage provide 2–5 short bullet points, each starting with "- ".
- Keep bullets concise and actionable (site-ready).
- End after the last stage (no summary paragraph).
`.trim();

    // 2) Plant & Materials — task-focused list (no sentences)
    const promptMat = `List the specific plant, tools, access equipment, consumables, and materials required to carry out ${task} on a construction site. Use a simple bullet-point list only (one item per line). No sentences or commentary.`;

    // 3) PPE — include levels + EN/BS standards (concise)
    const promptPpe = `
For the task "${task}", list the Personal Protective Equipment (PPE) required.
Each line must include the protection level/type and the relevant EN/BS standard in brackets.
Keep it concise; bullet list only.

Example style (tailor to the task):
- Safety boots (EN ISO 20345, S1P or SB-P)
- Safety helmet (EN 397)
- Safety glasses (EN 166, impact grade F)
- High-visibility clothing (EN ISO 20471, Class 2 or 3)
- Cut-resistant gloves (EN 388, cut level 5)
- Respiratory protection (FFP3, EN 149)
- Hearing protection (EN 352, SNR ≥ 30 dB)
- Fall arrest harness where required (EN 361)
- Protective overalls (EN 13034, Type 6)
Output only the bullet list.
`.trim();

    const [sRaw, mRaw, pRaw] = await Promise.all([
      ask(promptSeq, 1400),
      ask(promptMat, 600),
      ask(promptPpe, 900),
    ]);

    return res.status(200).json({
      sequenceOfWorks: clean(sRaw),
      plantAndMaterials: clean(mRaw),
      ppe: clean(pRaw),
    });

  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({ error: "Failed to generate RAMS", details: err?.message || "Unknown error" });
  }
}
