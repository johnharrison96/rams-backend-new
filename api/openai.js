import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { task } = req.body || {};
    if (!task || typeof task !== "string") {
      return res.status(400).json({ error: "Missing or invalid task" });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const model = "gpt-4o";
    const temperature = 0;
    const max_tokens = 1000;

    // Custom prompts for each section
    const prompts = [
      // Sequence of Works (detailed, practical)
      `${task} sequence of works — Write a clear, step-by-step, UK construction RAMS sequence of works. Include preparation, execution, quality checks, and completion. Keep it detailed and practical.`,

      // Plant and Materials (basic list only, no commentary)
      `${task} plant and materials — Provide a simple bullet-point list of all plant, tools, and materials required. No comments, no descriptions, no sentences. Just a clean list.`,

      // PPE (standard)
      `${task} personal protection equipment (PPE) — Write a UK-compliant PPE list with relevant EN/BS standards where appropriate. Keep it clear and practical.`,
    ];

    // Run all three prompts in parallel
    const [sequenceRes, materialsRes, ppeRes] = await Promise.all(
      prompts.map(prompt =>
        client.chat.completions.create({
          model,
          messages: [{ role: "user", content: prompt }],
          temperature,
          max_tokens,
          seed: 42,
        })
      )
    );

    const response = {
      sequenceOfWorks: sequenceRes.choices?.[0]?.message?.content ?? "",
      plantAndMaterials: materialsRes.choices?.[0]?.message?.content ?? "",
      ppe: ppeRes.choices?.[0]?.message?.content ?? "",
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({
      error: "Failed to generate response",
      details: error.message,
    });
  }
}
