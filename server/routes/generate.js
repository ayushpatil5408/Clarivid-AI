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

const FALLBACK_SULBA = JSON.parse(
  readFileSync(join(__dirname, '../fallback/lessons/sulba-sutras.json'), 'utf8')
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

function createSynthesizedLesson(topicTitle, level = 'beginner', language = 'english') {
  const cleanTitle = (topicTitle || 'Core Engineering Concept').trim().slice(0, 80)
  return {
    title: cleanTitle,
    language: language || 'english',
    level: level || 'beginner',
    scenes: [
      {
        id: 1,
        heading: `Introduction to ${cleanTitle}`,
        bullets: [
          `Foundational definition and core background of ${cleanTitle}`,
          `Primary motivations and essential concepts for ${level} learners`,
          `High-level architectural overview and basic terms`
        ],
        narration: `Welcome to this structured breakdown of ${cleanTitle}. We establish the foundational context, key definitions, and why understanding this concept is critical for your technical knowledge and exam preparation.`,
        visual_hint: `Architectural overview diagram showing the core principles and component hierarchy of ${cleanTitle}`,
        exam_tag: '2-mark definition',
        checkpoint: {
          q: `What is the primary foundation behind ${cleanTitle}?`,
          options: [
            `A structured, verifiable framework governing its core operations`,
            `Unrelated arbitrary historical conventions`,
            `An unverified experimental hypothesis`,
            `An isolated component with no external relationships`
          ],
          answer: 0
        }
      },
      {
        id: 2,
        heading: `Core Mechanics & State Flow of ${cleanTitle}`,
        bullets: [
          `Detailed examination of internal components and stages`,
          `Step-by-step state transitions and input processing`,
          `Key terminology, constraints, and relationships`
        ],
        narration: `Next, we examine the inner mechanism of ${cleanTitle}. Structured inputs move through sequential stages where each transformation preserves system invariants and produces verified state outputs.`,
        visual_hint: `Step-by-step workflow schematic illustrating the internal stages of ${cleanTitle}`,
        exam_tag: 'conceptual',
        checkpoint: {
          q: `How are state transitions processed within ${cleanTitle}?`,
          options: [
            `Sequentially across validated checkpoints according to defined rules`,
            `Without any verification or stage ordering`,
            `By resetting all prior inputs arbitrarily`,
            `Exclusively through manual external override`
          ],
          answer: 0
        }
      },
      {
        id: 3,
        heading: `Subsystem Interaction & Architectural Diagram`,
        bullets: [
          `Analysis of the critical execution path`,
          `Interactions between coordinating modules`,
          `Standard visual representation and diagrammatic breakdown`
        ],
        narration: `Tracing the technical architecture of ${cleanTitle} demonstrates how coordinating modules interact. Observing data and signal flow across the critical path highlights how stability and efficiency are guaranteed.`,
        visual_hint: `Technical block diagram mapping input-output channels and data flow for ${cleanTitle}`,
        exam_tag: '5-mark diagram',
        checkpoint: {
          q: `What is the primary benefit of the architectural flow in ${cleanTitle}?`,
          options: [
            `Ensuring coordinated, fault-resilient interactions between subsystems`,
            `Eliminating all need for error checking`,
            `Hiding how internal stages connect`,
            `Increasing unnecessary execution latency`
          ],
          answer: 0
        }
      },
      {
        id: 4,
        heading: `Practical Applications & Trade-Offs`,
        bullets: [
          `Real-world deployment scenarios and engineering analysis`,
          `Balancing precision, throughput, and complexity`,
          `Preventing common edge-case failures`
        ],
        narration: `In practical application, working with ${cleanTitle} requires balancing key trade-offs between complexity, resource utilization, and throughput. Mastering these boundaries ensures reliable real-world implementations.`,
        visual_hint: `Trade-off matrix and decision flow chart for implementing ${cleanTitle}`,
        exam_tag: 'numerical',
        checkpoint: {
          q: `Which trade-off is most crucial when implementing ${cleanTitle}?`,
          options: [
            `Balancing operational performance against resource constraints`,
            `Maximizing latency while reducing throughput`,
            `Disregarding known operational constraints`,
            `Assuming worst-case edge cases never happen`
          ],
          answer: 0
        }
      },
      {
        id: 5,
        heading: `Exam Synthesis & High-Yield Summary`,
        bullets: [
          `Consolidated review of core definitions, formulas, and diagrams`,
          `High-yield points for technical evaluations and examinations`,
          `Three-point recall framework for fast comprehension`
        ],
        narration: `To wrap up, remember our three-step mastery framework for ${cleanTitle}: articulate the primary definition, diagram the critical subsystem flow, and highlight the principal operational trade-offs.`,
        visual_hint: `High-yield exam summary card with key terms, formulas, and diagrams for ${cleanTitle}`,
        exam_tag: '2-mark definition',
        checkpoint: {
          q: `Which 3-point strategy best consolidates mastery of ${cleanTitle}?`,
          options: [
            `Articulate the definition, diagram the flow, and summarize the trade-offs`,
            `Memorize isolated keywords without understanding the flow`,
            `Rely solely on intuition without referencing standard models`,
            `Skip diagrammatic representations entirely`
          ],
          answer: 0
        }
      }
    ]
  }
}

function selectFallbackLesson(topic, level = 'beginner', language = 'english') {
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
  const sulbaKeywords = [
    'sulba',
    'vedic',
    'sanskrit',
    'baudhayana',
    'indian knowledge',
    'altar',
    'geometry',
    'rajju',
    'cord'
  ]
  const tcpKeywords = [
    'tcp',
    'handshake',
    'network',
    'packet',
    'syn',
    'socket',
    'ip',
    'layer',
    'osi',
    'protocol'
  ]

  if (photoKeywords.some((k) => t.includes(k))) {
    return {
      lesson: FALLBACK_PHOTOSYNTHESIS,
      topicName: 'Photosynthesis',
      fileKey: 'photosynthesis.json'
    }
  }

  if (sulbaKeywords.some((k) => t.includes(k))) {
    return {
      lesson: FALLBACK_SULBA,
      topicName: 'Indian Knowledge Systems: Sulba Sutras',
      fileKey: 'sulba-sutras.json'
    }
  }

  if (tcpKeywords.some((k) => t.includes(k))) {
    return {
      lesson: FALLBACK_TCP,
      topicName: 'TCP Three-Way Handshake',
      fileKey: 'tcp-handshake.json'
    }
  }

  const synthesized = createSynthesizedLesson(topic, level, language)
  return {
    lesson: synthesized,
    topicName: synthesized.title,
    fileKey: null
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
      const fallback = selectFallbackLesson(topic, level, language)
      const mockResult = {
        storyboard: normaliseIds(fallback.lesson),
        generationTimeMs: 45,
        promptMode,
        isValidJson: true,
        retried: false,
        complianceScore: 100,
        usedFallback: false,
        fallbackReason: null,
        fallbackTopic: null,
        fallbackKey: fallback.fileKey,
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
      'IMPORTANT SCHEMA REQUIREMENTS:\n' +
      '- Return ONLY valid JSON. No markdown fences. No commentary.\n' +
      '- The "scenes" array MUST contain between 5 and 7 scenes (minimum 5, maximum 7 scenes).\n' +
      '- Every scene must have an exam_tag in ["2-mark definition", "5-mark diagram", "numerical", "conceptual"].\n' +
      '- Every scene must include checkpoint with exactly 4 string options and a numeric answer (0-indexed: 0, 1, 2, or 3).\n' +
      '- Narration must not exceed 120 words per scene.'
    )
    const timeMs = Date.now() - start

    if (!valid) {
      const fallback = selectFallbackLesson(topic, level, language)
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
