import { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ messages, onSend }) {
  const [text, setText] = useState('');
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (text.trim()) {
      onSend(text);
      setText('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <i className="fas fa-comments me-2"></i>
        Chat
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="text-muted text-center mt-4" style={{ fontSize: '0.85rem' }}>
            No messages yet
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className="chat-message">
            <div className="chat-message-header">
              <strong>{msg.userName}</strong>
              <span className="chat-time">{msg.time}</span>
            </div>
            <div className="chat-message-body">{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button type="submit" title="Send">
          <i className="fas fa-paper-plane"></i>
        </button>
      </form>
    </div>
  );
}
