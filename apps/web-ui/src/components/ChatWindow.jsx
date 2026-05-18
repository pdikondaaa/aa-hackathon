import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import MessageBubble from './MessageBubble';
import { createConversation, postMessage, listMessages, getConversationFeedback, draftEmailFromChat } from '../services/api';

const THINKING_PHRASES = [
  'Searching the knowledge base...',
  'Reading through documents...',
  'Cross-referencing sources...',
  'Scanning relevant policies...',
  'Connecting the dots...',
  'Consulting the archives...',
  'Gathering insights...',
  'Analysing your question...',
  'Formulating a response...',
  'Checking every corner...',
  'Sifting through records...',
  'Piecing it all together...',
];

const EMAIL_INTENT_PATTERNS = [
  /\b(send|write|compose|draft)\s+(an?\s+)?email\b/i,
  /\b(feeling|feeling\s+a\s+bit)\s+(unwell|sick|ill|not\s+well|under\s+the\s+weather)\b/i,
  /\bsick\s+(leave|day|note)\b/i,
  /\b(want\s+to|need\s+to|like\s+to)\s+(take|apply\s+for)\s+(leave|a\s+day\s+off|time\s+off)\b/i,
  /\b(install|installation\s+of|set\s+up|setup)\s+\w/i,
  /\b(need|require|request)\s+(access|permission)\b/i,
  /\b(request\s+for|requesting)\s+(access|permission|software|install)\b/i,
  /\bIT\s+(help|support|issue|ticket|problem|request)\b/i,
  /\b(laptop|computer|machine|PC|desktop)\s+(issue|problem|not\s+working|broken|crashed)\b/i,
  /\b(help|support)\s+(with|for)\s+(my\s+)?(laptop|computer|PC)\b/i,
];

const detectEmailIntent = (text) =>
  EMAIL_INTENT_PATTERNS.some((re) => re.test(text));

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

const getGreeting = (firstName) => {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return `Good Morning, ${firstName}! ☀️`;
  if (h >= 12 && h < 17) return `Good Afternoon, ${firstName}! 🌤️`;
  return `Good Evening, ${firstName}! 🌆`;
};

const ChatWindow = ({ config, user: authUser, compact = false, onOpenEscalation, selectedConversationId, onConversationUpdated, injectedMessage, onInjectedMessageSent }) => {
  const { messages: initialMessages, suggestions, labels, featureCards } = config;
  const user = authUser || config.user;
  const firstName = (user?.name || '').split(' ')[0] || 'there';

  const [messages, setMessages]       = useState(initialMessages);
  const [input, setInput]             = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const bottomRef      = useRef(null);
  const textareaRef    = useRef(null);
  const fileInputRef   = useRef(null);
  const recognitionRef = useRef(null);
  const voiceBaseRef   = useRef('');
  const abortCtrlRef   = useRef(null);
  const [loading, setLoading]           = useState(false);
  const [historyLoading, setHistoryLoading] = useState(!!selectedConversationId);
  const [historyError, setHistoryError]   = useState(false);
  const [thinkingIndex, setThinkingIndex] = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);

  useEffect(() => {
    if (!messages.length) return;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!injectedMessage) return;
    sendMessage(injectedMessage);
    onInjectedMessageSent?.();
  }, [injectedMessage]);

  // Runs synchronously before the browser paints — prevents any blank/welcome flash
  useLayoutEffect(() => {
    if (!selectedConversationId) return;
    setHistoryLoading(true);
    setHistoryError(false);
    setMessages([]);
    setConversationId(null);
  }, [selectedConversationId]);

  // Async data fetch — runs after paint (spinner already visible from useLayoutEffect)
  useEffect(() => {
    if (!selectedConversationId) return;
    let cancelled = false;
    (async () => {
      try {
        const [msgRes, fbRes] = await Promise.all([
          listMessages(selectedConversationId),
          getConversationFeedback(selectedConversationId).catch(() => ({})),
        ]);
        if (cancelled) return;
        const feedbackMap = fbRes || {};
        const msgs = (msgRes.data || []).map((m, i) => ({
          id: i + 1,
          backendId: m.id,
          conversationId: selectedConversationId,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          initialFeedback: feedbackMap[m.id] ?? null,
        }));
        setMessages(msgs);
        setConversationId(selectedConversationId);
      } catch (e) {
        console.error('Failed to load conversation:', e);
        if (!cancelled) setHistoryError(true);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedConversationId]);

  useEffect(() => {
    if (!loading) {
      setThinkingIndex(0);
      setPhraseVisible(true);
      return;
    }
    setPhraseVisible(true);
    let timeout;
    const interval = setInterval(() => {
      setPhraseVisible(false);
      timeout = setTimeout(() => {
        setThinkingIndex(prev => (prev + 1) % THINKING_PHRASES.length);
        setPhraseVisible(true);
      }, 300);
    }, 2200);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [loading]);

  const handleInput = (e) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    const minH = parseInt(getComputedStyle(el).minHeight, 10) || 50;
    el.style.height = `${Math.min(Math.max(el.scrollHeight, minH), 160)}px`;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024)       return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter(f => f.size <= 20 * 1024 * 1024);
    setAttachments(prev => [...prev, ...valid]);
    e.target.value = '';
  };

  const removeAttachment = (idx) =>
    setAttachments(prev => prev.filter((_, i) => i !== idx));

  const sendMessage = async (text = input) => {
    const trimmed = (typeof text === 'string' ? text : input).trim();
    if (!trimmed && !attachments.length) return;
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const nextId = messages.length + 1;
    const fileList = attachments.map(f => `📎 ${f.name} (${formatFileSize(f.size)})`).join('\n');
    const userContent = [trimmed, fileList].filter(Boolean).join('\n\n');
    setMessages(prev => [
      ...prev,
      { id: nextId, role: 'user', content: userContent, timestamp: now },
    ]);

    setInput('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setLoading(true);
    const abortCtrl = new AbortController();
    abortCtrlRef.current = abortCtrl;

    const isEmailRequest = detectEmailIntent(trimmed);

    try {
      // Create a conversation on the first message of a new chat session
      let convId = conversationId;
      if (!convId) {
        const conversation = await createConversation(trimmed.slice(0, 80));
        convId = conversation.id;
        setConversationId(convId);
      }

      // Fire both requests in parallel when an email intent is detected
      const chatPromise = postMessage(convId, trimmed, abortCtrl.signal);
      const emailPromise = isEmailRequest ? draftEmailFromChat(trimmed).catch(() => null) : Promise.resolve(null);

      const [msgResponse, emailDraft] = await Promise.all([chatPromise, emailPromise]);

      const newMsgs = [
        {
          id: nextId + 1,
          backendId: msgResponse.id,
          conversationId: convId,
          role: 'assistant',
          content: msgResponse.content,
          sources: [],
          timestamp: now,
        },
      ];

      if (emailDraft) {
        newMsgs.push({
          id: nextId + 2,
          role: 'assistant',
          content: '',
          emailDraft: {
            to: emailDraft.to || '',
            subject: emailDraft.refined_subject || '',
            body: emailDraft.refined_body || '',
          },
          timestamp: now,
        });
      }

      setMessages(prev => [...prev, ...newMsgs]);
      onConversationUpdated?.();
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Error sending message:', error);
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
      abortCtrlRef.current = null;
      setLoading(false);
    }
  };

  const handleStop = () => {
    abortCtrlRef.current?.abort();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && loading) {
      handleStop();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !loading) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleSuggestion = (text) => {
    setInput(text);
    textareaRef.current?.focus();
  };

  const handleCardClick = (card) => {
    const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    setMessages([{ id: 1, role: 'assistant', content: card.intro, timestamp: now }]);
    textareaRef.current?.focus();
  };

  const toggleVoice = () => {
    if (!SpeechRecognition) return;

    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous      = false;
    recognition.interimResults  = true;
    recognition.lang            = 'en-US';
    recognitionRef.current      = recognition;
    voiceBaseRef.current        = input;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (e) => {
      let interim = '';
      let final   = '';
      for (const result of e.results) {
        if (result.isFinal) final   += result[0].transcript;
        else                interim += result[0].transcript;
      }
      setInput(voiceBaseRef.current + (final || interim));
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        const minH = parseInt(getComputedStyle(textareaRef.current).minHeight, 10) || 50;
        textareaRef.current.style.height =
          `${Math.min(Math.max(textareaRef.current.scrollHeight, minH), 160)}px`;
      }
    };

    recognition.onend  = () => { setIsListening(false); textareaRef.current?.focus(); };
    recognition.onerror = () => setIsListening(false);

    recognition.start();
  };

  // Expose for parent (history sidebar clicks)
  ChatWindow.setSuggestion = handleSuggestion;

  const showWelcome = messages.length === 0 && !compact && !historyLoading && !historyError && !conversationId;

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
                    onClick={() => handleCardClick(card)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCardClick(card)}>
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

        ) : historyLoading ? (

          /* ── Loading history ─────────────────────────────── */
          <div className="chat-history-loading">
            <i className="fas fa-spinner fa-spin" />
            <span>Loading conversation...</span>
          </div>

        ) : historyError ? (

          /* ── Load error ──────────────────────────────────── */
          <div className="chat-history-loading">
            <i className="fas fa-exclamation-circle" style={{ color: 'var(--error)' }} />
            <span>Failed to load conversation. Please try again.</span>
          </div>

        ) : (

          /* ── Message list ────────────────────────────────── */
          <div className="messages-list">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                config={config}
                user={user}
                conversationId={conversationId}
                onOpenEscalation={onOpenEscalation}
              />
            ))}

            {/* Thinking bubble — shown while awaiting API response */}
            {loading && (
              <div className="message-wrap assistant" aria-live="polite" aria-label="AURA is thinking">
                <div className="avatar assistant-avatar" aria-hidden="true">A</div>
                <div className="message-body">
                  <div className="bubble bubble-assistant thinking-bubble">
                    <div className="thinking-dots" aria-hidden="true">
                      <span /><span /><span />
                    </div>
                    <span className={`thinking-phrase${phraseVisible ? ' visible' : ''}`}>
                      {THINKING_PHRASES[thinkingIndex]}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar — always pinned at bottom ───────────── */}
      <div className="chat-input-area">
        <div className="chat-input-wrap">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          {/* Attachment preview chips */}
          {attachments.length > 0 && (
            <div className="attachment-preview">
              {attachments.map((file, idx) => (
                <div key={idx} className="attachment-chip">
                  <i className="fas fa-file attachment-chip-icon" />
                  <span className="attachment-chip-name" title={file.name}>{file.name}</span>
                  <span className="attachment-chip-size">{formatFileSize(file.size)}</span>
                  <button
                    className="attachment-remove"
                    onClick={() => removeAttachment(idx)}
                    aria-label={`Remove ${file.name}`}
                  >×</button>
                </div>
              ))}
            </div>
          )}

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
              <button
                className="chat-input-icon-btn"
                title="Attach file"
                aria-label="Attach file"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="fas fa-paperclip" />
              </button>
              {/* <button className="chat-input-icon-btn" title="Search" aria-label="Search">
                <i className="fas fa-search" />
              </button> */}
              {SpeechRecognition && (
                <button
                  className={`chat-input-icon-btn mic-btn${isListening ? ' mic-btn--listening' : ''}`}
                  onClick={toggleVoice}
                  title={isListening ? 'Stop recording' : 'Voice input'}
                  aria-label={isListening ? 'Stop voice recording' : 'Start voice input'}
                  aria-pressed={isListening}
                >
                  <i className={isListening ? 'fas fa-stop' : 'fas fa-microphone'} />
                </button>
              )}
            </div>
            <div className="chat-input-right">
              <span className="chat-input-hint">Shift+Enter for new line</span>
              {loading ? (
                <button
                  className="send-btn stop-btn"
                  onClick={handleStop}
                  aria-label="Stop response"
                  title="Stop (Esc)"
                >
                  <i className="fas fa-stop" />
                </button>
              ) : (
                <button
                  className="send-btn"
                  onClick={() => sendMessage()}
                  disabled={!input.trim() && !attachments.length}
                  aria-label="Send message"
                  title="Send (Enter)"
                >
                  <i className="fas fa-paper-plane" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ChatWindow;
