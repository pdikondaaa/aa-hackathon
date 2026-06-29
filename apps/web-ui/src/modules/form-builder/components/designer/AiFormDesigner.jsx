import React, { useState, useRef, useEffect, useCallback } from 'react';
import DynamicFormRenderer from '../renderer/DynamicFormRenderer';
import { aiFormChat } from '../../services/formBuilderApi';

// ── Temp ID generator ──────────────────────────────────────────────────────────
const _tid = () => `tmp_${Math.random().toString(36).slice(2, 9)}`;

// ── Welcome message ────────────────────────────────────────────────────────────
const WELCOME_MSG = {
  role: 'assistant',
  content: "Hi! I'm your AI form builder. Describe the form you want to create and I'll build it automatically.\n\nTry something like:\n• *\"Create an Employee Onboarding form with Name, Email, Department, and Joining Date\"*\n• *\"Add a mandatory Phone Number field after Email\"*\n• *\"Show the Laptop Details section only if 'Laptop Required' is Yes\"*\n• *\"Send an email to HR after form submission\"*",
  suggestions: [
    'Create a AI License Request form',
    'Client feedback / satisfaction survey',
    'Visitor/guest registration form',
    'Incident reporting (non-IT) form',
  ],
};

// ── Styles ─────────────────────────────────────────────────────────────────────
const s = {
  root: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },

  // Chat panel
  chat: {
    width: '52%',
    minWidth: 300,
    maxWidth: 660,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid var(--border)',
    background: 'var(--bg)',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '11px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  aiIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: 'linear-gradient(135deg, var(--primary) 0%, #7C3AED 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 13,
    flexShrink: 0,
  },
  chatHeaderTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2 },
  chatHeaderSub:   { fontSize: 11, color: 'var(--text-muted)', marginTop: 1 },
  manualBtn: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    borderRadius: 7,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },

  // Messages
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 16px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },

  // Input
  inputWrap: {
    padding: '10px 14px 12px',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '8px 10px 8px 12px',
    transition: 'border-color 0.15s',
  },
  textarea: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    fontSize: 13,
    color: 'var(--text)',
    resize: 'none',
    minHeight: 22,
    maxHeight: 120,
    lineHeight: 1.5,
    fontFamily: 'inherit',
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: 'none',
    background: 'var(--primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: 12,
    transition: 'opacity 0.15s, background 0.15s',
  },
  inputHint: {
    fontSize: 10,
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: 6,
    letterSpacing: '0.01em',
  },

  // Preview panel
  preview: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    background: 'var(--bg)',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '11px 16px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
  },
  previewTitle: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' },
  previewMeta:  { fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' },
  previewBody: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 20px 48px',
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

// Strip raw JSON / markdown code fences that a model may accidentally expose
function safeReply(text) {
  if (!text) return text;
  const stripped = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  if (stripped.startsWith('{')) {
    try {
      const parsed = JSON.parse(stripped);
      if (typeof parsed.reply === 'string') return parsed.reply;
    } catch {
      const m = stripped.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (m) return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    return 'I processed your request. Please check the form preview for the latest updates.';
  }
  return text;
}

function renderContent(text) {
  // Convert simple markdown-ish formatting to spans
  const parts = text.split(/(\*[^*]+\*|•)/g);
  return parts.map((part, i) => {
    if (part === '•') return <span key={i} style={{ color: 'var(--primary)' }}>•</span>;
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={i} style={{ color: 'var(--text)', fontStyle: 'normal', fontWeight: 500 }}>{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function UserBubble({ content }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <div style={{
        maxWidth: '78%',
        background: 'var(--primary)',
        color: '#fff',
        borderRadius: '14px 14px 4px 14px',
        padding: '10px 14px',
        fontSize: 13,
        lineHeight: 1.5,
        wordBreak: 'break-word',
      }}>
        {content}
      </div>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'rgba(29,118,188,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--primary)', fontSize: 12, flexShrink: 0,
      }}>
        <i className="fas fa-user" />
      </div>
    </div>
  );
}

function AiBubble({ msg, onSuggestion }) {
  const { content, suggestions = [], operationCount = 0, isError = false, followup = '', options = [] } = msg;

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: isError
          ? 'rgba(240,82,82,0.2)'
          : 'linear-gradient(135deg, var(--primary) 0%, #7C3AED 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isError ? 'var(--error)' : '#fff', fontSize: 11,
      }}>
        <i className={`fas ${isError ? 'fa-exclamation-circle' : 'fa-wand-magic-sparkles'}`} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Message bubble */}
        <div style={{
          background: isError ? 'rgba(240,82,82,0.08)' : 'var(--bg-secondary)',
          border: `1px solid ${isError ? 'rgba(240,82,82,0.25)' : 'var(--border)'}`,
          borderRadius: '4px 14px 14px 14px',
          padding: '10px 14px',
          fontSize: 13,
          color: isError ? 'var(--error)' : 'var(--text)',
          lineHeight: 1.6,
          wordBreak: 'break-word',
          whiteSpace: 'pre-wrap',
        }}>
          {renderContent(safeReply(content))}

          {/* Follow-up question inline */}
          {followup && (
            <div style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 7,
            }}>
              <i className="fas fa-circle-question" style={{ color: 'var(--primary)', fontSize: 11, marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{followup}</span>
            </div>
          )}
        </div>

        {/* Operations applied badge */}
        {operationCount > 0 && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            marginTop: 6, padding: '3px 9px',
            background: 'rgba(78,212,78,0.1)',
            border: '1px solid rgba(78,212,78,0.2)',
            borderRadius: 20,
            fontSize: 11, color: 'var(--success)', fontWeight: 600,
          }}>
            <i className="fas fa-check-circle" style={{ fontSize: 9 }} />
            {operationCount} change{operationCount > 1 ? 's' : ''} applied
          </div>
        )}

        {/* Human-in-the-loop option cards (shown when AI needs clarification) */}
        {options.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
              marginBottom: 7, display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <i className="fas fa-hand-pointer" style={{ fontSize: 9 }} />
              Choose one:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => onSuggestion(opt.message || opt.label)}
                  style={{
                    padding: '10px 13px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s, background 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'rgba(29,118,188,0.06)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)';
                    e.currentTarget.style.background = 'var(--bg-elevated)';
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(29,118,188,0.12)',
                      color: 'var(--primary)',
                      fontSize: 9, fontWeight: 800,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>{i + 1}</span>
                    {opt.label}
                  </div>
                  {opt.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 25 }}>{opt.description}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suggestion chips — hidden when option cards are shown */}
        {suggestions.length > 0 && options.length === 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => onSuggestion(s)}
                style={{
                  padding: '5px 11px',
                  borderRadius: 20,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text-secondary)',
                  fontSize: 11,
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--primary)';
                  e.currentTarget.style.color = 'var(--primary)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
        background: 'linear-gradient(135deg, var(--primary) 0%, #7C3AED 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 11,
      }}>
        <i className="fas fa-wand-magic-sparkles" />
      </div>
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '4px 14px 14px 14px',
        padding: '11px 16px',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {[0, 1, 2].map(i => (
          <span
            key={i}
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--primary)',
              display: 'inline-block',
              animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              opacity: 0.7,
            }}
          />
        ))}
        <style>{`
          @keyframes bounce {
            0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
            40% { transform: translateY(-5px); opacity: 1; }
          }
        `}</style>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>AI is thinking…</span>
      </div>
    </div>
  );
}

function EmptyPreview() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: 'var(--text-muted)', padding: 40, textAlign: 'center', gap: 12,
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: 16, marginBottom: 4,
        background: 'rgba(29,118,188,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--border)', fontSize: 26,
      }}>
        <i className="fas fa-file-pen" />
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)' }}>
        Form preview will appear here
      </div>
      <div style={{ fontSize: 12, maxWidth: 260, lineHeight: 1.6 }}>
        Describe your form in the chat — fields will appear here in real time as the AI builds it.
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AiFormDesigner({
  formId,
  formMeta,
  setFormMeta,
  fields,
  setFields,
  sections,
  setSections,
  onSwitchToManual,
  onSave,
  onPublish,
}) {
  const [messages, setMessages]           = useState([WELCOME_MSG]);
  const [history, setHistory]             = useState([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [publishing, setPublishing]       = useState(false);
  const messagesEndRef                    = useRef(null);
  const inputRef                          = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Apply AI-returned operations to form state
  const applyOperations = useCallback((operations) => {
    if (!Array.isArray(operations) || operations.length === 0) return;

    operations.forEach(op => {
      if (!op || !op.type || !op.data) return;
      const { type, data } = op;

      switch (type) {
        case 'set_form_meta': {
          const { name, description, category, icon, slug, alias } = data;
          setFormMeta(m => ({
            ...m,
            ...(name        !== undefined && { name }),
            ...(description !== undefined && { description }),
            ...(category    !== undefined && { category }),
            ...(icon        !== undefined && { icon }),
            ...(slug        !== undefined && { slug }),
            ...(alias       !== undefined && { alias }),
          }));
          break;
        }

        case 'add_field': {
          const newField = {
            id: _tid(),
            field_type:       data.field_type        || 'text',
            label:            data.label             || (data.field_type || 'Field'),
            name:             data.name              || `field_${Date.now()}`,
            placeholder:      data.placeholder       || '',
            help_text:        data.help_text         || '',
            default_value:    data.default_value     || '',
            required:         data.required          || false,
            read_only:        false,
            hidden:           false,
            order_index:      0,          // assigned below
            width:            data.width             || 'full',
            options:          data.options           || [],
            validation_rules: data.validation_rules  || {},
            conditional_logic: data.conditional_logic || [],
            formula:          data.formula           || '',
            style:            {},
            metadata:         {},
            section_id:       null,
            _isNew:           true,
          };
          setFields(prev => [
            ...prev,
            { ...newField, order_index: prev.length },
          ]);
          break;
        }

        case 'update_field': {
          const { name: fieldName, ...changes } = data;
          if (!fieldName) break;
          setFields(prev => prev.map(f =>
            f.name === fieldName ? { ...f, ...changes } : f
          ));
          break;
        }

        case 'remove_field': {
          const { name: fieldName } = data;
          if (!fieldName) break;
          setFields(prev =>
            prev
              .filter(f => f.name !== fieldName)
              .map((f, i) => ({ ...f, order_index: i }))
          );
          break;
        }

        case 'add_section': {
          const { title, description } = data;
          setSections(prev => [...prev, {
            id:          _tid(),
            title:       title       || 'Section',
            description: description || '',
            order_index: prev.length,
            collapsed:   false,
            conditions:  [],
            _isNew:      true,
          }]);
          break;
        }

        default:
          break;
      }
    });
  }, [setFormMeta, setFields, setSections]);

  // Send a message to the AI
  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || loading) return;

    setInput('');

    // Optimistically add user message
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setLoading(true);

    try {
      const currentForm = {
        name:        formMeta.name,
        description: formMeta.description,
        category:    formMeta.category,
        fields: fields.map(f => ({
          name:              f.name,
          field_type:        f.field_type,
          label:             f.label,
          required:          f.required,
          validation_rules:  f.validation_rules,
          conditional_logic: f.conditional_logic,
        })),
      };

      const result = await aiFormChat(trimmed, history, currentForm);

      if (result.operations?.length > 0) {
        applyOperations(result.operations);
      }

      const aiMsg = {
        role:           'assistant',
        content:        result.reply        || 'Done.',
        suggestions:    result.suggestions  || [],
        operationCount: result.operations?.length || 0,
        followup:       result.followup     || '',
        options:        result.options      || [],
      };
      setMessages(prev => [...prev, aiMsg]);

      // Maintain conversation history for context window
      setHistory(prev => [
        ...prev.slice(-14),   // keep last 7 turns (14 entries)
        { role: 'user',      content: trimmed },
        { role: 'assistant', content: result.reply || '' },
      ]);

    } catch (e) {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: `Sorry, I encountered an error: ${e?.message || 'Unknown error'}. Please try again.`,
        isError: true,
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading, formMeta, fields, history, applyOperations]);

  // Finalize: save then publish, post a success message in chat
  const handleFinalizePublish = useCallback(async () => {
    if (!onPublish) return;
    setPublishing(true);
    try {
      await onPublish();
      setShowFinalizeModal(false);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Your form "${formMeta.name || 'form'}" has been published successfully! Users can now access it${formMeta.alias ? ` via /${formMeta.alias}` : ' from the forms directory'}.`,
        suggestions: ['View submissions', 'Create another form'],
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Publish failed: ${e?.message || 'Unknown error'}. Please try again.`,
        isError: true,
      }]);
    } finally {
      setPublishing(false);
    }
  }, [onPublish, formMeta]);

  // Build form preview object
  const nonLayoutFields = fields.filter(
    f => !['heading', 'paragraph', 'divider'].includes(f.field_type)
  );
  const previewForm = {
    id:          formId || 'ai-preview',
    slug:        formMeta.slug        || 'preview',
    name:        formMeta.name        || 'Untitled Form',
    description: formMeta.description || '',
    settings:    formMeta.settings    || { submit_label: 'Submit' },
    sections,
    fields,
  };

  return (
    <>
    <div style={s.root}>

      {/* ── Chat Panel ── */}
      <div style={s.chat}>

        {/* Header */}
        <div style={s.chatHeader}>
          <div style={s.aiIcon}>
            <i className="fas fa-wand-magic-sparkles" />
          </div>
          <div>
            <div style={s.chatHeaderTitle}>AI Form Builder</div>
            <div style={s.chatHeaderSub}>Describe your form in natural language</div>
          </div>
          <button style={s.manualBtn} onClick={onSwitchToManual} title="Switch to drag-and-drop designer">
            <i className="fas fa-puzzle-piece" /> Manual Designer
          </button>
        </div>

        {/* Messages */}
        <div style={s.messages}>
          {messages.map((msg, i) =>
            msg.role === 'user'
              ? <UserBubble   key={i} content={msg.content} />
              : <AiBubble     key={i} msg={msg} onSuggestion={sendMessage} />
          )}
          {loading && <ThinkingBubble />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={s.inputWrap}>
          <div style={s.inputRow}>
            <textarea
              ref={inputRef}
              style={s.textarea}
              placeholder="Describe your form or ask for changes…"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              rows={1}
              disabled={loading}
            />
            <button
              style={{
                ...s.sendBtn,
                cursor:  input.trim() && !loading ? 'pointer' : 'not-allowed',
                opacity: input.trim() && !loading ? 1 : 0.45,
              }}
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              title="Send (Enter)"
            >
              <i className="fas fa-paper-plane" />
            </button>
          </div>
          <div style={s.inputHint}>Enter to send · Shift+Enter for new line</div>
        </div>
      </div>

      {/* ── Preview Panel ── */}
      <div style={s.preview}>

        {/* Preview header */}
        <div style={s.previewHeader}>
          <i className="fas fa-eye" style={{ color: 'var(--text-muted)', fontSize: 12 }} />
          <span style={s.previewTitle}>Live Preview</span>
          {formMeta.name && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 6 }}>
              — {formMeta.name}
            </span>
          )}
          <span style={s.previewMeta}>
            {nonLayoutFields.length > 0
              ? `${nonLayoutFields.length} field${nonLayoutFields.length !== 1 ? 's' : ''}`
              : 'No fields yet'}
          </span>
          {fields.length > 0 && (
            <button
              onClick={() => setShowFinalizeModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 7,
                border: 'none',
                background: 'linear-gradient(135deg, var(--success) 0%, #16a34a 100%)',
                color: '#fff', fontSize: 11, fontWeight: 700,
                cursor: 'pointer', flexShrink: 0,
                boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
              }}
              title="Review and publish your form"
            >
              <i className="fas fa-check-circle" style={{ fontSize: 10 }} />
              Finalize
            </button>
          )}
        </div>

        {/* Preview body */}
        <div style={s.previewBody}>
          {fields.length === 0 ? (
            <EmptyPreview />
          ) : (
            <DynamicFormRenderer
              form={previewForm}
              onSuccess={() => {}}
              compact={false}
            />
          )}
        </div>
      </div>

    </div>

    {/* ── Finalization Modal ── */}
    {showFinalizeModal && (
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        zIndex: 2000, overflowY: 'auto', padding: '32px 16px 48px',
      }}
        onClick={() => setShowFinalizeModal(false)}
      >
        <div
          style={{
            background: 'var(--bg)', borderRadius: 16,
            width: '100%', maxWidth: 680,
            border: '1px solid var(--border)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: 'rgba(78,212,78,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--success)', fontSize: 18,
            }}>
              <i className="fas fa-check-circle" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
                Review Your Form
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                {formMeta.name || 'Untitled Form'}
                {nonLayoutFields.length > 0 && ` · ${nonLayoutFields.length} field${nonLayoutFields.length !== 1 ? 's' : ''}`}
              </div>
            </div>
            <button
              onClick={() => setShowFinalizeModal(false)}
              style={{
                marginLeft: 'auto', background: 'none', border: 'none',
                cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16,
                padding: 6, borderRadius: 6,
              }}
              title="Close"
            >
              <i className="fas fa-times" />
            </button>
          </div>

          {/* Form preview */}
          <div style={{ padding: '20px 24px', maxHeight: '60vh', overflowY: 'auto' }}>
            <div style={{
              padding: '9px 13px',
              background: 'rgba(29,118,188,0.08)',
              borderRadius: 8, marginBottom: 18,
              fontSize: 12, color: 'var(--primary)',
              border: '1px solid rgba(29,118,188,0.18)',
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <i className="fas fa-eye" />
              This is a preview — submissions won't be saved until after publishing.
            </div>
            <DynamicFormRenderer form={previewForm} onSuccess={() => {}} />
          </div>

          {/* Footer */}
          <div style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
              Happy with the form? Publish to make it available to users.
            </span>
            <button
              onClick={() => setShowFinalizeModal(false)}
              style={{
                padding: '7px 14px', borderRadius: 7,
                border: '1px solid var(--border)',
                background: 'var(--bg-elevated)',
                color: 'var(--text)', fontSize: 12,
                cursor: 'pointer', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              <i className="fas fa-pen" /> Make Changes
            </button>
            {onSave && (
              <button
                onClick={async () => { try { await onSave(); } catch {} }}
                style={{
                  padding: '7px 14px', borderRadius: 7,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  color: 'var(--text)', fontSize: 12,
                  cursor: 'pointer', fontWeight: 600,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <i className="fas fa-save" /> Save Draft
              </button>
            )}
            {onPublish && (
              <button
                onClick={handleFinalizePublish}
                disabled={publishing}
                style={{
                  padding: '7px 16px', borderRadius: 7,
                  border: 'none',
                  background: publishing ? 'var(--text-muted)' : 'var(--success)',
                  color: '#fff', fontSize: 12,
                  cursor: publishing ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                {publishing
                  ? <><i className="fas fa-spinner fa-spin" /> Publishing…</>
                  : <><i className="fas fa-globe" /> Publish Form</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
