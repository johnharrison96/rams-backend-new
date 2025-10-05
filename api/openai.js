// RAMS Backend — Clean formatting, bold subheadings, no redundant headers
export const config = { maxDuration: 60 };

import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Clean sequence: remove markdown, bold main headings, trim spacing
function cleanSequence(txt = "") {
  return (txt || "")
    // remove the first line like "Brick Replacement Sequence of Works"
    .replace(/^.*sequence of works.*$/im, "")
    // remove markdown and formatting symbols
    .replace(/^\s*#+\s*/gm, "")
    .replace(/\*\*/g, "")
    // bold the numbered section headings (1., 2., etc.)
    .replace(/^(\d+\.\s*[A-Z].*?):/gm, (_, g1) => `**${g1}:**`)
    // bold numbered subheadings (1.1, 1.2, etc.)
    .replace(/^(\s*-\s*\d+\.\d+\s*[A-Z].*?):/gm, (_, g1) => `**${g1}:**`)
    // remove double newlines
    .replace(/\n{2,}/g, "\n")
    // clean leading/trailing whitespace
    .trim();
}

// Chat wrapper with retry
async function askChat({ prompt, maxTokens }) {
  const run = () =>
    client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You are ChatGPT, a professional construction RAMS writer. Write detailed, clearly structured 'Sequence of Works' documents using bold section headings and dash bullets.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
    });

  try {
    const r = await run();
    return r.choices?.[0]?.message?.content?.trim() ?? "";
  } catch {
    const r2 = await run();
    return r2.choices?.[0]?.message?.content?.trim() ?? "";
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");

    const { task } = req.body || {};
    if (!task) return res.status(400).json({ error: "Missing task" });

    const seqPrompt = `${task} sequence of works for a professional RAMS document. Use numbered stages with dash bullets under each stage.`;
    const matPrompt = `Create a basic bullet-point list of plant and materials required for ${task}. Keep it simple — item names only, no comments.`;
    const ppePrompt = `Create an operative-friendly list of Personal Protective Equipment (PPE) for ${task}. Do not include UK standard codes.`;

    const [seqRaw, matRaw, ppeRaw] = await Promise.all([
      askChat({ prompt: seqPrompt, maxTokens: 2200 }),
      askChat({ prompt: matPrompt, maxTokens: 600 }),
      askChat({ prompt: ppePrompt, maxTokens: 900 }),
    ]);

    const sequenceOfWorks = cleanSequence(seqRaw);
    const plantAndMaterials = (matRaw || "").trim();
    const ppe = (ppeRaw || "").trim();

    res.status(200).json({ sequenceOfWorks, plantAndMaterials, ppe });
  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: err?.message || "Unknown error" });
  }
}
