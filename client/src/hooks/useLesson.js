import { useState, useCallback, useEffect } from 'react'
import { generateLesson, auditLesson, checkHealth } from '../services/api'

export function useLesson() {
  const [storyboard, setStoryboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [usedFallback, setUsedFallback] = useState(false)
  const [fallbackReason, setFallbackReason] = useState(null)
  const [fallbackTopic, setFallbackTopic] = useState(null)
  const [requestedTopic, setRequestedTopic] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [mockAi, setMockAi] = useState(false)

  // Fact-audit states
  const [audit, setAudit] = useState([])
  const [auditing, setAuditing] = useState(false)

  // Dev demo helper: detect ?demo=flawed or ?demo=flawed-bio
  const demoParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('demo')
      : null

  const isFlawedTcp = demoParam === 'flawed'
  const isFlawedBio = demoParam === 'flawed-bio'

  // Check health on mount for MOCK_AI badge
  useEffect(() => {
    checkHealth()
      .then((res) => {
        if (res?.mockAi) setMockAi(true)
      })
      .catch(() => {})
  }, [])

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

      const demo = isFlawedBio ? 'flawed-bio' : isFlawedTcp ? 'flawed' : undefined
      const payload = { ...params, demo }

      let generatedStoryboard = null
      let fallbackKey = null

      try {
        // 1. Fetch storyboard and render immediately
        const data = await generateLesson(payload)
        generatedStoryboard = data.storyboard
        fallbackKey = data.fallbackKey || null
        if (data.mockAi) setMockAi(true)

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
          complianceScore: data.complianceScore,
          cached: data.cached
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
          const auditResult = await auditLesson(generatedStoryboard, fallbackKey)
          setAudit(Array.isArray(auditResult.audit) ? auditResult.audit : [])
        } catch (auditErr) {
          console.warn('Background fact-audit failed or was unavailable:', auditErr)
          // Keep audit as [] so neutral "Not audited" badge is shown without blocking the lesson
        } finally {
          setAuditing(false)
        }
      }
    },
    [isFlawedTcp, isFlawedBio]
  )

  // Auto-generate on load if ?demo=flawed or ?demo=flawed-bio is present
  useEffect(() => {
    if ((isFlawedTcp || isFlawedBio) && !storyboard && !loading) {
      generate({
        topic: isFlawedBio ? 'Photosynthesis' : 'TCP Three-Way Handshake',
        level: 'beginner',
        language: 'english',
        promptMode: 'B'
      })
    }
  }, [isFlawedTcp, isFlawedBio, storyboard, loading, generate])

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
    mockAi,
    generate
  }
}
