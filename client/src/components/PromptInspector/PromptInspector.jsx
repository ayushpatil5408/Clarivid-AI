import React, { useState } from 'react'
import { comparePrompts } from '../../services/api'
import MetricsTable from './MetricsTable'
import JsonViewer from './JsonViewer'
import Spinner from '../common/Spinner'
import ErrorBanner from '../common/ErrorBanner'

export default function PromptInspector({ mockAi }) {
  const [topic, setTopic] = useState('TCP Three-Way Handshake')
  const [level, setLevel] = useState('beginner')
  const [language, setLanguage] = useState('english')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const handleCompare = async (e) => {
    e.preventDefault()
    if (!topic.trim()) return

    setLoading(true)
    setError(null)
    try {
      const data = await comparePrompts({ topic: topic.trim(), level, language })
      setResult(data)
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const isMock = Boolean(mockAi || result?.mockAi)

  return (
    <div className="prompt-inspector">
      <div className="inspector-header">
        <h2 className="inspector-title">🔬 Prompt Engineering Inspector</h2>
        <p className="inspector-subtitle">
          Compare Zero-shot (Prompt A) against Role + Few-shot + Schema-constrained (Prompt B) head-to-head.
        </p>
        {isMock && (
          <div className="mock-notice-banner">
            ⚠️ <strong>Illustrative mock numbers, not real results.</strong> (MOCK_AI mode is active)
          </div>
        )}
      </div>

      <form className="inspector-form" onSubmit={handleCompare}>
        <div className="form-group">
          <label htmlFor="compare-topic">Topic to Compare</label>
          <input
            id="compare-topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Photosynthesis, Binary Search, TCP"
            maxLength={100}
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="compare-level">Student Level</label>
            <select id="compare-level" value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="compare-lang">Language</label>
            <select id="compare-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="english">English</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? 'Evaluating A vs B in Parallel...' : '⚡ Compare Prompts A vs B'}
        </button>
      </form>

      {loading && <Spinner message="Generating with Prompt A and Prompt B in parallel, then auditing..." />}
      {error && <ErrorBanner message={error} onRetry={handleCompare} />}

      {result && !loading && (
        <div className="comparison-results">
          {/* Metrics comparison table */}
          <MetricsTable metricsA={result.promptA?.metrics} metricsB={result.promptB?.metrics} />

          {/* Side by side outputs */}
          <div className="comparison-grid">
            {/* Prompt A Column */}
            <div className="comparison-column">
              <div className="column-badge badge-a">Prompt A (Zero-shot Baseline)</div>

              <div className="raw-prompt-box">
                <h4>Raw Prompt Text</h4>
                <pre>
                  <code>{result.promptA?.promptText || 'No prompt text'}</code>
                </pre>
              </div>

              {result.promptA?.error ? (
                <div className="side-error">
                  ❌ Prompt A failed: {result.promptA.error}
                </div>
              ) : (
                <JsonViewer title="Storyboard Output A" data={result.promptA?.storyboard} />
              )}
            </div>

            {/* Prompt B Column */}
            <div className="comparison-column">
              <div className="column-badge badge-b">Prompt B (Few-shot + Schema Constrained)</div>

              <div className="raw-prompt-box">
                <h4>Raw Prompt Text</h4>
                <pre>
                  <code>{result.promptB?.promptText || 'No prompt text'}</code>
                </pre>
              </div>

              {result.promptB?.error ? (
                <div className="side-error">
                  ❌ Prompt B failed: {result.promptB.error}
                </div>
              ) : (
                <JsonViewer title="Storyboard Output B" data={result.promptB?.storyboard} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
