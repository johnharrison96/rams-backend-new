// ✅ RAMS Generator Backend (ChatGPT-style results)
// Extended timeout for full detailed responses
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

    // Prompts
    const promptSeq = `${task} sequence of works`;
    const promptMat = `Create a basic bullet-point list of plant and materials required for ${task}. Keep it simple — just the item names, no descriptions or comments.`;
    const promptPpe = `Create a list of Personal Protective Equipment (PPE) for ${task}, keeping it clear, concise, and operative-friendly. No UK standard codes needed.`;

    const model = "gpt-4o"; // same family as ChatGPT-5 style
    const temperature = 0.2;

    // Helper function
    const ask = (prompt, max_tokens) =>
      client.chat.completions
        .create({
          model,
          messages: [
            {
              role: "system",
              content:
                "You are ChatGPT, a professional construction assistant. Always produce detailed, clear, and well-structured RAMS content using numbered stages and bullet points — just as ChatGPT does in chat.",
            },
            { role: "user", content: prompt },
          ],
          temperature,
          max_tokens,
        })
        .then((r) => r.choices?.[0]?.message?.content?.trim() ?? "");

    // Run all three prompts in parallel
    const [sequenceOfWorks, plantAndMaterials, ppe] = await Promise.all([
      ask(promptSeq, 2200),
      ask(promptMat, 600),
      ask(promptPpe, 900),
    ]);

    return res.status(200).json({ sequenceOfWorks, plantAndMaterials, ppe });
  } catch (err) {
    console.error("OpenAI API error:", err);
    return res.status(500).json({
      error: "Failed to generate RAMS",
      details: err?.message || "Unknown error",
    });
  }
}
