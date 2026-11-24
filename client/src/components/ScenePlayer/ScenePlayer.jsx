import React, { useState } from 'react'
import SceneSlide from './SceneSlide'
import ProgressBar from './ProgressBar'
import { useSpeech } from '../../hooks/useSpeech'

export default function ScenePlayer({ storyboard, usedFallback, language }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const scenes = storyboard?.scenes || []
  const { speaking, speak, stop } = useSpeech(language)

  if (!scenes.length) {
    return <div className="no-scenes">No scenes available to play.</div>
  }

  const currentScene = scenes[currentIndex]

  const handleNext = () => {
    stop()
    if (currentIndex < scenes.length - 1) {
      setCurrentIndex((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    stop()
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const handleToggleNarrate = () => {
    if (speaking) {
      stop()
    } else {
      speak(currentScene.narration)
    }
  }

  return (
    <div className="scene-player-card">
      {usedFallback && (
        <div className="fallback-banner" role="alert">
          ⚠️ <strong>Notice:</strong> The AI model could not return a verified response or is not configured yet. Showing the pre-validated <strong>TCP Three-Way Handshake</strong> fallback lesson.
        </div>
      )}

      <div className="lesson-meta-bar">
        <h2>{storyboard.title || 'Interactive Lesson'}</h2>
        <span className="badge level-badge">{storyboard.level || 'All levels'}</span>
        <span className="badge lang-badge">{storyboard.language || language}</span>
      </div>

      <ProgressBar current={currentIndex + 1} total={scenes.length} />

      <SceneSlide scene={currentScene} />

      <div className="player-controls">
        <button
          type="button"
          className="control-btn nav-btn"
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          ⬅️ Previous
        </button>

        <button
          type="button"
          className={`control-btn narrate-btn ${speaking ? 'speaking' : ''}`}
          onClick={handleToggleNarrate}
        >
          {speaking ? '⏹️ Stop Narration' : '🔊 Narrate Scene'}
        </button>

        <button
          type="button"
          className="control-btn nav-btn"
          onClick={handleNext}
          disabled={currentIndex === scenes.length - 1}
        >
          Next ➡️
        </button>
      </div>
    </div>
  )
}
