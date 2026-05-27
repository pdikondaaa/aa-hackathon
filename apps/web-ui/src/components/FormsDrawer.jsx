import React, { useState, useCallback } from 'react';
import { createMicrosoftForm, acquireFormsToken } from '../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const QUESTION_TYPES = [
  { value: 'text',            label: 'Text Answer',       icon: 'fa-align-left' },
  { value: 'single_choice',   label: 'Single Choice',     icon: 'fa-dot-circle' },
  { value: 'multiple_choice', label: 'Multiple Choice',   icon: 'fa-check-square' },
  { value: 'rating',          label: 'Rating (1–5 ⭐)',    icon: 'fa-star' },
  { value: 'date',            label: 'Date',              icon: 'fa-calendar-alt' },
  { value: 'yes_no',          label: 'Yes / No',          icon: 'fa-toggle-on' },
];

const HR_TEMPLATES = [
  {
    label: 'Exit Survey',
    icon: 'fa-door-open',
    description: 'Collect feedback from departing employees',
    title: 'Employee Exit Survey',
    description_text: 'We value your feedback. Please take a few minutes to share your experience.',
    questions: [
      { text: 'What is your primary reason for leaving?', type: 'single_choice', required: true,
        choices: ['Better opportunity', 'Work-life balance', 'Compensation', 'Career growth', 'Relocation', 'Other'] },
      { text: 'How satisfied were you with your role overall?', type: 'rating', required: true, choices: [] },
      { text: 'How would you rate your manager?', type: 'rating', required: true, choices: [] },
      { text: 'Would you recommend this company to others?', type: 'yes_no', required: true, choices: [] },
      { text: 'What could we have done differently to retain you?', type: 'text', required: false, choices: [] },
    ],
  },
  {
    label: 'Onboarding Survey',
    icon: 'fa-hands-helping',
    description: 'Gauge new employee experience in first 30 days',
    title: 'Onboarding Experience Survey',
    description_text: 'Help us improve our onboarding process by sharing your first-30-day experience.',
    questions: [
      { text: 'How clear was your role and responsibilities?', type: 'rating', required: true, choices: [] },
      { text: 'How well were you welcomed by your team?', type: 'rating', required: true, choices: [] },
      { text: 'Was your workstation/equipment ready on Day 1?', type: 'yes_no', required: true, choices: [] },
      { text: 'Which areas of onboarding need improvement?', type: 'multiple_choice', required: false,
        choices: ['System access', 'Documentation', 'Team introduction', 'Process training', 'Culture orientation'] },
      { text: 'Any other feedback on your onboarding?', type: 'text', required: false, choices: [] },
    ],
  },
  {
    label: 'Training Feedback',
    icon: 'fa-chalkboard-teacher',
    description: 'Post-training evaluation for L&D',
    title: 'Training Feedback Form',
    description_text: 'Please rate your experience with the training program.',
    questions: [
      { text: 'Training program name', type: 'text', required: true, choices: [] },
      { text: 'How relevant was the training to your role?', type: 'rating', required: true, choices: [] },
      { text: 'How would you rate the trainer / facilitator?', type: 'rating', required: true, choices: [] },
      { text: 'Will you apply what you learned in your work?', type: 'yes_no', required: true, choices: [] },
      { text: 'Suggestions for future training topics', type: 'text', required: false, choices: [] },
    ],
  },
  {
    label: 'Employee Satisfaction',
    icon: 'fa-smile',
    description: 'Periodic pulse check on workplace satisfaction',
    title: 'Employee Satisfaction Survey',
    description_text: 'Your feedback helps us create a better workplace for everyone.',
    questions: [
      { text: 'How satisfied are you with your work-life balance?', type: 'rating', required: true, choices: [] },
      { text: 'Do you feel your contributions are recognized?', type: 'yes_no', required: true, choices: [] },
      { text: 'How likely are you to refer a friend to work here?', type: 'rating', required: true, choices: [] },
      { text: 'What aspect of your job do you enjoy most?', type: 'single_choice', required: false,
        choices: ['Team collaboration', 'Growth opportunities', 'Work flexibility', 'Compensation', 'Company culture', 'Projects'] },
      { text: 'Any suggestions for improving the workplace?', type: 'text', required: false, choices: [] },
    ],
  },
];

const BLANK_QUESTION = () => ({
  id:       Date.now() + Math.random(),
  text:     '',
  type:     'text',
  required: false,
  choices:  [],
});

// ── Step components ───────────────────────────────────────────────────────────

const StepIndicator = ({ step }) => {
  const steps = ['Setup', 'Questions', 'Preview', 'Done'];
  const idx   = { setup: 0, questions: 1, preview: 2, done: 3 }[step] ?? 0;
  return (
    <div className="forms-steps" aria-label="Form creation progress">
      {steps.map((s, i) => (
        <React.Fragment key={s}>
          <div className={`forms-step ${i < idx ? 'done' : i === idx ? 'active' : ''}`}>
            <div className="forms-step-dot">
              {i < idx ? <i className="fas fa-check" /> : i + 1}
            </div>
            <span className="forms-step-label">{s}</span>
          </div>
          {i < steps.length - 1 && <div className={`forms-step-line ${i < idx ? 'done' : ''}`} />}
        </React.Fragment>
      ))}
    </div>
  );
};

const QuestionRow = ({ q, index, onChange, onRemove, canRemove }) => {
  const needsChoices = ['single_choice', 'multiple_choice'].includes(q.type);

  const handleChoiceChange = (choiceIdx, value) => {
    const updated = [...q.choices];
    updated[choiceIdx] = value;
    onChange({ ...q, choices: updated });
  };

  const addChoice = () => onChange({ ...q, choices: [...q.choices, ''] });
  const removeChoice = (ci) => onChange({ ...q, choices: q.choices.filter((_, i) => i !== ci) });

  return (
    <div className="forms-question-row">
      <div className="forms-question-header">
        <span className="forms-question-num">Q{index + 1}</span>
        <div className="forms-question-controls">
          <label className="forms-required-toggle" title="Mark as required">
            <input
              type="checkbox"
              checked={q.required}
              onChange={(e) => onChange({ ...q, required: e.target.checked })}
            />
            <span>Required</span>
          </label>
          {canRemove && (
            <button
              className="forms-q-remove-btn"
              onClick={onRemove}
              title="Remove question"
              aria-label="Remove question"
            >
              <i className="fas fa-trash-alt" />
            </button>
          )}
        </div>
      </div>

      <input
        className="forms-q-text-input"
        type="text"
        placeholder={`Question ${index + 1} text…`}
        value={q.text}
        onChange={(e) => onChange({ ...q, text: e.target.value })}
        maxLength={500}
      />

      <select
        className="forms-q-type-select"
        value={q.type}
        onChange={(e) => onChange({ ...q, type: e.target.value, choices: [] })}
      >
        {QUESTION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>

      {needsChoices && (
        <div className="forms-choices-block">
          <span className="forms-choices-label">Answer options</span>
          {q.choices.map((c, ci) => (
            <div key={ci} className="forms-choice-row">
              <input
                className="forms-choice-input"
                type="text"
                placeholder={`Option ${ci + 1}`}
                value={c}
                onChange={(e) => handleChoiceChange(ci, e.target.value)}
              />
              {q.choices.length > 1 && (
                <button
                  className="forms-choice-remove"
                  onClick={() => removeChoice(ci)}
                  aria-label="Remove option"
                >
                  <i className="fas fa-times" />
                </button>
              )}
            </div>
          ))}
          <button className="forms-add-choice-btn" onClick={addChoice}>
            <i className="fas fa-plus" /> Add option
          </button>
        </div>
      )}
    </div>
  );
};

// ── Main drawer component ─────────────────────────────────────────────────────

const FormsDrawer = ({ isOpen, onClose, user, initialQuery = '' }) => {
  const [step,        setStep]        = useState('setup');
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [questions,   setQuestions]   = useState([BLANK_QUESTION()]);
  const [creating,    setCreating]    = useState(false);
  const [result,      setResult]      = useState(null);   // { form_id, web_url, edit_url, title }
  const [error,       setError]       = useState(null);
  const [copied,      setCopied]      = useState(false);

  const reset = () => {
    setStep('setup');
    setTitle('');
    setDescription('');
    setQuestions([BLANK_QUESTION()]);
    setCreating(false);
    setResult(null);
    setError(null);
    setCopied(false);
  };

  const handleClose = () => { reset(); onClose(); };

  // ── Template selection ──────────────────────────────────────────────────────
  const applyTemplate = (tpl) => {
    setTitle(tpl.title);
    setDescription(tpl.description_text);
    setQuestions(tpl.questions.map((q) => ({ ...q, id: Date.now() + Math.random() })));
    setStep('questions');
  };

  // ── Question CRUD ───────────────────────────────────────────────────────────
  const updateQuestion = useCallback((id, updated) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...updated, id } : q)));
  }, []);

  const removeQuestion = useCallback((id) => {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }, []);

  const addQuestion = () => setQuestions((prev) => [...prev, BLANK_QUESTION()]);

  // ── Validate before proceeding to preview ──────────────────────────────────
  const validateQuestions = () => {
    if (!title.trim()) { setError('Please enter a form title.'); return false; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) { setError(`Question ${i + 1} needs some text.`); return false; }
      if (['single_choice', 'multiple_choice'].includes(q.type)) {
        const validChoices = q.choices.filter((c) => c.trim());
        if (validChoices.length < 2) {
          setError(`Question ${i + 1} needs at least 2 answer options.`); return false;
        }
      }
    }
    setError(null);
    return true;
  };

  // ── Create form ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!validateQuestions()) return;
    setCreating(true);
    setError(null);
    try {
      // Acquire a Graph token with Forms.ReadWrite scope from MSAL
      const graphToken = await acquireFormsToken();
      const payload = {
        title:               title.trim(),
        description:         description.trim() || null,
        questions:           questions.map(({ text, type, required, choices }) => ({
          text, type, required,
          choices: choices.filter((c) => c.trim()),
        })),
        graph_access_token:  graphToken,
      };
      const res = await createMicrosoftForm(payload);
      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err.message || 'Failed to create the form. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(result?.web_url || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="forms-drawer-backdrop"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`forms-drawer${isOpen ? ' forms-drawer--open' : ''}`}
        aria-label="Create Microsoft Form"
        aria-modal="true"
        role="dialog"
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="forms-drawer-header">
          <div className="forms-drawer-title-row">
            <div className="forms-drawer-icon">
              <i className="fab fa-microsoft" />
            </div>
            <div>
              <h2 className="forms-drawer-title">Create Microsoft Form</h2>
              <p className="forms-drawer-subtitle">Build and publish a form directly to your Microsoft account</p>
            </div>
          </div>
          <button className="forms-close-btn" onClick={handleClose} aria-label="Close">
            <i className="fas fa-times" />
          </button>
        </div>

        {/* ── Step indicator ──────────────────────────────── */}
        {step !== 'done' && <StepIndicator step={step} />}

        {/* ── Content area ────────────────────────────────── */}
        <div className="forms-drawer-body">

          {/* ─── Step: Setup ──────────────────────────────── */}
          {step === 'setup' && (
            <div className="forms-setup-step">
              {/* Form details */}
              <section className="forms-section">
                <p className="forms-section-label">Form Details</p>

                <div className="forms-field">
                  <label className="forms-label" htmlFor="forms-title">
                    Form Title <span className="forms-required">*</span>
                  </label>
                  <input
                    id="forms-title"
                    className="forms-input"
                    type="text"
                    placeholder="e.g. Exit Survey 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div className="forms-field">
                  <label className="forms-label" htmlFor="forms-description">
                    Description <span className="forms-optional">(optional)</span>
                  </label>
                  <textarea
                    id="forms-description"
                    className="forms-textarea forms-textarea--short"
                    placeholder="Brief description shown to respondents…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    maxLength={1000}
                  />
                </div>
              </section>

              {/* HR Templates */}
              <section className="forms-section">
                <p className="forms-section-label">
                  <i className="fas fa-magic" style={{ marginRight: 6, color: 'var(--primary)' }} />
                  Start from an HR Template
                </p>
                <div className="forms-templates-grid">
                  {HR_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.label}
                      className="forms-template-card"
                      onClick={() => applyTemplate(tpl)}
                    >
                      <i className={`fas ${tpl.icon} forms-template-icon`} />
                      <span className="forms-template-label">{tpl.label}</span>
                      <span className="forms-template-desc">{tpl.description}</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {/* ─── Step: Questions ──────────────────────────── */}
          {step === 'questions' && (
            <div className="forms-questions-step">
              <div className="forms-questions-meta">
                <div>
                  <span className="forms-meta-title">{title || 'Untitled Form'}</span>
                  {description && <span className="forms-meta-desc">{description}</span>}
                </div>
                <button
                  className="forms-edit-meta-btn"
                  onClick={() => setStep('setup')}
                  title="Edit title & description"
                >
                  <i className="fas fa-pencil-alt" /> Edit
                </button>
              </div>

              <div className="forms-questions-list">
                {questions.map((q, idx) => (
                  <QuestionRow
                    key={q.id}
                    q={q}
                    index={idx}
                    onChange={(updated) => updateQuestion(q.id, updated)}
                    onRemove={() => removeQuestion(q.id)}
                    canRemove={questions.length > 1}
                  />
                ))}
              </div>

              <button className="forms-add-question-btn" onClick={addQuestion}>
                <i className="fas fa-plus-circle" /> Add Question
              </button>
            </div>
          )}

          {/* ─── Step: Preview ────────────────────────────── */}
          {step === 'preview' && (
            <div className="forms-preview-step">
              <div className="forms-preview-header">
                <h3 className="forms-preview-title">{title}</h3>
                {description && <p className="forms-preview-desc">{description}</p>}
              </div>

              <div className="forms-preview-questions">
                {questions.map((q, idx) => {
                  const typeMeta = QUESTION_TYPES.find((t) => t.value === q.type);
                  return (
                    <div key={q.id} className="forms-preview-question">
                      <div className="forms-preview-q-header">
                        <span className="forms-preview-q-num">Q{idx + 1}</span>
                        <span className="forms-preview-q-type">
                          <i className={`fas ${typeMeta?.icon}`} /> {typeMeta?.label}
                        </span>
                        {q.required && <span className="forms-preview-required-badge">Required</span>}
                      </div>
                      <p className="forms-preview-q-text">{q.text}</p>
                      {q.choices?.length > 0 && (
                        <ul className="forms-preview-choices">
                          {q.choices.filter(Boolean).map((c, ci) => (
                            <li key={ci}>{c}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="forms-error">
                  <i className="fas fa-exclamation-circle" /> {error}
                </div>
              )}
            </div>
          )}

          {/* ─── Step: Done ───────────────────────────────── */}
          {step === 'done' && result && (
            <div className="forms-done-step">
              <div className="forms-done-icon">
                <i className="fas fa-check-circle" />
              </div>
              <h3 className="forms-done-title">Form Created!</h3>
              <p className="forms-done-subtitle">
                <strong>{result.title}</strong> is live in your Microsoft Forms.
              </p>

              <div className="forms-done-link-box">
                <i className="fas fa-link" />
                <span className="forms-done-url" title={result.web_url}>
                  {result.web_url}
                </span>
              </div>

              <div className="forms-done-actions">
                <a
                  href={result.web_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="forms-btn forms-btn--primary"
                >
                  <i className="fab fa-microsoft" /> Open Form
                </a>
                <a
                  href={result.edit_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="forms-btn forms-btn--secondary"
                >
                  <i className="fas fa-pencil-alt" /> Edit Form
                </a>
                <button
                  className={`forms-btn forms-btn--ghost${copied ? ' forms-btn--copied' : ''}`}
                  onClick={copyLink}
                >
                  <i className={`fas ${copied ? 'fa-check' : 'fa-copy'}`} />
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>

              <button className="forms-create-another-btn" onClick={reset}>
                <i className="fas fa-plus" /> Create Another Form
              </button>
            </div>
          )}

        </div>

        {/* ── Footer actions ──────────────────────────────── */}
        {step !== 'done' && (
          <div className="forms-drawer-footer">
            {error && !creating && (
              <div className="forms-error forms-error--footer">
                <i className="fas fa-exclamation-circle" /> {error}
              </div>
            )}

            <div className="forms-footer-row">
              {/* Back navigation */}
              <div className="forms-footer-left">
                {step === 'questions' && (
                  <button className="forms-btn forms-btn--ghost" onClick={() => setStep('setup')}>
                    <i className="fas fa-arrow-left" /> Back
                  </button>
                )}
                {step === 'preview' && (
                  <button className="forms-btn forms-btn--ghost" onClick={() => setStep('questions')}>
                    <i className="fas fa-arrow-left" /> Edit Questions
                  </button>
                )}
              </div>

              {/* Forward / submit */}
              <div className="forms-footer-right">
                <button className="forms-btn forms-btn--ghost" onClick={handleClose} disabled={creating}>
                  Cancel
                </button>

                {step === 'setup' && (
                  <button
                    className="forms-btn forms-btn--primary"
                    onClick={() => { if (!title.trim()) { setError('Please enter a form title.'); return; } setError(null); setStep('questions'); }}
                  >
                    Next: Questions <i className="fas fa-arrow-right" />
                  </button>
                )}

                {step === 'questions' && (
                  <button
                    className="forms-btn forms-btn--primary"
                    onClick={() => { if (validateQuestions()) setStep('preview'); }}
                  >
                    Preview <i className="fas fa-eye" />
                  </button>
                )}

                {step === 'preview' && (
                  <button
                    className="forms-btn forms-btn--create"
                    onClick={handleCreate}
                    disabled={creating}
                  >
                    {creating ? (
                      <><i className="fas fa-spinner fa-spin" /> Creating…</>
                    ) : (
                      <><i className="fab fa-microsoft" /> Create Form</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
};

export default FormsDrawer;
