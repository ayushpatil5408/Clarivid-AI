import { Router } from 'express'
import { buildCriticPrompt } from '../prompts/criticPrompt.js'
import { callGemini } from '../services/geminiClient.js'

const router = Router()

function extractAuditArray(raw) {
  if (Array.isArray(raw)) return raw
  if (raw && Array.isArray(raw.audit)) return raw.audit
  if (raw && Array.isArray(raw.scenes)) return raw.scenes
  if (raw && typeof raw === 'object' && ('confidence' in raw || 'scene_id' in raw)) {
    return [raw]
  }
  return []
}

router.post('/', async (req, res, next) => {
  try {
    const storyboard = req.body.storyboard || req.body
    if (!storyboard || !Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) {
      return res.status(400).json({ error: 'Valid storyboard with scenes array is required' })
    }

    const prompt = buildCriticPrompt(storyboard)
    const raw = await callGemini(prompt)
    const audit = extractAuditArray(raw)

    res.json({ audit })
  } catch (err) {
    console.error('Audit endpoint error:', err.message || err)
    next(err)
  }
})

export default router
