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

    // Light cleaner: strip markdown symbols / chatty openers
    const clean = (txt) => (txt || "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/\*\*/g, "")
      .replace(/__|~~/g, "")
      .replace(/^\s*(Certainly|Sure|Of course)[!.,\s-]*/i, "")
      .trim();

    // 1) SEQUENCE OF WORKS — consistent structure, no intro paragraph
    const promptSeq = `
Write a professional RAMS "Sequence of Works" for "${task}" using UK construction terminology.

FORMAT (strict):
- PLAIN TEXT ONLY (no Markdown).
- Start immediately with stage "1. Pre-Start Preparations" (no introductory paragraph).
- Provide 8–12 numbered stages total:
  1. Pre-Start Preparations
  2. Mobilisation & Site Set-Up
  3. Services Detection/Isolation & Permits (as relevant)
  4. Access & Protection
  5. Task Execution (core method steps specific to "${task}")
  6. Quality Control / Tolerances / Hold Points
  7. Waste Management & Housekeeping
  8. Handover and Clean-Up (this MUST be the final stage)
- Under each stage, include 3–6 concise, actionable bullets, each beginning with "- ".
- Be specific: include practical details (sizes/ratios, tools, checks, curing/drying times, dust/noise controls).

CONTENT HINTS (adapt to "${task}"):
- RAMS briefing/induction, PPE checks, welfare, permits-to-work.
- Isolation/locating services; method statements/permits recorded.
- Access setup (tower/scaffold/MEWP), exclusion zones, protection of adjacent finishes.
- Execution details (how to do the task safely and to spec), temporary works if needed.
- Mortar/mix ratios or equivalent specifics if applicable; workmanship checks; QA/hold points.
- Segregate waste; silica/dust control (water suppression/M-class vac); housekeeping.
- Final inspection, snagging, sign-off, photo records, document handover.

End after stage "8. Handover and Clean-Up". Do NOT add any summary or extra text after the last bullet.
`.trim();

    // 2) PLANT & MATERIALS — task-focused, list-only
    const promptMat = `List the specific plant, tools, access equipment, consumables, and materials required to carry out ${task} on a construction site. Bullet list only (one item per line). No sentences, commentary, or descriptions.`;

    // 3) PPE — include protection levels + EN/BS standards (concise)
    const promptPpe = `
For the task "${task}", list the Personal Protective Equipment (PPE) required.
Each line must include both the protection level/type and the relevant EN/BS standard in brackets.
Bullet list only; concise. Output only the list.

Example (adjust to task):
- Safety boots (EN ISO 20345, S1P or SB-P)
- Safety helmet (EN 397)
- Safety glasses (EN 166, impact grade F)
- High-visibility clothing (EN ISO 20471, Class 2 or 3)
- Cut-resistant gloves (EN 388, cut level 5)
- Respiratory protection (FFP3, EN 149)
- Hearing protection (EN 352, SNR ≥ 30 dB)
- Fall arrest harness where required (EN 361)
- Protective overalls (EN 13034, Type 6)
`.trim();

    const [sRaw, mRaw, pRaw] = await Promise.all([
      ask(promptSeq, 2200),  // big budget for detailed sequence
      ask(promptMat, 700),
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
