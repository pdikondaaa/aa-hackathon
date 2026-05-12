import React from 'react';
import { WIZARD_STEPS } from '../constants/onboardingData';

const StepNavigator = ({ activeStepId, onStepChange, completedSteps, overallProgress }) => {
  const getStatus = (step) => {
    if (completedSteps.includes(step.id)) return 'completed';
    if (step.id === activeStepId)         return 'active';
    return 'pending';
  };

  return (
    <nav className="og-wizard-nav" aria-label="Onboarding steps">

      {/* Progress badge */}
      <div className="og-nav-progress">
        <div className="og-nav-pct">{overallProgress}%</div>
        <div className="og-nav-progress-track">
          <div
            className="og-nav-progress-fill"
            style={{ width: `${overallProgress}%` }}
            role="progressbar"
            aria-valuenow={overallProgress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Horizontal step list */}
      <div className="og-nav-steps">
        {WIZARD_STEPS.map((step, index) => {
          const status = getStatus(step);
          const prevStatus = index > 0 ? getStatus(WIZARD_STEPS[index - 1]) : null;
          const connectorDone = prevStatus === 'completed';
          return (
            <React.Fragment key={step.id}>
              {index > 0 && (
                <div className={`og-nav-step-connector${connectorDone ? ' done' : ''}`} />
              )}
              <div
                className={`og-nav-step-item ${status}`}
                onClick={() => onStepChange(step.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onStepChange(step.id)}
                aria-label={`${step.title}: ${step.subtitle}`}
                aria-current={status === 'active' ? 'step' : undefined}
              >
                <div className="og-nav-step-icon">
                  {status === 'completed'
                    ? <i className="fas fa-check" />
                    : <i className={`fas ${step.icon}`} />
                  }
                </div>
                <div className="og-nav-step-label">{step.title}</div>

                {/* Hover tooltip */}
                <div className="og-nav-tooltip">
                  <div className="og-nav-tooltip-title">{step.title}</div>
                  <div className="og-nav-tooltip-sub">{step.subtitle}</div>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

     
    </nav>
  );
};

export default StepNavigator;
