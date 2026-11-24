import React, { useState } from 'react'
import LessonForm from './components/LessonForm/LessonForm'
import ScenePlayer from './components/ScenePlayer/ScenePlayer'
import Spinner from './components/common/Spinner'
import ErrorBanner from './components/common/ErrorBanner'
import { useLesson } from './hooks/useLesson'
import './App.css'

export default function App() {
  const { storyboard, loading, error, usedFallback, metrics, generate } = useLesson()
  const [currentParams, setCurrentParams] = useState(null)

  const handleGenerate = (params) => {
    setCurrentParams(params)
    generate(params)
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-badge">AI Tools &amp; Prompt Engineering</div>
        <h1 className="app-title">🎓 LearnLoop</h1>
        <p className="app-subtitle">
          Interactive, Fact-Audited Explainer Generator with Browser Narration
        </p>
      </header>

      <main className="main-content">
        <LessonForm onSubmit={handleGenerate} loading={loading} />

        {loading && <Spinner message="Generating storyboard with Gemini AI..." />}

        {error && <ErrorBanner message={error} />}

        {metrics && !loading && (
          <div className="metrics-banner">
            <span>⚡ Generation Time: {metrics.generationTimeMs}ms</span>
            <span>📋 Mode: Prompt {metrics.promptMode}</span>
            <span>🎯 Schema Compliance: {metrics.complianceScore}%</span>
            {metrics.retried && <span className="retry-indicator">🔄 Retried</span>}
          </div>
        )}

        {storyboard && !loading && (
          <ScenePlayer
            storyboard={storyboard}
            usedFallback={usedFallback}
            language={currentParams?.language || 'english'}
          />
        )}
      </main>

      <footer className="app-footer">
        LearnLoop Phase 1 — Interactive Storyboard &amp; Speech Synthesis
      </footer>
    </div>
  )
}
