import React from 'react'

export default function ErrorBanner({ message, onRetry, retryLabel = '🔄 Try Again' }) {
  if (!message) return null

  const displayMessage = typeof message === 'string'
    ? message
    : message?.error || message?.message || 'Something went wrong. Please try again.'

  return (
    <div className="error-banner" role="alert">
      <div className="error-banner-content">
        <span className="error-icon">⚠️</span>
        <div className="error-text">
          <strong>Notice:</strong> {displayMessage}
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          className="error-retry-btn"
          onClick={onRetry}
          aria-label="Retry action"
        >
          {retryLabel}
        </button>
      )}
    </div>
  )
}
