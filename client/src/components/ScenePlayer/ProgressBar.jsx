import React from 'react'

export default function ProgressBar({ current, total }) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-header">
        <span className="scene-counter">
          Scene {current} of {total}
        </span>
        <span className="percentage-text">{percentage}%</span>
      </div>
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
