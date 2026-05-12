import React, { useState, useRef } from 'react';
import StepNavigator  from '../components/StepNavigator';
import WelcomeStep    from '../components/steps/WelcomeStep';
import ProfileStep    from '../components/steps/ProfileStep';
import ITAccessStep   from '../components/steps/ITAccessStep';
import PolicyStep     from '../components/steps/PolicyStep';
import InductionStep  from '../components/steps/InductionStep';
import TeamStep       from '../components/steps/TeamStep';
import DocumentsStep  from '../components/steps/DocumentsStep';
import AllSetStep     from '../components/steps/AllSetStep';
import { WIZARD_STEPS } from '../constants/onboardingData';
import ChatWindow from '../../../components/ChatWindow';

const STEP_COMPONENTS = {
  'welcome':   WelcomeStep,
  'profile':   ProfileStep,
  'it-access': ITAccessStep,
  'policy':    PolicyStep,
  'induction': InductionStep,
  'team':      TeamStep,
  'documents': DocumentsStep,
  'all-set':   AllSetStep,
};

const INITIAL_COMPLETED = ['welcome', 'profile'];

const OnboardingGuidancePage = ({ user, config }) => {
  const [activeStepId, setActiveStepId] = useState('it-access');
  const [completed, setCompleted]       = useState(INITIAL_COMPLETED);
  const [chatOpen, setChatOpen]         = useState(false);
  const [chatMounted, setChatMounted]   = useState(false);
  const chatKeyRef                      = useRef(Date.now());

  const activeStep    = WIZARD_STEPS.find(s => s.id === activeStepId);
  const activeIndex   = WIZARD_STEPS.findIndex(s => s.id === activeStepId);
  const totalSteps    = WIZARD_STEPS.length;
  const overallProgress = Math.round(((completed.length) / totalSteps) * 100);

  const handleStepChange = (stepId) => setActiveStepId(stepId);

  const handleNext = () => {
    if (!completed.includes(activeStepId)) {
      setCompleted(prev => [...prev, activeStepId]);
    }
    if (activeIndex < totalSteps - 1) {
      setActiveStepId(WIZARD_STEPS[activeIndex + 1].id);
    }
  };

  const handleOpenChat = () => {
    if (!chatMounted) setChatMounted(true);
    setChatOpen(true);
    setTimeout(() => {
      if (ChatWindow.setSuggestion && activeStep) {
        ChatWindow.setSuggestion(`I need help with the "${activeStep.title}" step of my onboarding.`);
      }
    }, 150);
  };

  const StepContent = STEP_COMPONENTS[activeStepId] || (() => null);

  return (
    <main className="main-content og-container">
      <div className="og-wizard-layout">

        {/* ── Left step navigator ────────────────────────────── */}
        <StepNavigator
          activeStepId={activeStepId}
          onStepChange={handleStepChange}
          completedSteps={completed}
          overallProgress={overallProgress}
        />

        {/* ── Right wizard main ─────────────────────────────── */}
        <div className="og-wizard-main">

          {/* Top breadcrumb bar */}
          <div className="og-wizard-topbar">
            <nav className="og-breadcrumb" aria-label="Breadcrumb">
              <span className="og-breadcrumb-root">Onboarding</span>
              <i className="fas fa-chevron-right og-breadcrumb-sep" aria-hidden="true" />
              <span className="og-breadcrumb-current">{activeStep?.title}</span>
            </nav>

            <div className="og-step-counter">
              <span>Step {activeIndex + 1} of {totalSteps}</span>
              <div className="og-step-dots" aria-hidden="true">
                {WIZARD_STEPS.map((s, i) => (
                  <div
                    key={s.id}
                    className={`og-step-dot ${
                      completed.includes(s.id) || i < activeIndex ? 'done' :
                      s.id === activeStepId ? 'active' : ''
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Scrollable step content */}
          <div className="og-wizard-body">
            <StepContent user={user} onNext={handleNext} />
          </div>

        </div>
      </div>

      {/* ── Floating AI chat button ───────────────────────────── */}
      <button
        className={`og-chat-fab${chatOpen ? ' og-chat-fab--open' : ''}`}
        onClick={() => (chatOpen ? setChatOpen(false) : handleOpenChat())}
        aria-label={chatOpen ? 'Close AI Assistant' : 'Ask AI Assistant'}
      >
        <i className={`fas ${chatOpen ? 'fa-times' : 'fa-robot'}`} />
        {!chatOpen && <span>Ask Aura</span>}
      </button>

      {/* ── Chat drawer (mounted once, shown/hidden via CSS) ─── */}
      <div className={`og-chat-drawer${chatOpen ? ' og-chat-drawer--open' : ''}`} aria-hidden={!chatOpen}>
        <div className="og-chat-drawer-header">
          <div className="og-chat-drawer-title">
            <i className="fas fa-robot" />
            <span>Aura AI Assistant</span>
          </div>
          <button className="og-chat-drawer-close" onClick={() => setChatOpen(false)} aria-label="Close chat">
            <i className="fas fa-times" />
          </button>
        </div>
        <div className="og-chat-drawer-body">
          {chatMounted && <ChatWindow key={chatKeyRef.current} config={config} user={user} compact />}
        </div>
      </div>
    </main>
  );
};

export default OnboardingGuidancePage;
