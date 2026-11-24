import React, { useState } from 'react'
import SceneSlide from './SceneSlide'
import ProgressBar from './ProgressBar'
import { useSpeech } from '../../hooks/useSpeech'

export default function ScenePlayer({
  storyboard,
  usedFallback,
  fallbackReason,
  fallbackTopic,
  requestedTopic,
  language
}) {
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

  const getFallbackMessage = () => {
    switch (fallbackReason) {
      case 'api_busy':
        return 'The AI service is busy right now, so we loaded a demo lesson. Try again in a minute.'
      case 'invalid_output':
        return 'The AI generated an invalid lesson format after retrying, so we loaded a pre-validated demo lesson.'
      case 'api_error':
      default:
        return 'Could not connect to the AI service, so we loaded a demo lesson.'
    }
  }

  const isDifferentTopic =
    fallbackTopic &&
    requestedTopic &&
    !requestedTopic.toLowerCase().includes(fallbackTopic.toLowerCase()) &&
    !fallbackTopic.toLowerCase().includes(requestedTopic.toLowerCase())

  return (
    <div className="scene-player-card">
      {usedFallback && (
        <div className="fallback-banner" role="alert">
          <div className="fallback-main-msg">
            ⚠️ <strong>Demo Fallback:</strong> {getFallbackMessage()}
          </div>
          {isDifferentTopic && (
            <div className="fallback-topic-note">
              Showing demo lesson on <strong>"{fallbackTopic}"</strong> instead of your requested topic <em>"{requestedTopic}"</em>.
            </div>
          )}
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
