import { Router } from 'express'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildPromptA } from '../prompts/promptA.js'
import { buildPromptB } from '../prompts/promptB.js'
import { buildCriticPrompt } from '../prompts/criticPrompt.js'
import { callGemini } from '../services/geminiClient.js'
import { validateStoryboard } from '../services/validator.js'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))
const EVALUATION_DIR = join(__dirname, '../evaluation')
const RESULTS_FILE = join(EVALUATION_DIR, 'results.json')

const FIXTURE_COMPARE = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/compare.json'), 'utf8')
)

function saveEvaluationResult(entry) {
  try {
    if (!existsSync(EVALUATION_DIR)) {
      mkdirSync(EVALUATION_DIR, { recursive: true })
    }
    let existing = []
    if (existsSync(RESULTS_FILE)) {
      try {
        existing = JSON.parse(readFileSync(RESULTS_FILE, 'utf8'))
        if (!Array.isArray(existing)) existing = []
      } catch {
        existing = []
      }
    }
    existing.push(entry)
    writeFileSync(RESULTS_FILE, JSON.stringify(existing, null, 2), 'utf8')
    console.log(`[Evaluation] Appended compare run to ${RESULTS_FILE}`)
  } catch (err) {
    console.error('[Evaluation] Failed to save result to evaluation/results.json:', err.message || err)
  }
}

function calculateAvgConfidence(audit) {
  if (!Array.isArray(audit) || audit.length === 0) return null
  const sum = audit.reduce((acc, curr) => acc + (typeof curr.confidence === 'number' ? curr.confidence : 0), 0)
  return Math.round(sum / audit.length)
}

function normaliseIds(storyboard) {
  if (!storyboard || !Array.isArray(storyboard.scenes)) return storyboard
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((s, i) => ({ ...s, id: i + 1 }))
  }
}

router.post('/', async (req, res, next) => {
  try {
    let { topic, level = 'beginner', language = 'english' } = req.body
    topic = typeof topic === 'string' ? topic.trim() : ''

    if (!topic) {
      return res.status(400).json({ error: 'topic is required' })
    }

    // 1. MOCK_AI=true mode: return fixture immediately
    if (process.env.MOCK_AI === 'true') {
      return res.json({
        ...FIXTURE_COMPARE,
        mockAi: true
      })
    }

    const params = { topic, level, language }
    const promptTextA = buildPromptA(params)
    const promptTextB = buildPromptB(params)

    // 2. Run generations in PARALLEL
    const generateSide = async (promptText) => {
      const t0 = Date.now()
      const raw = await callGemini(promptText)
      const duration = Date.now() - t0
      const validation = validateStoryboard(raw)
      return {
        storyboard: normaliseIds(raw),
        timeMs: duration,
        isValidJson: validation.valid,
        complianceScore: validation.complianceScore,
        scenesCount: Array.isArray(raw?.scenes) ? raw.scenes.length : 0
      }
    }

    const [resA, resB] = await Promise.allSettled([
      generateSide(promptTextA),
      generateSide(promptTextB)
    ])

    // Format side results
    const sideA = resA.status === 'fulfilled'
      ? {
          promptText: promptTextA,
          storyboard: resA.value.storyboard,
          metrics: {
            isValidJson: resA.value.isValidJson,
            complianceScore: resA.value.complianceScore,
            scenes: resA.value.scenesCount,
            avgConfidence: null,
            timeMs: resA.value.timeMs
          }
        }
      : {
          promptText: promptTextA,
          storyboard: null,
          metrics: null,
          error: resA.reason?.message || String(resA.reason)
        }

    const sideB = resB.status === 'fulfilled'
      ? {
          promptText: promptTextB,
          storyboard: resB.value.storyboard,
          metrics: {
            isValidJson: resB.value.isValidJson,
            complianceScore: resB.value.complianceScore,
            scenes: resB.value.scenesCount,
            avgConfidence: null,
            timeMs: resB.value.timeMs
          }
        }
      : {
          promptText: promptTextB,
          storyboard: null,
          metrics: null,
          error: resB.reason?.message || String(resB.reason)
        }

    // 3. Run audits SEQUENTIALLY to avoid rate-limit / quota spikes
    if (sideA.storyboard && Array.isArray(sideA.storyboard.scenes) && sideA.storyboard.scenes.length > 0) {
      try {
        const auditRawA = await callGemini(buildCriticPrompt(sideA.storyboard))
        const auditListA = Array.isArray(auditRawA) ? auditRawA : (auditRawA?.audit || [])
        sideA.metrics.avgConfidence = calculateAvgConfidence(auditListA)
        sideA.audit = auditListA
      } catch (err) {
        console.warn('Compare Audit A failed:', err.message || err)
      }
    }

    if (sideB.storyboard && Array.isArray(sideB.storyboard.scenes) && sideB.storyboard.scenes.length > 0) {
      try {
        const auditRawB = await callGemini(buildCriticPrompt(sideB.storyboard))
        const auditListB = Array.isArray(auditRawB) ? auditRawB : (auditRawB?.audit || [])
        sideB.metrics.avgConfidence = calculateAvgConfidence(auditListB)
        sideB.audit = auditListB
      } catch (err) {
        console.warn('Compare Audit B failed:', err.message || err)
      }
    }

    const responsePayload = {
      promptA: sideA,
      promptB: sideB
    }

    // 4. Append to evaluation/results.json
    saveEvaluationResult({
      timestamp: new Date().toISOString(),
      model: process.env.GEMINI_MODEL || 'unknown',
      topic,
      level,
      language,
      metrics: {
        promptA: sideA.metrics,
        promptB: sideB.metrics
      },
      outputs: {
        promptA: { promptText: sideA.promptText, storyboard: sideA.storyboard, error: sideA.error },
        promptB: { promptText: sideB.promptText, storyboard: sideB.storyboard, error: sideB.error }
      }
    })

    res.json(responsePayload)
  } catch (err) {
    next(err)
  }
})

export default router
