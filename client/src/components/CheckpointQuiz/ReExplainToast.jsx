import React from 'react'

export default function ReExplainToast({ toast, onClose }) {
  if (!toast) return null

  const icons = {
    success: '✅',
    info: '💡',
    error: '⚠️'
  }

  return (
    <div className={`reexplain-toast toast--${toast.type}`} role="status">
      <div className="toast-content">
        <span className="toast-icon">{icons[toast.type] || 'ℹ️'}</span>
        <span className="toast-message">{toast.message}</span>
      </div>
      {onClose && (
        <button type="button" className="toast-close-btn" onClick={onClose} aria-label="Dismiss toast">
          ×
        </button>
      )}
    </div>
  )
}
