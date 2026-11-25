import React, { useState, useEffect } from 'react'
import LessonForm from './components/LessonForm/LessonForm'
import ScenePlayer from './components/ScenePlayer/ScenePlayer'
import PromptInspector from './components/PromptInspector/PromptInspector'
import Spinner from './components/common/Spinner'
import ErrorBanner from './components/common/ErrorBanner'
import { useLesson } from './hooks/useLesson'
import './App.css'

export default function App() {
  const [activeTab, setActiveTab] = useState('lesson') // 'lesson' | 'inspector'
  const {
    storyboard,
    loading,
    error,
    usedFallback,
    fallbackReason,
    fallbackTopic,
    requestedTopic,
    metrics,
    audit,
    auditing,
    auditSource,
    mockAi,
    generate,
    replaceScene
  } = useLesson()
  const [currentParams, setCurrentParams] = useState(null)
  const [redirectCountdown, setRedirectCountdown] = useState(null)
  const [redirectCancelled, setRedirectCancelled] = useState(false)

  // Countdown timer to auto-redirect to Video Creator Studio
  useEffect(() => {
    if (redirectCountdown === null || redirectCancelled || !storyboard) return

    if (redirectCountdown <= 0) {
      window.location.href = '/studio.html?autoload=1'
      return
    }

    const timer = setTimeout(() => {
      setRedirectCountdown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearTimeout(timer)
  }, [redirectCountdown, redirectCancelled, storyboard])

  // Calm Mode support via ?calm=1 URL parameter
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('calm') === '1') {
        document.body.classList.add('calm')
      } else {
        document.body.classList.remove('calm')
      }
    }
  }, [])

  const handleGenerate = (params) => {
    setRedirectCountdown(3)
    setRedirectCancelled(false)
    setCurrentParams(params)
    generate(params)
  }

  return (
    <div className="app-container">
      {/* Decorative Gen Z Chaos emoji stickers */}
      <span className="chaos-sticker sticker-1" aria-hidden="true">🎓</span>
      <span className="chaos-sticker sticker-2" aria-hidden="true">✨</span>
      <span className="chaos-sticker sticker-3" aria-hidden="true">🔥</span>
      <span className="chaos-sticker sticker-4" aria-hidden="true">📚</span>
      <span className="chaos-sticker sticker-5" aria-hidden="true">🧠</span>

      <header className="app-header">
        <div className="header-badges-row">
          <span className="header-badge">AI Tools &amp; Prompt Engineering</span>
          {mockAi && <span className="mock-ai-badge">🤖 MOCK AI MODE</span>}
        </div>
        <h1 className="app-title">🎓 Clarivid</h1>
        <p className="app-subtitle">
          Interactive, Fact-Audited Explainer Generator with Browser Narration
        </p>
        <p className="app-how-to-use">
          💡 <strong>How to use:</strong> Enter any study topic below to generate an exam-tailored lesson with real-time fact verification, audio narration, and interactive checkpoints.
        </p>

        {/* View Switcher Tabs */}
        <div className="view-switcher-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'lesson'}
            className={`tab-btn ${activeTab === 'lesson' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('lesson')}
          >
            🎬 Lesson Player &amp; Quiz
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'inspector'}
            className={`tab-btn ${activeTab === 'inspector' ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab('inspector')}
          >
            🔬 Prompt Inspector (A vs B)
          </button>
          <a
            href="/studio.html"
            className="tab-btn studio-pill-link"
            title="Launch full Runway+Gamma Canvas Studio"
          >
            🎨 Launch ClariVid Studio (Canvas &amp; Video) ↗
          </a>
        </div>
      </header>

      {/* Gen Z Chaos Marquee strip */}
      <div className="chaos-marquee-strip" role="region" aria-label="Announcement marquee">
        <div className="chaos-marquee-track">
          <span className="chaos-marquee-content">
            FACT-CHECKED • HINGLISH • EXAM TAGS • PROMPT INSPECTOR • FACT-CHECKED • HINGLISH • EXAM TAGS • PROMPT INSPECTOR •&nbsp;
          </span>
          <span className="chaos-marquee-content" aria-hidden="true">
            FACT-CHECKED • HINGLISH • EXAM TAGS • PROMPT INSPECTOR • FACT-CHECKED • HINGLISH • EXAM TAGS • PROMPT INSPECTOR •&nbsp;
          </span>
        </div>
      </div>

      <main className="main-content">
        {activeTab === 'inspector' ? (
          <PromptInspector mockAi={mockAi} />
        ) : (
          <>
            <LessonForm onSubmit={handleGenerate} loading={loading} />

            {loading && <Spinner message="Generating storyboard..." />}

            {error && (
              <ErrorBanner
                message={error}
                onRetry={currentParams ? () => handleGenerate(currentParams) : undefined}
              />
            )}

            {metrics && !loading && (
              <div className="metrics-banner">
                <span>⚡ Generation Time: {metrics.generationTimeMs}ms</span>
                <span>📋 Mode: Prompt {metrics.promptMode}</span>
                <span>🎯 Schema Compliance: {metrics.complianceScore}%</span>
                {metrics.cached && <span className="cached-indicator">📦 Cached</span>}
                {metrics.retried && <span className="retry-indicator">🔄 Retried</span>}
              </div>
            )}

            {storyboard && !loading && (
              <div className="studio-redirect-banner" role="status">
                <div className="studio-redirect-info">
                  <span className="studio-redirect-badge">🚀 STUDIO READY</span>
                  <span className="studio-redirect-text">
                    Storyboard generated! {redirectCountdown !== null ? `Redirecting to Video Creator Studio in ${redirectCountdown}s...` : 'Ready to customize, re-narrate, and preview video.'}
                  </span>
                </div>
                <div className="studio-redirect-actions">
                  <a
                    href="/studio.html?autoload=1"
                    className="studio-redirect-btn-primary"
                  >
                    OPEN STUDIO NOW ↗
                  </a>
                  {redirectCountdown !== null && (
                    <button
                      type="button"
                      className="studio-redirect-btn-cancel"
                      onClick={() => {
                        setRedirectCountdown(null)
                        setRedirectCancelled(true)
                      }}
                    >
                      Stay on this page
                    </button>
                  )}
                </div>
              </div>
            )}

            {storyboard && !loading && (
              <ScenePlayer
                storyboard={storyboard}
                usedFallback={usedFallback}
                fallbackReason={fallbackReason}
                fallbackTopic={fallbackTopic}
                requestedTopic={requestedTopic}
                audit={audit}
                auditing={auditing}
                auditSource={auditSource}
                language={currentParams?.language || 'english'}
                onReplaceNextScene={replaceScene}
              />
            )}
          </>
        )}
      </main>

      <footer className="app-footer">
        Clarivid — Prompt Inspector, Interactive Quiz &amp; Adaptive Explainer
      </footer>
    </div>
  )
}
