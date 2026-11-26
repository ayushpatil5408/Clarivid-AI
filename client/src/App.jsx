import React, { useState, useEffect } from 'react'
import LessonForm from './components/LessonForm/LessonForm'
import ScenePlayer from './components/ScenePlayer/ScenePlayer'
import PromptInspector from './components/PromptInspector/PromptInspector'
import Spinner from './components/common/Spinner'
import ErrorBanner from './components/common/ErrorBanner'
import ThemeToggle from './components/ThemeToggle/ThemeToggle'
import { useLesson } from './hooks/useLesson'
import './App.css'

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('clarivid-theme')
    if (saved === 'dark' || saved === 'light') return saved
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark'
    }
  } catch (e) {
    console.error('Failed to read theme from localStorage', e)
  }
  return 'light'
}

export default function App() {
  const [theme, setTheme] = useState(getInitialTheme)
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

  // Synchronize theme with body/documentElement class and localStorage
  useEffect(() => {
    try {
      localStorage.setItem('clarivid-theme', theme)
    } catch (e) {
      console.error('Failed to save theme to localStorage', e)
    }
    if (theme === 'dark') {
      document.body.classList.add('dark-theme')
      document.documentElement.classList.add('dark-theme')
    } else {
      document.body.classList.remove('dark-theme')
      document.documentElement.classList.remove('dark-theme')
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

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
        <div className="header-top-row">
          <div className="header-brand">
            <h1 className="app-title">🎓 Clarivid</h1>
            {mockAi && <span className="mock-ai-badge">🤖 MOCK AI MODE</span>}
          </div>
          <div className="header-actions">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
          </div>
        </div>
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
                  <span className="studio-redirect-badge">🚀 STORYBOARD READY</span>
                  <span className="studio-redirect-text">
                    Review your scene storyboard and checkpoint quiz below. When ready, generate your full video!
                  </span>
                </div>
                <div className="studio-redirect-actions">
                  <a
                    href="/studio.html?autoload=1"
                    className="studio-redirect-btn-primary"
                    title="Open in full Video Creator Studio"
                  >
                    CONTINUE TO VIDEO STUDIO ➔
                  </a>
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
