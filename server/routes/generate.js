import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildPromptA } from '../prompts/promptA.js'
import { buildPromptB } from '../prompts/promptB.js'
import { callWithRetry } from '../services/validator.js'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

const FALLBACK = JSON.parse(
  readFileSync(join(__dirname, '../fallback/lessons/tcp-handshake.json'), 'utf8')
)

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
    let { topic, level = 'beginner', language = 'english', promptMode = 'B' } = req.body

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
    const { data, retried, valid, complianceScore } = await callWithRetry(
      promptFn,
      'IMPORTANT: Return ONLY valid JSON. No markdown fences. No commentary. ' +
      'Every scene must have an exam_tag in ["2-mark definition", "5-mark diagram", "numerical", "conceptual"]. ' +
      'Every scene must include checkpoint with exactly 4 string options and a numeric answer (0-indexed). ' +
      'Narration must not exceed 120 words.'
    )
    const timeMs = Date.now() - start

    if (!valid) {
      return res.json({
        storyboard: normaliseIds(FALLBACK),
        generationTimeMs: timeMs,
        promptMode,
        isValidJson: false,
        retried,
        complianceScore,
        usedFallback: true
      })
    }

    res.json({
      storyboard: normaliseIds(data),
      generationTimeMs: timeMs,
      promptMode,
      isValidJson: true,
      retried,
      complianceScore,
      usedFallback: false
    })
  } catch (err) {
    next(err)
  }
})

export default router
