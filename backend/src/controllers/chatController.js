const { askOpenRouter } = require('../services/openRouterService');

const SYSTEM_PROMPT = 'You are a helpful assistant inside a document editor called SyncDoc. Keep answers clear and reasonably concise.';

// POST /api/chat — standalone Q&A, does not touch the document content
const askChatbot = async (req, res) => {
  try {
    const { message, history } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'A message is required' });
    }

    // Keep only the last 10 valid turns, to bound how much context is sent each time
    const safeHistory = Array.isArray(history)
      ? history
          .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }))
      : [];

    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...safeHistory,
      { role: 'user', content: message.trim() }
    ];

    const reply = await askOpenRouter(messages);

    return res.status(200).json({ success: true, data: { reply } });
  } catch (error) {
    console.error('Chatbot error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'The chatbot could not respond right now. Please try again.'
    });
  }
};

module.exports = { askChatbot };