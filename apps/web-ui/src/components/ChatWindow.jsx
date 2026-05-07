import React, { useState, useRef, useEffect } from 'react';
import MessageBubble from './MessageBubble';
import { askBot } from '../services/api';

const getGreeting = (firstName) => {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return `Good Morning, ${firstName}! ☀️`;
  if (h >= 12 && h < 17) return `Good Afternoon, ${firstName}! 🌤️`;
  return `Good Evening, ${firstName}! 🌆`;
};

const ChatWindow = ({ config, user: authUser }) => {
  const { messages: initialMessages, suggestions, labels, featureCards } = config;
  const user = authUser || config.user;
  const firstName = (user?.name || '').split(' ')[0] || 'there';

  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!messages.length) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleInput = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    const minH = parseInt(getComputedStyle(el).minHeight, 10) || 50;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), 160)}px`;
  };

  const sendMessage = async (text = input) => {
    const trimmed = (typeof text === 'string' ? text : input).trim();
    if (!trimmed || loading) return;

    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const nextId = messages.length + 1;

    // Add user message
    setMessages(prev => [
      ...prev,
      { id: nextId, role: 'user', content: trimmed, timestamp: now },
    ]);

    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setLoading(true);

    try {
      // Call authenticated API
      const response = await askBot(trimmed);
      
      // Add assistant response
      setMessages(prev => [
        ...prev,
        {
          id: nextId + 1,
          role: 'assistant',
          content: response.answer,
          timestamp: now,
          metadata: {
            user_email: response.user_email,
            user_id: response.user_id,
          },
        },
      ]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      setMessages(prev => [
        ...prev,
        {
          id: nextId + 1,
          role: 'assistant',
          content: `⚠️ Error: ${error.message || 'Failed to get response. Please try again.'}`,
          timestamp: now,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestion = (text) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  // Expose for parent (history sidebar clicks)
  ChatWindow.setSuggestion = handleSuggestion;

  const showWelcome = messages.length === 0;

  return (
    <div className="chat-window">

      {/* ── Scrollable content area ───────────────────────── */}
      <div className="chat-scroll-area">
        {showWelcome ? (

          /* ── Welcome screen ─────────────────────────────── */
          <div className="chat-welcome">
            <div className="welcome-glow"       aria-hidden="true" />
            <div className="welcome-glow welcome-glow-green" aria-hidden="true" />

            <h2 className="welcome-title">{getGreeting(firstName)}</h2>
            <p  className="welcome-headline">{labels.welcomeSubtitle}</p>

          
            {/* Feature cards */}
            <div className="feature-cards-section">
              <h3 className="feature-cards-heading">{labels.kickstartHeading}</h3>
              <div className="feature-cards-grid">
                {featureCards.map((card) => (
                  <div key={card.id} className="feature-card"
                    role="button" tabIndex={0}
                    onClick={() => handleSuggestion(`Tell me about ${card.title}`)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSuggestion(`Tell me about ${card.title}`)}>
                    <div className="feature-card-icon"
                      style={{ color: card.color, background: `${card.color}20` }}>
                      <i className={`fas ${card.icon}`} />
                    </div>
                    <div className="feature-card-body">
                      <h4>{card.title}</h4>
                      <p>{card.description}</p>
                    </div>
                    <span className="feature-card-link">{labels.learnMore}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Suggestion chips */}
            <div className="suggestion-chips" role="list">
              {suggestions.map((s, i) => (
                <button key={i} className="suggestion-chip" role="listitem"
                  onClick={() => handleSuggestion(s)}>
                  {s}
                </button>
              ))}
            </div>

          </div>

        ) : (

          /* ── Message list ────────────────────────────────── */
          <div className="messages-list">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} config={config} />
            ))}
          </div>

        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar — always pinned at bottom ───────────── */}
      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder={labels.inputPlaceholder}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            aria-label="Message input"
          />
          <div className="chat-input-footer">
            <div className="chat-input-left">
              <button className="chat-input-icon-btn" title="Attach" aria-label="Attach file">
                <i className="fas fa-paperclip" />
              </button>
              <button className="chat-input-icon-btn" title="Search" aria-label="Search">
                <i className="fas fa-search" />
              </button>
            </div>
            <div className="chat-input-right">
              <span className="chat-input-hint">Shift+Enter for new line</span>
              <button
                className="send-btn"
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                aria-label="Send message"
                title="Send (Enter)"
              >
                {loading ? (
                  <i className="fas fa-spinner fa-spin" />
                ) : (
                  <i className="fas fa-paper-plane" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ChatWindow;
