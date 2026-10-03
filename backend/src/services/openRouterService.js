const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

// Sends the conversation so far to OpenRouter and returns the AI's reply text
const askOpenRouter = async (messages) => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set in backend/.env');
  }

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'SyncDoc'
    },
    body: JSON.stringify({ model: MODEL, messages })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('OpenRouter returned an empty response');
  }
  return reply;
};

module.exports = { askOpenRouter };