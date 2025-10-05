// ✅ Optimised for Vercel Pro — longer runtime + robust + parallel
// - Runs 3 detailed prompts in parallel (Sequence, Plant & Materials, PPE)
// - Keeps "Plant & Materials" as a basic bullet list (no comments)
// - Adds retries + per-call token limits
// - Uses Pro plan's longer function window via maxDuration

export const config = { maxDuration: 60 };

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    const { task } = req.body || {};
    if (!task || typeof task !== "string") {
      return res.status(400).json({ error: "Missing or invalid task" });
    }

    const model = "gpt-4o";     // Fast + high quality on Pro
    const temperature = 0;       // Consistent, “ChatGPT-like” tone
    const seed = 42;             // Improves repeatability

    // --- Prompts (tailored to your spec) ---
    const promptSequence = `
Create a UK construction RAMS **Sequence of Works** for: "${task}".
- Detailed, practical, site-ready.
- Use numbered stages with short bullet points beneath each stage.
- Cover prep/set-up, execution, QA, cleanup/handover.
- Keep jargon minimal; be specific and actionable.
`.trim();

    const promptMaterials = `
For: "${task}" — Provide a **basic bullet-point list** of all **Plant, Tools & Materials** required.
- **No comments**, **no descriptions**, **no sentences**.
- One item per line. Keep it clean and concise.
`.trim();

    const promptPPE = `
For: "${task}" — Provide **Personal Protection Equipment (PPE)** for UK construction.
- Bullet list with relevant EN/BS standards where appropriate.
- Include task-specific notes (e.g., dust/silica, noise/HAVS, eye/face, respiratory).
- Clear and practical for site use.
`.trim();

    // --- Helper: single call with retry ---
    const make = async (content, max_tokens = 900) => {
      const attempt = async () => {
        const r = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: "You write practical, UK-compliant RAMS content." },
            { role: "user", content }
          ],
          temperature,
          max_tokens,
          seed,
        });
        return r.choices?.[0]?.message?.content ?? "";
      };

      // simple retry (x2) for transient errors
      try {
        return await attempt();
      } catch (e1) {
        await new Promise(r => setTimeout(r, 600)); // backoff
        try {
          return await attempt();
        } catch (e2) {
          // surface the original error message to logs
          console.error("OpenAI call failed:", e2?.message || e2);
          throw e2;
        }
      }
    };

    // Run all three in parallel with per-call token budgets
    const [sequence, plantAndMaterials, ppe] = await Promise.all([
      make(promptSequence, 1300),  // more room for detail
      make(promptMaterials, 500),  // short, list-only
      make(promptPPE, 900),        // detailed but concise
    ]);

    return res.status(200).json({
      sequenceOfWorks: sequence,
      plantAndMaterials,
      ppe,
    });

  } catch (err) {
    console.error("API error:", err);
    return res.status(500).json({
      error: "Failed to generate RAMS",
      details: err?.message || "Unknown error",
    });
  }
}
