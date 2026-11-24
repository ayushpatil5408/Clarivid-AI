import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildPromptA } from '../prompts/promptA.js'
import { buildPromptB } from '../prompts/promptB.js'
import { callWithRetry } from '../services/validator.js'
import { generateCache, getGenerateCacheKey } from '../services/cache.js'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

const FALLBACK_TCP = JSON.parse(
  readFileSync(join(__dirname, '../fallback/lessons/tcp-handshake.json'), 'utf8')
)

const FALLBACK_PHOTOSYNTHESIS = JSON.parse(
  readFileSync(join(__dirname, '../fallback/lessons/photosynthesis.json'), 'utf8')
)

const FALLBACK_FLAWED = JSON.parse(
  readFileSync(join(__dirname, '../fallback/lessons/tcp-handshake-flawed.json'), 'utf8')
)

const FALLBACK_FLAWED_BIO = JSON.parse(
  readFileSync(join(__dirname, '../fallback/lessons/photosynthesis-flawed.json'), 'utf8')
)

const FIXTURE_GENERATE = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/generate.json'), 'utf8')
)

function selectFallbackLesson(topic) {
  const t = (topic || '').toLowerCase()
  const photoKeywords = [
    'photo',
    'plant',
    'chlorophyll',
    'leaf',
    'leaves',
    'calvin',
    'biology',
    'glucose',
    'sunlight'
  ]

  const isPhoto = photoKeywords.some((k) => t.includes(k))

  if (isPhoto) {
    return {
      lesson: FALLBACK_PHOTOSYNTHESIS,
      topicName: 'Photosynthesis',
      fileKey: 'photosynthesis.json'
    }
  }

  return {
    lesson: FALLBACK_TCP,
    topicName: 'TCP Three-Way Handshake',
    fileKey: 'tcp-handshake.json'
  }
}

function normaliseIds(storyboard) {
  if (!storyboard || !Array.isArray(storyboard.scenes)) {
    return storyboard
  }
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((s, i) => ({ ...s, id: i + 1 }))
  }
}

router.post('/', async (req, res, next) => {
  try {
    let { topic, level = 'beginner', language = 'english', promptMode = 'B', demo } = req.body
    const isRefresh = req.query.refresh === '1' || req.body.refresh === true

    // Dev demo routes
    const isFlawedTcp = demo === 'flawed' || req.query.demo === 'flawed'
    if (isFlawedTcp) {
      return res.json({
        storyboard: normaliseIds(FALLBACK_FLAWED),
        generationTimeMs: 15,
        promptMode,
        isValidJson: true,
        retried: false,
        complianceScore: 100,
        usedFallback: true,
        fallbackReason: 'flawed_demo',
        fallbackTopic: 'TCP Three-Way Handshake (Flawed Demo)',
        fallbackKey: 'tcp-handshake-flawed.json',
        requestedTopic: topic || 'TCP Handshake'
      })
    }

    const isFlawedBio = demo === 'flawed-bio' || req.query.demo === 'flawed-bio'
    if (isFlawedBio) {
      return res.json({
        storyboard: normaliseIds(FALLBACK_FLAWED_BIO),
        generationTimeMs: 15,
        promptMode,
        isValidJson: true,
        retried: false,
        complianceScore: 100,
        usedFallback: true,
        fallbackReason: 'flawed_bio_demo',
        fallbackTopic: 'Photosynthesis (Flawed Demo)',
        fallbackKey: 'photosynthesis-flawed.json',
        requestedTopic: topic || 'Photosynthesis'
      })
    }

    topic = typeof topic === 'string' ? topic.trim() : ''
    if (!topic) {
      return res.status(400).json({ error: 'topic is required' })
    }
    if (topic.length > 100) {
      return res.status(400).json({ error: 'topic must be 100 characters or fewer' })
    }

    // 1. MOCK_AI=true mode: never reach callGemini
    if (process.env.MOCK_AI === 'true') {
      const mockResult = {
        storyboard: normaliseIds(FIXTURE_GENERATE),
        generationTimeMs: 45,
        promptMode,
        isValidJson: true,
        retried: false,
        complianceScore: 100,
        usedFallback: false,
        fallbackReason: null,
        fallbackTopic: null,
        requestedTopic: topic,
        mockAi: true
      }
      return res.json(mockResult)
    }

    // 2. In-memory cache check (bypass with ?refresh=1)
    const cacheKey = getGenerateCacheKey(topic, level, language, promptMode)
    if (!isRefresh && generateCache.has(cacheKey)) {
      console.log(`[Cache] Serving cached generate for key: ${cacheKey}`)
      return res.json({ ...generateCache.get(cacheKey), cached: true })
    }

    const params = { topic, level, language }
    const promptFn = promptMode === 'A'
      ? () => buildPromptA(params)
      : () => buildPromptB(params)

    const start = Date.now()
    const { data, retried, valid, complianceScore, failureReason } = await callWithRetry(
      promptFn,
      'IMPORTANT: Return ONLY valid JSON. No markdown fences. No commentary. ' +
      'Every scene must have an exam_tag in ["2-mark definition", "5-mark diagram", "numerical", "conceptual"]. ' +
      'Every scene must include checkpoint with exactly 4 string options and a numeric answer (0-indexed). ' +
      'Narration must not exceed 120 words.'
    )
    const timeMs = Date.now() - start

    if (!valid) {
      const fallback = selectFallbackLesson(topic)
      const fallbackResponse = {
        storyboard: normaliseIds(fallback.lesson),
        generationTimeMs: timeMs,
        promptMode,
        isValidJson: false,
        retried,
        complianceScore,
        usedFallback: true,
        fallbackReason: failureReason || 'invalid_output',
        fallbackTopic: fallback.topicName,
        fallbackKey: fallback.fileKey,
        requestedTopic: topic
      }
      return res.json(fallbackResponse)
    }

    const successResponse = {
      storyboard: normaliseIds(data),
      generationTimeMs: timeMs,
      promptMode,
      isValidJson: true,
      retried,
      complianceScore,
      usedFallback: false,
      fallbackReason: null,
      fallbackTopic: null,
      requestedTopic: topic
    }

    // Cache successful generation
    generateCache.set(cacheKey, successResponse)

    res.json(successResponse)
  } catch (err) {
    next(err)
  }
})

export default router
