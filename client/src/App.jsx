import React, { useState } from 'react'
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

  const handleGenerate = (params) => {
    setCurrentParams(params)
    generate(params)
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-badges-row">
          <span className="header-badge">AI Tools &amp; Prompt Engineering</span>
          {mockAi && <span className="mock-ai-badge">🤖 MOCK AI MODE</span>}
        </div>
        <h1 className="app-title">🎓 LearnLoop</h1>
        <p className="app-subtitle">
          Interactive, Fact-Audited Explainer Generator with Browser Narration
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
        </div>
      </header>

      <main className="main-content">
        {activeTab === 'inspector' ? (
          <PromptInspector mockAi={mockAi} />
        ) : (
          <>
            <LessonForm onSubmit={handleGenerate} loading={loading} />

            {loading && <Spinner message="Generating storyboard..." />}

            {error && <ErrorBanner message={error} />}

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
        LearnLoop Phase 4 &amp; 5 — Prompt Inspector, Interactive Quiz &amp; Adaptive Explainer
      </footer>
    </div>
  )
}
