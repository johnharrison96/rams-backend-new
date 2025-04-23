export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt in request body' });
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Project': process.env.OPENAI_PROJECT_ID, // Optional if not using sk-proj key
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert at generating detailed and professional RAMS responses for construction tasks.',
          },
          {
            role: 'user',
            content: prompt,
          }
        ],
        temperature: 0.5,
      }),
    });

    const data = await openaiRes.json();

    if (!data.choices || !data.choices[0]) {
      throw new Error('No choices returned from OpenAI');
    }

    const response = data.choices[0].message.content.trim();

    res.status(200).json({ response });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ error: 'Failed to generate RAMS' });
  }
}
