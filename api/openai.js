// Allow longer processing for more detailed responses
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

    // 1️⃣ Sequence of Works
    const promptSeq = `${task} sequence of works — create a detailed, step-by-step sequence with numbered stages and clear bullet points under each stage. Write it as if for a professional RAMS document.`;

    // 2️⃣ Plant & Materials (cleaner and task-focused)
    const promptMat = `List the specific plant, tools, access equipment, and materials required to carry out ${task} on a construction site. Use a simple bullet-point list only. No sentences, commentary, or extra descriptions.`;

    // 3️⃣ PPE (legally compliant with EN standards and protection levels)
    const promptPpe = `
For the task "${task}", list the Personal Protective Equipment (PPE) required.
Each item must include both the protection level/type and the relevant EN or BS standard.
Keep it concise and formatted as a bullet-point list suitable for RAMS submission.
Example format:
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
      try {
        return await run();
      } catch (e1) {
        await new Promise(r => setTimeout(r, 600)); // small retry delay
        return await run();
      }
    };

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
