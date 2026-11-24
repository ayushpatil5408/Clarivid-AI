import React, { useState } from 'react'

export default function LessonForm({ onSubmit, loading }) {
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState('beginner')
  const [language, setLanguage] = useState('english')
  const [promptMode, setPromptMode] = useState('B')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!topic.trim()) return
    onSubmit({
      topic: topic.trim(),
      level,
      language,
      promptMode
    })
  }

  return (
    <div className="form-card">
      <h2>Generate Explainer Lesson</h2>
      <form onSubmit={handleSubmit} className="lesson-form">
        <div className="form-group">
          <label htmlFor="topic">Topic (max 100 characters)</label>
          <input
            id="topic"
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. TCP Three-Way Handshake, Photosynthesis"
            maxLength={100}
            required
            disabled={loading}
          />
          <small className="char-count">{topic.length}/100 characters</small>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="level">Difficulty Level</label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              disabled={loading}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="language">Language</label>
            <select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={loading}
            >
              <option value="english">English</option>
              <option value="hinglish">Hinglish</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="promptMode">Prompt Technique</label>
            <select
              id="promptMode"
              value={promptMode}
              onChange={(e) => setPromptMode(e.target.value)}
              disabled={loading}
            >
              <option value="B">Prompt B (Role + Few-shot, Recommended)</option>
              <option value="A">Prompt A (Zero-shot Baseline)</option>
            </select>
          </div>
        </div>

        <button type="submit" className="submit-btn" disabled={loading || !topic.trim()}>
          {loading ? 'Generating Storyboard...' : 'Generate Explainer'}
        </button>
      </form>
    </div>
  )
}
