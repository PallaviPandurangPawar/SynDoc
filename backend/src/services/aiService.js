const AI_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

// Sends the conversation so far to the AI API and returns the reply text
const askAI = async (messages) => {
  if (!process.env.API_KEY) {
    throw new Error('API_KEY is not set in backend/.env');
  }

  const response = await fetch(AI_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'SyncDoc'
    },
    body: JSON.stringify({ model: MODEL, messages })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI request failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) {
    throw new Error('AI returned an empty response');
  }
  return reply;
};

module.exports = { askAI };