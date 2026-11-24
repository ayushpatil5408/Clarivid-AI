import { useState, useCallback, useEffect } from 'react'
import { generateLesson, auditLesson } from '../services/api'

export function useLesson() {
  const [storyboard, setStoryboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [usedFallback, setUsedFallback] = useState(false)
  const [fallbackReason, setFallbackReason] = useState(null)
  const [fallbackTopic, setFallbackTopic] = useState(null)
  const [requestedTopic, setRequestedTopic] = useState(null)
  const [metrics, setMetrics] = useState(null)

  // Fact-audit states
  const [audit, setAudit] = useState([])
  const [auditing, setAuditing] = useState(false)

  // Dev demo helper: detect ?demo=flawed in URL
  const isFlawedDemoRequested =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('demo') === 'flawed'

  const generate = useCallback(
    async (params) => {
      setLoading(true)
      setError(null)
      setUsedFallback(false)
      setFallbackReason(null)
      setFallbackTopic(null)
      setRequestedTopic(null)
      setAudit([])
      setAuditing(false)

      const payload = {
        ...params,
        demo: isFlawedDemoRequested ? 'flawed' : undefined
      }

      let generatedStoryboard = null

      try {
        // 1. Fetch storyboard and render immediately
        const data = await generateLesson(payload)
        generatedStoryboard = data.storyboard
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

      // 2. Run fact-audit in background if storyboard was returned
      if (generatedStoryboard && generatedStoryboard.scenes?.length > 0) {
        setAuditing(true)
        try {
          const auditResult = await auditLesson(generatedStoryboard)
          setAudit(Array.isArray(auditResult.audit) ? auditResult.audit : [])
        } catch (auditErr) {
          console.warn('Background fact-audit failed or was unavailable:', auditErr)
          // Keep audit as [] so neutral "Not audited" badge is shown without blocking the lesson
        } finally {
          setAuditing(false)
        }
      }
    },
    [isFlawedDemoRequested]
  )

  // Auto-generate on load if ?demo=flawed is present
  useEffect(() => {
    if (isFlawedDemoRequested && !storyboard && !loading) {
      generate({
        topic: 'TCP Three-Way Handshake',
        level: 'beginner',
        language: 'english',
        promptMode: 'B'
      })
    }
  }, [isFlawedDemoRequested, storyboard, loading, generate])

  return {
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
    generate
  }
}
