import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildReexplainPrompt } from '../prompts/reexplainPrompt.js'
import { callGemini } from '../services/geminiClient.js'
import { validateScene } from '../services/validator.js'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

const FIXTURE_REEXPLAIN = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/reexplain.json'), 'utf8')
)

router.post('/', async (req, res, next) => {
  try {
    const { scene, language = 'english', reason = 'wrong_answer' } = req.body

    if (!scene || typeof scene !== 'object') {
      return res.status(400).json({ error: 'Valid scene object is required in body' })
    }

    // 1. MOCK_AI=true mode: return fixture with scene id preserved
    if (process.env.MOCK_AI === 'true') {
      return res.json({
        simpler_scene: {
          ...FIXTURE_REEXPLAIN.simpler_scene,
          id: scene.id || 1
        },
        mockAi: true
      })
    }

    // 2. Real Gemini AI call
    const prompt = buildReexplainPrompt({ scene, language, reason })
    const raw = await callGemini(prompt)

    const candidate = raw?.simpler_scene || raw
    if (!candidate || typeof candidate !== 'object') {
      return res.status(502).json({
        error: 'AI returned empty or invalid scene structure',
        original: scene
      })
    }

    // Preserve original scene id
    candidate.id = scene.id ?? candidate.id ?? 1

    // 3. Validate against storyboard scene rules
    const validation = validateScene(candidate)
    if (!validation.valid) {
      console.warn('[Reexplain] Generated scene failed validation:', validation.error)
      return res.status(422).json({
        error: 'Re-explained scene failed schema validation',
        details: validation.error,
        original: scene
      })
    }

    res.json({ simpler_scene: candidate })
  } catch (err) {
    console.error('Re-explain endpoint error:', err.message || err)
    next(err)
  }
})

export default router
