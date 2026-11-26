import React, { useState } from 'react'
import SceneSlide from './SceneSlide'
import ProgressBar from './ProgressBar'
import AuditBadge from './AuditBadge'
import CheckpointQuiz from '../CheckpointQuiz/CheckpointQuiz'
import { useSpeech } from '../../hooks/useSpeech'

export default function ScenePlayer({
  storyboard,
  usedFallback,
  fallbackReason,
  fallbackTopic,
  requestedTopic,
  audit,
  auditing,
  auditSource,
  language,
  onReplaceNextScene
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const scenes = storyboard?.scenes || []
  const { speaking, speak, stop } = useSpeech(language)

  if (!scenes.length) {
    return <div className="no-scenes">No scenes available to play.</div>
  }

  const currentScene = scenes[currentIndex]

  // Match audit entry by scene_id with fallback to current array index
  const auditEntry =
    audit?.find((a) => a.scene_id === currentScene.id) ??
    audit?.[currentIndex] ??
    null

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
      case 'quota_exceeded':
        return 'The daily AI quota is used up, so a pre-validated demo lesson is shown.'
      case 'flawed_demo':
        return 'Demonstration mode (?demo=flawed): loaded a lesson containing deliberate factual errors to test Critic verification.'
      case 'flawed_bio_demo':
        return 'Demonstration mode (?demo=flawed-bio): loaded a biology lesson containing deliberate factual errors to test Critic verification.'
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
            ⚠️ <strong>Notice:</strong> {getFallbackMessage()}
          </div>
          {isDifferentTopic && (
            <div className="fallback-topic-note">
              Showing demo lesson on <strong>"{fallbackTopic}"</strong> instead of requested <em>"{requestedTopic}"</em>.
            </div>
          )}
        </div>
      )}

      <div className="lesson-meta-bar">
        <div className="meta-left">
          <h2>{storyboard.title || 'Interactive Lesson'}</h2>
          <span className="badge level-badge">{storyboard.level || 'All levels'}</span>
          <span className="badge lang-badge">{storyboard.language || language}</span>
        </div>

        {/* Real-time Fact Audit Badge */}
        <div className="meta-right">
          <a
            href="/studio.html?autoload=1"
            className="scene-open-studio-btn"
            title="Open in full Video Creator Studio with canvas preview and scene alteration"
          >
            🎨 Video Studio ↗
          </a>
          <AuditBadge
            auditEntry={auditEntry}
            auditing={auditing}
            auditSource={auditSource}
          />
        </div>
      </div>

      <ProgressBar current={currentIndex + 1} total={scenes.length} />

      <SceneSlide scene={currentScene} />

      {/* Interactive Checkpoint Quiz */}
      <CheckpointQuiz
        scene={currentScene}
        currentIndex={currentIndex}
        nextScene={scenes[currentIndex + 1]}
        totalScenes={scenes.length}
        language={storyboard.language || language}
        onReplaceNextScene={onReplaceNextScene}
        onNext={handleNext}
      />

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

      {/* Navigation button to continue to Video Generator Studio */}
      <div className="studio-navigation-footer">
        <a
          href="/studio.html?autoload=1"
          className="studio-redirect-btn-primary studio-footer-btn"
          title="Proceed to scene-by-scene alteration, visual generation, voiceover, and video preview"
        >
          🎬 Continue to Video Generation &amp; Preview Studio ➔
        </a>
      </div>
    </div>
  )
}
