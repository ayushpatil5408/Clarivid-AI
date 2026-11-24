import { useState, useCallback } from 'react'
import { generateLesson } from '../services/api'

export function useLesson() {
  const [storyboard, setStoryboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [usedFallback, setUsedFallback] = useState(false)
  const [fallbackReason, setFallbackReason] = useState(null)
  const [fallbackTopic, setFallbackTopic] = useState(null)
  const [requestedTopic, setRequestedTopic] = useState(null)
  const [metrics, setMetrics] = useState(null)

  const generate = useCallback(async (params) => {
    setLoading(true)
    setError(null)
    setUsedFallback(false)
    setFallbackReason(null)
    setFallbackTopic(null)
    setRequestedTopic(null)

    try {
      const data = await generateLesson(params)
      setStoryboard(data.storyboard)
      setUsedFallback(Boolean(data.usedFallback))
      setFallbackReason(data.fallbackReason || null)
      setFallbackTopic(data.fallbackTopic || null)
      setRequestedTopic(data.requestedTopic || params.topic)
      setMetrics({
        generationTimeMs: data.generationTimeMs,
        promptMode: data.promptMode,
        isValidJson: data.isValidJson,
        retried: data.retried,
        complianceScore: data.complianceScore
      })
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Failed to generate lesson'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    storyboard,
    loading,
    error,
    usedFallback,
    fallbackReason,
    fallbackTopic,
    requestedTopic,
    metrics,
    generate
  }
}
