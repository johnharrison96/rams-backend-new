// ✅ Backend for RAMS Generator — professional, detailed, and stable
// Extended timeout for full responses
export const config = { maxDuration: 60 };

import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { task } = req.body || {};
    if (!task || typeof task !== "string") {
      return res.status(400).json({ error: "Missing or invalid task" });
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("Missing OPENAI_API_KEY");
    }

    // 🧱 Prompts
    const promptSeq = `Create a detailed and professional sequence of works for ${task}, written in the same style as a full RAMS document. Use numbered sections and bullet points under each stage.`;
    const promptMat = `Create a basic bullet-point list of plant and materials required for ${task}. Keep it simple — just the item names, no descriptions or comments.`;
    const promptPpe = `Create a list of Personal Protective Equipment (PPE) for ${task}, keeping it clear, concise, and operative-friendly. No UK standard codes needed.`;

    const model = "gpt-4o";
    const temperature = 0.2;

    const ask = (content, max_tokens) =>
      client.chat.completions.create({
        model,
        messages: [{ role: "user", content }],
        temperature,
        max_tokens,
      }).then(r => r.choices?.[0]?.message?.content?.trim() ?? "");

    // Run all prompts together
    const [sequenceOfWorks, plantAndMaterials, ppe] = await Promise.all([
      ask(promptSeq, 2200),
      ask(promptMat, 600),
      ask(promptPpe, 900),
    ]);

    return res.status(200).json({ sequenceOfWorks, plantAndMaterials, ppe });
  } catch (err) {
    console.error("OpenAI API error:", err);
    return res.status(500).json({
      error: "Failed to generate content",
      details: err?.message || "Unknown error",
    });
  }
}
