import React, { useState } from 'react'

export default function JsonViewer({ title, data }) {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!data) {
    return <div className="json-viewer-empty">No storyboard output available</div>
  }

  const jsonString = JSON.stringify(data, null, 2)

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="json-viewer-card">
      <div className="json-viewer-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="json-viewer-title">
          {isOpen ? '▾' : '▸'} {title} ({data.scenes?.length || 0} scenes)
        </span>
        <div className="json-viewer-actions">
          <button
            type="button"
            className="json-copy-btn"
            onClick={(e) => {
              e.stopPropagation()
              handleCopy()
            }}
          >
            {copied ? '✓ Copied' : '📋 Copy JSON'}
          </button>
        </div>
      </div>
      {isOpen && (
        <pre className="json-viewer-content">
          <code>{jsonString}</code>
        </pre>
      )}
    </div>
  )
}
