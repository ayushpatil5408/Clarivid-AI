import React from 'react'
import { useQuiz } from '../../hooks/useQuiz'
import ReExplainToast from './ReExplainToast'

export default function CheckpointQuiz({
  scene,
  currentIndex,
  nextScene,
  totalScenes,
  language = 'english',
  onReplaceNextScene,
  onNext
}) {
  const checkpoint = scene?.checkpoint
  if (!checkpoint || !Array.isArray(checkpoint.options) || checkpoint.options.length !== 4) {
    return null
  }

  const {
    selectedOption,
    submitted,
    isCorrect,
    reexplaining,
    toast,
    submitAnswer,
    clearToast
  } = useQuiz({
    currentScene: scene,
    currentIndex,
    nextScene,
    totalScenes,
    language,
    onReplaceNextScene
  })

  return (
    <div className="checkpoint-quiz-card">
      <div className="quiz-header">
        <span className="quiz-badge">🎯 Checkpoint Question</span>
        <h4 className="quiz-question">{checkpoint.q}</h4>
      </div>

      <div className="quiz-options-grid" role="group" aria-label="Quiz answer options">
        {checkpoint.options.map((option, idx) => {
          let btnClass = 'quiz-option-btn'
          if (submitted) {
            if (idx === checkpoint.answer) {
              btnClass += ' option-correct'
            } else if (idx === selectedOption) {
              btnClass += ' option-wrong'
            } else {
              btnClass += ' option-disabled'
            }
          }

          return (
            <button
              key={idx}
              type="button"
              className={btnClass}
              onClick={() => submitAnswer(idx)}
              disabled={submitted || reexplaining}
              aria-label={`Option ${String.fromCharCode(65 + idx)}: ${option}`}
            >
              <span className="option-index">
                {String.fromCharCode(65 + idx)}.
              </span>
              <span className="option-text">{option}</span>
            </button>
          )
        })}
      </div>

      {submitted && (
        <div className={`quiz-feedback-box ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`}>
          <div className="feedback-content">
            {isCorrect ? (
              <p>
                <strong>✅ Correct!</strong> You nailed this checkpoint.
              </p>
            ) : (
              <p>
                <strong>❌ Not quite.</strong> The correct answer was{' '}
                <strong>
                  {String.fromCharCode(65 + checkpoint.answer)}. {checkpoint.options[checkpoint.answer]}
                </strong>
                .
              </p>
            )}
          </div>
          {onNext && currentIndex < totalScenes - 1 && (
            <button type="button" className="quiz-continue-btn" onClick={onNext}>
              Continue to Next Scene ➔
            </button>
          )}
        </div>
      )}

      {/* Floating/docked re-explainer toast */}
      <ReExplainToast toast={toast} onClose={clearToast} />
    </div>
  )
}
