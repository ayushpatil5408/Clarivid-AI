import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildPromptA } from '../prompts/promptA.js'
import { buildPromptB } from '../prompts/promptB.js'
import { callWithRetry } from '../services/validator.js'

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
      topicName: 'Photosynthesis'
    }
  }

  return {
    lesson: FALLBACK_TCP,
    topicName: 'TCP Three-Way Handshake'
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

    const isFlawedDemo = demo === 'flawed' || req.query.demo === 'flawed'
    if (isFlawedDemo) {
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
        requestedTopic: topic || 'TCP Handshake'
      })
    }

    topic = typeof topic === 'string' ? topic.trim() : ''
    if (!topic) {
      return res.status(400).json({ error: 'topic is required' })
    }
    if (topic.length > 100) {
      return res.status(400).json({ error: 'topic must be 100 characters or fewer' })
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
      return res.json({
        storyboard: normaliseIds(fallback.lesson),
        generationTimeMs: timeMs,
        promptMode,
        isValidJson: false,
        retried,
        complianceScore,
        usedFallback: true,
        fallbackReason: failureReason || 'invalid_output',
        fallbackTopic: fallback.topicName,
        requestedTopic: topic
      })
    }

    res.json({
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
    })
  } catch (err) {
    next(err)
  }
})

export default router
