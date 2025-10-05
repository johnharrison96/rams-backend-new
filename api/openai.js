// RAMS Generator Backend — chat-like results, clean formatting
// Allow longer processing window on Vercel Pro
export const config = { maxDuration: 60 };

import OpenAI from "openai";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---- Helpers ----

// Clean up ChatGPT-style markdown into plain text for the Sequence of Works
function cleanSequence(txt = "") {
  return (txt || "")
    // remove chatty openers
    .replace(/^\s*(certainly|sure|of course)[!.,\s-]*\n+/i, "")
    // drop markdown headings like "### 1. Title"
    .replace(/^#{1,6}\s*/gm, "")
    // remove bold/underline/strike markers
    .replace(/\*\*/g, "").replace(/__|~~/g, "")
    // normalise bullets if the model used "* "
    .replace(/^[ \t]*\*\s/gm, "- ")
    // collapse excessive blank lines
    .replace(/\r/g, "").replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Small wrapper for a chat completion with one retry
async function askChat({ prompt, maxTokens }) {
  const run = () =>
    client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are ChatGPT, a professional construction assistant. Produce detailed, clear RAMS content with numbered stages and bullet points, similar to ChatGPT responses.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      top_p: 1,
      max_tokens: maxTokens,
    });

  try {
    const r = await run();
    return r.choices?.[0]?.message?.content?.trim() ?? "";
  } catch (e) {
    // brief backoff and retry once
    await new Promise((r) => setTimeout(r, 500));
    const r2 = await run();
    return r2.choices?.[0]?.message?.content?.trim() ?? "";
  }
}

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

    // Prompts — keep SoW like chat; keep P&M basic; PPE operative-friendly
    const seqPrompt = `${task} sequence of works`;
    const matPrompt = `Create a basic bullet-point list of plant and materials required for ${task}. Keep it simple — just the item names, no descriptions or comments.`;
    const ppePrompt = `Create a clear, operative-friendly list of Personal Protective Equipment (PPE) required for ${task}. Keep it concise and practical. Do not include UK/EN standard codes.`;

    // Run in parallel
    const [seqRaw, matRaw, ppeRaw] = await Promise.all([
      askChat({ prompt: seqPrompt, maxTokens: 2200 }),
      askChat({ prompt: matPrompt, maxTokens: 600 }),
      askChat({ prompt: ppePrompt, maxTokens: 900 }),
    ]);

    // Clean only the sequence formatting; leave lists as generated
    const sequenceOfWorks = cleanSequence(seqRaw);
    const plantAndMaterials = (matRaw || "").trim();
    const ppe = (ppeRaw || "").trim();

    return res.status(200).json({ sequenceOfWorks, plantAndMaterials, ppe });
  } catch (err) {
    console.error("API error:", err);
    return res
      .status(500)
      .json({ error: "Failed to generate RAMS", details: err?.message || "Unknown error" });
  }
}
