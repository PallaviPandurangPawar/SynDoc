// Standalone reference chatbot — side panel inside the document editor.
// Answers are not inserted into the document; the copy icon only copies the answer text.
import { useRef, useState } from 'react';
import { askChatbot } from '../../services/api';

export default function ChatPanel() {
  const [messages, setMessages] = useState([]); // { role: 'user' | 'assistant', content }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const listRef = useRef(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  const sendMessage = async (textOverride, replaceFromIndex) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;

    const baseMessages = replaceFromIndex !== undefined
      ? messages.slice(0, replaceFromIndex)
      : [...messages, { role: 'user', content: text }];

    // The question itself is always the last item in baseMessages — drop it here,
    // since the backend adds the current question back in separately.
    const historyForApi = baseMessages.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

    setMessages(baseMessages);
    if (replaceFromIndex === undefined) setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const res = await askChatbot({ message: text, history: historyForApi });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.data.reply }]);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Something went wrong. Please try again.';
      setMessages((prev) => [...prev, { role: 'assistant', content: msg, isError: true }]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleRegenerate = (assistantIndex) => {
    const userMsg = messages[assistantIndex - 1];
    if (!userMsg || userMsg.role !== 'user') return;
    sendMessage(userMsg.content, assistantIndex);
  };

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput('');
  };

  return (
    <aside className="chat-panel">
      <div className="chat-messages" ref={listRef}>
        {messages.length === 0 && (
          <p className="chat-empty-hint">Ask me anything — answers here won't change your document.</p>
        )}

        {messages.map((m, index) => (
          m.role === 'user' ? (
            <div key={index} className="chat-bubble-user">{m.content}</div>
          ) : (
            <div key={index} className={`chat-bubble-assistant${m.isError ? ' error' : ''}`}>
              <p className="chat-answer-text">{m.content}</p>
              {!m.isError && (
                <div className="chat-answer-actions">
                  <button
                    type="button"
                    className="chat-icon-btn"
                    onClick={() => handleCopy(m.content, index)}
                    title="Copy answer"
                    aria-label="Copy answer"
                  >
                    {copiedIndex === index ? (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2"></rect>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    className="chat-icon-btn"
                    onClick={() => handleRegenerate(index)}
                    disabled={loading}
                    title="Regenerate answer"
                    aria-label="Regenerate answer"
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )
        ))}

        {loading && <div className="chat-bubble-assistant chat-typing">Thinking...</div>}
      </div>

      <div className="chat-input-row">
        <input
          type="text"
          className="chat-input"
          placeholder="Ask me anything..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
          disabled={loading}
        />
      </div>
      <div className="chat-action-row">
        <button type="button" className="chat-search-btn" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
          Search
        </button>
        <button type="button" className="chat-new-btn" onClick={handleNewChat} title="Clear chat" aria-label="Clear chat">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
            <path d="M10 11v6"></path>
            <path d="M14 11v6"></path>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
          </svg>
        </button>
      </div>
    </aside>
  );
}