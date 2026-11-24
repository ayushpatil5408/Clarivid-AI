import { Router } from 'express'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildCriticPrompt } from '../prompts/criticPrompt.js'
import { callGemini } from '../services/geminiClient.js'
import { auditCache, getStoryboardHash } from '../services/cache.js'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

const PRECOMPUTED_AUDITS = {
  'tcp-handshake.json': JSON.parse(
    readFileSync(join(__dirname, '../fallback/audits/tcp-handshake.json'), 'utf8')
  ),
  'photosynthesis.json': JSON.parse(
    readFileSync(join(__dirname, '../fallback/audits/photosynthesis.json'), 'utf8')
  ),
  'tcp-handshake-flawed.json': JSON.parse(
    readFileSync(join(__dirname, '../fallback/audits/tcp-handshake-flawed.json'), 'utf8')
  ),
  'photosynthesis-flawed.json': JSON.parse(
    readFileSync(join(__dirname, '../fallback/audits/photosynthesis-flawed.json'), 'utf8')
  )
}

const FIXTURE_AUDIT = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/audit.json'), 'utf8')
)

function matchPrecomputedAudit(storyboard, fallbackKey) {
  if (fallbackKey && PRECOMPUTED_AUDITS[fallbackKey]) {
    return PRECOMPUTED_AUDITS[fallbackKey]
  }

  const title = (storyboard.title || '').toLowerCase()
  if (title.includes('tcp') && title.includes('flawed')) {
    return PRECOMPUTED_AUDITS['tcp-handshake-flawed.json']
  }
  if (title.includes('photo') && title.includes('flawed')) {
    return PRECOMPUTED_AUDITS['photosynthesis-flawed.json']
  }
  if (title.includes('tcp') && title.includes('handshake')) {
    return PRECOMPUTED_AUDITS['tcp-handshake.json']
  }
  if (title.includes('photo')) {
    return PRECOMPUTED_AUDITS['photosynthesis.json']
  }

  return null
}

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
    const fallbackKey = req.body.fallbackKey
    const isRefresh = req.query.refresh === '1' || req.body.refresh === true

    if (!storyboard || !Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) {
      return res.status(400).json({ error: 'Valid storyboard with scenes array is required' })
    }

    // 1. MOCK_AI=true mode: return fixture immediately
    if (process.env.MOCK_AI === 'true') {
      return res.json({ audit: FIXTURE_AUDIT, mockAi: true })
    }

    // 2. Precomputed fallback audit check: zero API calls for fallback/demo lessons
    const precomputed = matchPrecomputedAudit(storyboard, fallbackKey)
    if (precomputed) {
      console.log('[Audit] Serving precomputed audit for fallback lesson')
      return res.json({ audit: precomputed, precomputed: true })
    }

    // 3. In-memory cache check (keyed on hash of storyboard, bypass with ?refresh=1)
    const hash = getStoryboardHash(storyboard)
    if (!isRefresh && auditCache.has(hash)) {
      console.log(`[Cache] Serving cached audit for hash: ${hash.slice(0, 10)}...`)
      return res.json({ audit: auditCache.get(hash), cached: true })
    }

    // 4. Live Gemini call
    const prompt = buildCriticPrompt(storyboard)
    const raw = await callGemini(prompt)
    const audit = extractAuditArray(raw)

    // Store in cache
    auditCache.set(hash, audit)

    res.json({ audit })
  } catch (err) {
    console.error('Audit endpoint error:', err.message || err)
    next(err)
  }
})

export default router
