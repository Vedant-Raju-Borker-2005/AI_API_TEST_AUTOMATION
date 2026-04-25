import React from 'react';

const STEP_LABELS = ['Upload Files', 'Generate Tests', 'Run & Analyse'];

/**
 * StepBar — horizontal progress indicator showing the 3-step dashboard workflow.
 * @param {0|1|2} step - Current active step index
 */
export default function StepBar({ step }) {
  return (
    <div className="step-bar">
      {STEP_LABELS.map((label, i) => (
        <React.Fragment key={i}>
          <div className={`step-item${i < step ? ' done' : i === step ? ' active' : ''}`}>
            <div className="step-dot">{i < step ? '✓' : i + 1}</div>
            <div className="step-label">{label}</div>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`step-line${i < step ? ' done' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
