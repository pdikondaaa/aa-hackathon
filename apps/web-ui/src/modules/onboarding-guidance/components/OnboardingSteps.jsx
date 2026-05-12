import React from 'react';
import StatusBadge from './StatusBadge';
import { ONBOARDING_STEPS } from '../constants/onboardingData';

const OnboardingSteps = () => {
  return (
    <div className="og-card">
      <div className="og-card-header">
        <span className="og-card-title">
          <i className="fas fa-route" />
          Onboarding Journey
        </span>
        <span className="og-section-label">5 PHASES</span>
      </div>

      <div className="og-steps-body">
        <div className="og-steps-track">
          {ONBOARDING_STEPS.map((step, idx) => {
            const isLast = idx === ONBOARDING_STEPS.length - 1;
            return (
              <React.Fragment key={step.id}>
                <div className={`og-step-item og-step-${step.status}`}>
                  <div className="og-step-circle">
                    {step.status === 'completed' ? (
                      <i className="fas fa-check" />
                    ) : (
                      <i className={`fas ${step.icon}`} />
                    )}
                  </div>
                  <div className="og-step-body">
                    <div className="og-step-number">Step {step.step}</div>
                    <div className="og-step-title">{step.title}</div>
                    <div className="og-step-desc">{step.description}</div>
                    <StatusBadge status={step.status} />
                  </div>
                </div>
                {!isLast && <div className={`og-step-connector og-step-connector-${step.status === 'completed' ? 'done' : 'todo'}`} />}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default OnboardingSteps;
