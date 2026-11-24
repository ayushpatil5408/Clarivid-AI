import { useState, useEffect, useCallback } from 'react'
import { reexplainScene } from '../services/api'

export function useQuiz({
  currentScene,
  currentIndex,
  nextScene,
  totalScenes,
  language = 'english',
  onReplaceNextScene
}) {
  const [selectedOption, setSelectedOption] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [isCorrect, setIsCorrect] = useState(null)
  const [reexplaining, setReexplaining] = useState(false)
  const [toast, setToast] = useState(null)

  // Reset quiz state whenever scene navigation occurs
  useEffect(() => {
    setSelectedOption(null)
    setSubmitted(false)
    setIsCorrect(null)
    setReexplaining(false)
    setToast(null)
  }, [currentIndex, currentScene?.id])

  const submitAnswer = useCallback(
    async (optionIndex) => {
      if (submitted || !currentScene?.checkpoint) return

      setSelectedOption(optionIndex)
      setSubmitted(true)

      const correctAnswer = currentScene.checkpoint.answer
      const correct = optionIndex === correctAnswer
      setIsCorrect(correct)

      if (correct) {
        setToast({
          type: 'success',
          message: '🎉 Correct! Great job mastering this checkpoint.'
        })
        return
      }

      // Wrong answer handling
      const isLastScene = currentIndex >= totalScenes - 1

      if (isLastScene || !nextScene) {
        // Last scene: show feedback only, no re-explain call
        setToast({
          type: 'info',
          message: 'Incorrect answer. Review the summary bullet points above to solidify the concept.'
        })
        return
      }

      // Non-last scene: call /api/reexplain for the NEXT scene
      setReexplaining(true)
      setToast({
        type: 'info',
        message: 'Adapting the next scene with a simpler analogy...'
      })

      try {
        const data = await reexplainScene({
          scene: nextScene,
          language,
          reason: 'wrong_answer'
        })

        const simpler = data.simpler_scene
        if (simpler && typeof simpler === 'object') {
          // Pass to parent to replace next scene and re-audit
          if (onReplaceNextScene) {
            await onReplaceNextScene(currentIndex + 1, simpler)
          }
          setToast({
            type: 'info',
            message: `💡 Next scene (${nextScene.heading}) was adapted with an intuitive analogy to help clarify!`
          })
        } else {
          setToast({
            type: 'error',
            message: 'Could not adapt next scene; keeping original explanation.'
          })
        }
      } catch (err) {
        console.warn('Re-explain failed:', err)
        // Friendly error, keep original scene untouched
        setToast({
          type: 'error',
          message: 'AI re-explainer was unavailable; continuing with original lesson.'
        })
      } finally {
        setReexplaining(false)
      }
    },
    [submitted, currentScene, currentIndex, nextScene, totalScenes, language, onReplaceNextScene]
  )

  const clearToast = useCallback(() => setToast(null), [])

  return {
    selectedOption,
    submitted,
    isCorrect,
    reexplaining,
    toast,
    submitAnswer,
    clearToast
  }
}
