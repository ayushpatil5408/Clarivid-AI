import React, { useState } from 'react'

export default function AuditBadge({ auditEntry, auditing }) {
  const [showDetails, setShowDetails] = useState(false)
  const [showCorrection, setShowCorrection] = useState(false)

  if (auditing) {
    return (
      <div className="audit-badge-wrapper">
        <div className="audit-badge audit-badge--auditing">
          <span className="spinner-dot" />
          <span>🔍 Auditing with Critic AI...</span>
        </div>
      </div>
    )
  }

  if (!auditEntry || typeof auditEntry.confidence !== 'number') {
    return (
      <div className="audit-badge-wrapper">
        <div className="audit-badge audit-badge--neutral" title="Fact-audit is unavailable or skipped">
          <span>⚪ Not audited</span>
        </div>
      </div>
    )
  }

  const { confidence, issues = [], corrected_text } = auditEntry

  let band = 'green'
  let label = 'High confidence'
  let icon = '🟢'

  if (confidence < 70) {
    band = 'red'
    label = 'Low confidence'
    icon = '🔴'
  } else if (confidence < 90) {
    band = 'yellow'
    label = 'Moderate confidence'
    icon = '🟡'
  }

  const hasIssues = Array.isArray(issues) && issues.length > 0
  const hasCorrection = Boolean(corrected_text && String(corrected_text).trim())

  return (
    <div
      className="audit-badge-wrapper"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      <div
        className={`audit-badge audit-badge--${band} ${hasIssues ? 'has-issues' : ''}`}
        onClick={() => setShowDetails((prev) => !prev)}
        role="button"
        tabIndex={0}
        aria-expanded={showDetails}
      >
        <span className="badge-icon">{icon}</span>
        <span className="badge-label">{label}</span>
        <span className="badge-score">({confidence}/100)</span>
        {hasIssues && (
          <span className="issues-pill">
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'} ▾
          </span>
        )}
      </div>

      {/* Issues Drawer / Dropdown */}
      {showDetails && (
        <div className="audit-details-popup" role="tooltip">
          <div className="popup-header">
            <strong>Critic Fact-Audit ({confidence}/100)</strong>
          </div>

          {hasIssues ? (
            <ul className="audit-issues-list">
              {issues.map((issue, idx) => (
                <li key={idx} className="issue-item">
                  ⚠️ {issue}
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-issues-text">✅ No factual issues found in this scene.</p>
          )}

          {hasCorrection && (
            <div className="correction-section">
              <button
                type="button"
                className="correction-toggle-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowCorrection((prev) => !prev)
                }}
              >
                {showCorrection ? 'Hide suggested correction ▴' : 'View suggested correction ▾'}
              </button>

              {showCorrection && (
                <div className="corrected-text-box">
                  <strong>Suggested correction:</strong>
                  <p>{corrected_text}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
