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
  'sulba-sutras.json': JSON.parse(
    readFileSync(join(__dirname, '../fallback/audits/sulba-sutras.json'), 'utf8')
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

const BUNDLED_FALLBACK_TITLES = new Set([
  'TCP Three-Way Handshake',
  'Photosynthesis: The Plant Energy Engine',
  'Indian Knowledge Systems: Sulba Sutras',
  'TCP Three-Way Handshake (Flawed Demo)',
  'Photosynthesis: The Plant Energy Engine (Flawed Demo)'
])

function matchPrecomputedAudit(storyboard, fallbackKey, forceLive) {
  if (forceLive) return null

  // Only allow precomputed audit for bundled fallback lessons
  const title = (storyboard?.title || '').trim()
  const isBundled = Boolean(fallbackKey) || BUNDLED_FALLBACK_TITLES.has(title)
  if (!isBundled) return null

  if (fallbackKey && PRECOMPUTED_AUDITS[fallbackKey]) {
    return PRECOMPUTED_AUDITS[fallbackKey]
  }

  const lowerTitle = title.toLowerCase()
  if (lowerTitle.includes('tcp') && lowerTitle.includes('flawed')) {
    return PRECOMPUTED_AUDITS['tcp-handshake-flawed.json']
  }
  if (lowerTitle.includes('photo') && lowerTitle.includes('flawed')) {
    return PRECOMPUTED_AUDITS['photosynthesis-flawed.json']
  }
  if (lowerTitle.includes('sulba') || lowerTitle.includes('vedic')) {
    return PRECOMPUTED_AUDITS['sulba-sutras.json']
  }
  if (lowerTitle.includes('tcp') && lowerTitle.includes('handshake')) {
    return PRECOMPUTED_AUDITS['tcp-handshake.json']
  }
  if (lowerTitle.includes('photo')) {
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
    const forceLive = req.query.audit === 'live' || req.body.audit === 'live'
    const isRefresh = req.query.refresh === '1' || req.body.refresh === true

    if (!storyboard || !Array.isArray(storyboard.scenes) || storyboard.scenes.length === 0) {
      return res.status(400).json({ error: 'Valid storyboard with scenes array is required' })
    }

    // 1. MOCK_AI=true mode: return fixture immediately
    if (process.env.MOCK_AI === 'true') {
      return res.json({
        audit: FIXTURE_AUDIT,
        source: 'mock',
        mockAi: true
      })
    }

    // 2. Precomputed fallback audit check: strictly for bundled fallback lessons
    const precomputed = matchPrecomputedAudit(storyboard, fallbackKey, forceLive)
    if (precomputed) {
      console.log('[Audit] Serving precomputed audit for bundled fallback lesson')
      return res.json({
        audit: precomputed,
        source: 'precomputed',
        precomputed: true
      })
    }

    // 3. In-memory cache check (keyed on hash of storyboard, bypass with ?refresh=1)
    const hash = getStoryboardHash(storyboard)
    if (!isRefresh && auditCache.has(hash)) {
      console.log(`[Cache] Serving cached audit for hash: ${hash.slice(0, 10)}...`)
      return res.json({
        audit: auditCache.get(hash),
        source: 'live',
        cached: true
      })
    }

    // 4. Live Gemini call
    const prompt = buildCriticPrompt(storyboard)
    const raw = await callGemini(prompt)
    const audit = extractAuditArray(raw)

    // Store in cache
    auditCache.set(hash, audit)

    res.json({
      audit,
      source: 'live'
    })
  } catch (err) {
    console.error('Audit endpoint error:', err.message || err)
    next(err)
  }
})

export default router
