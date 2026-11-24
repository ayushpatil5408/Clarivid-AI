# Clarivid — Implementation Guide

> **Version:** 1.1  
> **Date:** November 2026  
> **Stack:** Vite + React · Node.js + Express · Google Gemini API (`@google/genai`) · Web Speech API

---

## 1. Project Structure

```
Clarivid/
├── client/                   # Vite + React frontend
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── LessonForm/
│   │   │   ├── ScenePlayer/
│   │   │   ├── Quiz/
│   │   │   ├── PromptInspector/
│   │   │   └── common/
│   │   ├── hooks/
│   │   │   ├── useLesson.js
│   │   │   ├── useSpeech.js
│   │   │   └── useQuiz.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── utils/
│   │   │   ├── schemaValidator.js
│   │   │   └── examTagColors.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
│
├── server/                   # Node.js + Express backend
│   ├── routes/
│   │   ├── generate.js
│   │   ├── audit.js
│   │   ├── compare.js
│   │   ├── reexplain.js
│   │   └── ask.js
│   ├── prompts/
│   │   ├── promptA.js
│   │   ├── promptB.js
│   │   ├── criticPrompt.js
│   │   └── reexplainPrompt.js
│   ├── services/
│   │   ├── geminiClient.js
│   │   └── validator.js
│   ├── middleware/
│   │   ├── errorHandler.js
│   │   └── requestLogger.js
│   ├── fallback/lessons/
│   │   ├── tcp-handshake.json
│   │   └── photosynthesis.json
│   ├── .env                # GEMINI_API_KEY, GEMINI_MODEL, PORT (never sent to client)
│   ├── .env.example        # Committed template with placeholder values
│   ├── package.json        # Must include "type": "module"
│   └── index.js
│
├── PROBLEM_STATEMENT.md
├── architecture.md
└── implementation.md
```

---

## 2. Environment Setup

### 2.1 Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- A Google Gemini API key (from [Google AI Studio](https://aistudio.google.com))

### 2.2 Install Dependencies

```bash
# Backend
cd server
npm install express cors dotenv @google/genai express-rate-limit

# Frontend
cd ../client
npm install
# React, Vite, and axios are included in the Vite template
npm install axios
```

### 2.3 Environment Variables

Create `server/.env` (copy from `server/.env.example` and fill in your values):

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.0-flash
PORT=3001
```

Create `server/.env.example` (commit this file):

```env
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash
PORT=3001
```

> **Never** commit `.env` to version control. Add it to `.gitignore`.

### 2.4 `server/package.json` — ESM module type

Add `"type": "module"` so all `.js` files in the server are treated as ESM:

```json
{
  "name": "clarivid-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.19.0",
    "cors": "^2.8.5",
    "@google/genai": "^1.0.0",
    "express-rate-limit": "^7.0.0"
  }
}
```

### 2.4 Vite Proxy (dev only)

In `client/vite.config.js`, proxy `/api` to the Express server so the browser never needs CORS headers during development:

```js
// client/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

---

## 3. Backend Implementation

### 3.1 Express Entry Point (`server/index.js`)

```js
// MUST be the very first line — ESM hoisting loads geminiClient.js
// before dotenv.config() if placed later.
import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import generateRoute from './routes/generate.js'
import auditRoute from './routes/audit.js'
import compareRoute from './routes/compare.js'
import reexplainRoute from './routes/reexplain.js'
import askRoute from './routes/ask.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'

const app = express()
app.use(cors())
app.use(express.json())
app.use(requestLogger)

// Rate limiting — applied to all /api routes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
})
app.use('/api', limiter)

app.use('/api/generate', generateRoute)
app.use('/api/audit', auditRoute)
app.use('/api/compare', compareRoute)
app.use('/api/reexplain', reexplainRoute)
app.use('/api/ask', askRoute)

app.use(errorHandler)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`Clarivid server running on :${PORT}`))
```

---

### 3.2 Gemini Client (`server/services/geminiClient.js`)

```js
import { GoogleGenAI } from '@google/genai'

const CALL_TIMEOUT_MS = 45000 // 45 seconds per-call timeout
const RETRY_DELAYS = [1500, 3000] // Exponential backoff: 1.5s, then 3s

// Quota Exhaustion vs Transient Error Classification
export function isQuotaExhaustedError(err) {
  if (!err) return false
  const status = err.status || err.code || err.statusCode
  const msg = String(err.message || '').toLowerCase()
  let rawStr = ''
  try { rawStr = JSON.stringify(err).toLowerCase() } catch { rawStr = msg }

  const retryDelaySecMatch = rawStr.match(/retrydelay["']?\s*:\s*["']?(\d+)/i)
  if (retryDelaySecMatch && parseInt(retryDelaySecMatch[1], 10) > 60) return true

  if (
    msg.includes('per day') ||
    msg.includes('perday') ||
    msg.includes('requests per day') ||
    rawStr.includes('perday') ||
    rawStr.includes('per_day') ||
    (msg.includes('exceeded your current quota') && (msg.includes('retry in') || msg.includes('limit exceeded')))
  ) {
    return true
  }
  return false
}

export function isTransientError(err) {
  if (!err) return false
  if (isQuotaExhaustedError(err)) return false

  const status = err.status || err.code || err.statusCode
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) return true

  const msg = String(err.message || '').toLowerCase()
  const code = String(err.code || '').toLowerCase()
  if (
    code === 'etimedout' || code === 'econnreset' || code === 'econnrefused' ||
    code === 'aborterror' || err.isTimeout ||
    msg.includes('timeout') || msg.includes('timed out') ||
    msg.includes('high demand') || msg.includes('temporarily unavailable') || msg.includes('503')
  ) {
    return true
  }
  return false
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function withTimeout(promise, ms) {
  let timer
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Gemini call timed out after ${ms / 1000}s`)
      err.code = 'ETIMEDOUT'
      err.isTimeout = true
      err.status = 504
      reject(err)
    }, ms)
  })

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise
  ])
}

async function executeSingleCall(ai, model, prompt) {
  const response = await withTimeout(
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    }),
    CALL_TIMEOUT_MS
  )

  const text = response.text
  return JSON.parse(text)
}

export async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY
  const primaryModel = process.env.GEMINI_MODEL
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL

  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY environment variable is missing')
    err.status = 401
    throw err
  }
  if (!primaryModel) {
    const err = new Error('GEMINI_MODEL environment variable is missing')
    err.status = 400
    throw err
  }

  const ai = new GoogleGenAI({ apiKey })
  let lastError

  // Primary model: 1 initial call + up to 2 retries on transient errors (max 3 attempts)
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`[Gemini] Model: ${primaryModel} | Attempt: ${attempt}/3`)
    try {
      const result = await executeSingleCall(ai, primaryModel, prompt)
      return result
    } catch (err) {
      lastError = err
      const transient = isTransientError(err)
      console.error(
        `[Gemini] Model: ${primaryModel} | Attempt ${attempt} failed: ${err.message || err} | Transient: ${transient}`
      )

      if (!transient) {
        // Permanent error (400, 401, 403, 404): do not retry
        throw err
      }

      if (attempt <= 2) {
        const delay = RETRY_DELAYS[attempt - 1]
        console.log(`[Gemini] Backoff delay: waiting ${delay}ms before attempt ${attempt + 1}...`)
        await sleep(delay)
      }
    }
  }

  // If primary model failed with transient error after all retries, try fallback model if set
  if (fallbackModel && fallbackModel !== primaryModel) {
    console.log(`[Gemini] Primary model failed after retries. Trying fallback model: ${fallbackModel} (attempt 1/1)`)
    try {
      const result = await executeSingleCall(ai, fallbackModel, prompt)
      return result
    } catch (err) {
      console.error(`[Gemini] Fallback model ${fallbackModel} failed: ${err.message || err}`)
      lastError = err
    }
  }

  throw lastError
}
```

---

### 3.3 Schema Validator + Retry (`server/services/validator.js`)

```js
const ALLOWED_EXAM_TAGS = new Set([
  '2-mark definition', '5-mark diagram', 'numerical', 'conceptual'
])

/**
 * Validates the storyboard and returns a compliance score (0-100).
 *
 * Returns:
 *   { valid: boolean, error?: string, complianceScore: number, data?: object }
 *
 * complianceScore = percentage of scenes that pass ALL per-scene checks.
 * valid = true only when every scene passes (complianceScore === 100) AND
 *         the top-level structure is correct.
 */
export function validateStoryboard(obj) {
  if (!obj || typeof obj !== 'object')
    return { valid: false, error: 'Not an object', complianceScore: 0 }
  if (!Array.isArray(obj.scenes) || obj.scenes.length < 5 || obj.scenes.length > 7)
    return { valid: false, error: 'scenes array must contain between 5 and 7 scenes', complianceScore: 0 }

  let passing = 0
  for (const scene of obj.scenes) {
    // Required fields: id, heading, narration, visual_hint
    if (!scene.id || !scene.heading || !scene.narration || !scene.visual_hint) continue
    // exam_tag allowlist
    if (!ALLOWED_EXAM_TAGS.has(scene.exam_tag)) continue
    // checkpoint options exactly 4
    if (!scene.checkpoint || !Array.isArray(scene.checkpoint.options) ||
        scene.checkpoint.options.length !== 4) continue
    // numeric answer
    if (typeof scene.checkpoint.answer !== 'number') continue
    // narration word count ≤ 120
    if (scene.narration.trim().split(/\s+/).length > 120) continue
    passing++
  }

  const complianceScore = Math.round((passing / obj.scenes.length) * 100)
  const valid = passing === obj.scenes.length

  if (!valid)
    return { valid: false, error: `${obj.scenes.length - passing} scene(s) failed validation`, complianceScore }

  return { valid: true, data: obj, complianceScore }
}

/**
 * Wraps a Gemini call with one automatic retry for schema/JSON validation failures.
 * Note: Transient API errors (429, 503, timeout) are already retried inside callGemini.
 * Returns failureReason: 'api_busy' | 'invalid_output' | 'api_error'.
 */
export async function callWithRetry(promptFn, retryInstructions) {
  const { callGemini, isTransientError } = await import('./geminiClient.js')

  let result
  let validation
  let retried = false
  let failureReason = null

  // 1. Initial generation call (carries internal transient error retries)
  try {
    result = await callGemini(promptFn())
    validation = validateStoryboard(result)
  } catch (err) {
    console.error('Validation flow: Initial Gemini call failed:', err.message || err)
    validation = { valid: false, error: String(err), complianceScore: 0 }
    failureReason = isTransientError(err) ? 'api_busy' : 'api_error'
  }

  // 2. Separate schema-validation retry (max 1 retry) if parsing or schema failed
  if (!validation.valid) {
    retried = true
    try {
      result = await callGemini(promptFn() + '\n\n' + retryInstructions)
      validation = validateStoryboard(result)
      if (!validation.valid) {
        failureReason = 'invalid_output'
      } else {
        failureReason = null
      }
    } catch (err) {
      console.error('Validation flow: Validation retry Gemini call failed:', err.message || err)
      validation = { valid: false, error: String(err), complianceScore: 0 }
      failureReason = isTransientError(err) ? 'api_busy' : 'api_error'
    }
  }

  return {
    data: validation.valid ? result : null,
    retried,
    valid: validation.valid,
    complianceScore: validation.complianceScore ?? 0,
    failureReason: validation.valid ? null : (failureReason || 'invalid_output')
  }
}
```

---

### 3.4 Prompt Builders

#### Prompt A — Zero-Shot (`server/prompts/promptA.js`)

```js
export function buildPromptA({ topic, level, language }) {
  // Topic injected inside delimiters to prevent prompt injection
  return `Generate a lesson storyboard about <<<TOPIC>>>${topic}<<<END_TOPIC>>> for ${level} level students in ${language}.
Return valid JSON with this structure:
{ "title": "", "language": "${language}", "level": "${level}", "scenes": [ { "id": 1, "heading": "", "bullets": [], "narration": "", "visual_hint": "", "exam_tag": "", "checkpoint": { "q": "", "options": ["", "", "", ""], "answer": 0 } } ] }`
}
```

#### Prompt B — Role-Based, Few-Shot, Schema-Constrained (`server/prompts/promptB.js`)

```js
const EXAMPLE_SCENE = {
  id: 1,
  heading: 'What is a handshake?',
  bullets: ['Two devices agree before talking', 'Uses SYN, SYN-ACK, ACK'],
  narration: 'Socho do log phone par baat shuru karne se pehle confirm karte hain ki dono ready hain — exactly aisa hi TCP karta hai.',
  visual_hint: 'Diagram of client and server exchanging three arrows labelled SYN, SYN-ACK, ACK',
  exam_tag: '2-mark definition',
  checkpoint: { q: 'Which flag does the client send first?', options: ['ACK', 'SYN', 'FIN', 'RST'], answer: 1 }
}

export function buildPromptB({ topic, level, language }) {
  return `You are an experienced B.Tech professor who creates concise, exam-focused lesson storyboards.

TASK: Generate a storyboard of 5-7 scenes about <<<TOPIC>>>${topic}<<<END_TOPIC>>> for ${level} students in ${language}.

LANGUAGE RULES:
- If language is "hinglish": write narration as natural code-mixed Hindi-English (not a translation). Use Devanagari sparingly; prefer Roman Hinglish.
- If language is "english": use clear, formal but friendly English.

CONSTRAINTS:
- Narration per scene: maximum 120 words
- exam_tag must be one of: "2-mark definition", "5-mark diagram", "numerical", "conceptual"
- Every scene must have a checkpoint with exactly 4 options
- Output must be valid JSON only — no markdown fences, no commentary

JSON SCHEMA:
{
  "title": "string",
  "language": "string",
  "level": "string",
  "scenes": [
    {
      "id": "number",
      "heading": "string",
      "bullets": ["string"],
      "narration": "string",
      "visual_hint": "string",
      "exam_tag": "string",
      "checkpoint": { "q": "string", "options": ["string"], "answer": "number" }
    }
  ]
}

EXAMPLE SCENE:
${JSON.stringify(EXAMPLE_SCENE, null, 2)}

Now generate the full storyboard for topic: <<<TOPIC>>>${topic}<<<END_TOPIC>>>\`
}
```

#### Critic Prompt (`server/prompts/criticPrompt.js`)

```js
export function buildCriticPrompt(storyboard) {
  return `You are a rigorous, multi-disciplinary academic fact-checker.
Review each scene of the following educational lesson storyboard for factual correctness, accuracy of definitions, formulas, and technical integrity.

VERIFICATION INSTRUCTIONS:
1. Carefully analyze each factual claim, definition, scientific law, historical statement, and mathematical/chemical formula across the scene's heading, bullets, narration, and checkpoint question/options.
2. Cross-examine claims against established academic standards, textbook definitions, scientific consensus, and official specifications.
3. If a scene contains any factual error, false claim, incorrect formula, wrong step in a process, or invalid checkpoint answer:
   - Assign a confidence score strictly below 70 (in the 0 to 69 range).
   - Detail every identified error clearly in the "issues" array.
   - Provide an accurate, factual correction in "corrected_text".
4. If a scene is fully correct, precise, and verified:
   - Assign a confidence score between 90 and 100, set "issues" to [], and "corrected_text" to null.
5. If a scene has minor ambiguity or non-critical omission:
   - Assign a confidence score between 70 and 89.

AUDIT SCHEMA: Return ONLY a valid JSON array where each element corresponds to one scene:
[
  {
    "scene_id": number,
    "confidence": number, // integer 0-100 (strictly < 70 if any factual error is present)
    "issues": [string],   // list of specific factual errors, gaps, or inaccuracies (empty [] if none)
    "corrected_text": string | null // corrected explanation/narration if errors found, otherwise null
  }
]

Storyboard to audit:
${JSON.stringify(storyboard, null, 2)}

Return ONLY the JSON array matching the AUDIT SCHEMA. No markdown fences. No commentary.`
}
```

#### Re-Explainer Prompt (`server/prompts/reexplainPrompt.js`)

```js
export function buildReexplainPrompt(scene, language) {
  return `A student answered the checkpoint quiz for the following scene INCORRECTLY.
Rewrite this scene using a simpler analogy and plainer language so it is easier to understand.
Keep the same JSON schema shape. Language: ${language}.

Original scene:
${JSON.stringify(scene, null, 2)}

Return only the rewritten scene as valid JSON.`
}
```

---

### 3.5 Route Handlers

#### Generate (`server/routes/generate.js`)

```js
import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildPromptA } from '../prompts/promptA.js'
import { buildPromptB } from '../prompts/promptB.js'
import { callWithRetry } from '../services/validator.js'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

// Load fallback lessons with fs.readFileSync (import assertions are not portable)
const FALLBACK_TCP = JSON.parse(
  readFileSync(join(__dirname, '../fallback/lessons/tcp-handshake.json'), 'utf8')
)

const FALLBACK_PHOTOSYNTHESIS = JSON.parse(
  readFileSync(join(__dirname, '../fallback/lessons/photosynthesis.json'), 'utf8')
)

function selectFallbackLesson(topic) {
  const t = (topic || '').toLowerCase()
  const photoKeywords = ['photo', 'plant', 'chlorophyll', 'leaf', 'calvin', 'biology', 'glucose']
  if (photoKeywords.some(k => t.includes(k))) {
    return { lesson: FALLBACK_PHOTOSYNTHESIS, topicName: 'Photosynthesis' }
  }
  return { lesson: FALLBACK_TCP, topicName: 'TCP Three-Way Handshake' }
}

// Helper: normalise scene ids to 1..n
function normaliseIds(storyboard) {
  return {
    ...storyboard,
    scenes: storyboard.scenes.map((s, i) => ({ ...s, id: i + 1 }))
  }
}

router.post('/', async (req, res, next) => {
  try {
    let { topic, level = 'beginner', language = 'english', promptMode = 'B' } = req.body

    // Input validation
    topic = typeof topic === 'string' ? topic.trim() : ''
    if (!topic) return res.status(400).json({ error: 'topic is required' })
    if (topic.length > 100) return res.status(400).json({ error: 'topic must be 100 characters or fewer' })

    const params = { topic, level, language }
    const promptFn = promptMode === 'A'
      ? () => buildPromptA(params)
      : () => buildPromptB(params)

    const start = Date.now()
    const { data, retried, valid, complianceScore, failureReason } = await callWithRetry(
      promptFn,
      'IMPORTANT: Return ONLY valid JSON. No markdown. No commentary. ' +
      'Every scene must have exactly 4 options in checkpoint. ' +
      'exam_tag must be one of: "2-mark definition", "5-mark diagram", "numerical", "conceptual". ' +
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
```

#### Audit (`server/routes/audit.js`)

```js
import { Router } from 'express'
import { buildCriticPrompt } from '../prompts/criticPrompt.js'
import { callGemini } from '../services/geminiClient.js'

const router = Router()

// Normalise whatever the LLM returns into a plain array
function extractAuditArray(raw) {
  if (Array.isArray(raw)) return raw
  if (raw && Array.isArray(raw.audit)) return raw.audit
  return [raw]
}

router.post('/', async (req, res, next) => {
  try {
    const { storyboard } = req.body
    if (!storyboard) return res.status(400).json({ error: 'storyboard is required' })

    const prompt = buildCriticPrompt(storyboard)
    const raw = await callGemini(prompt)
    const audit = extractAuditArray(raw)

    res.json({ audit })
  } catch (err) {
    next(err)
  }
})

export default router
```

#### Compare (`server/routes/compare.js`)

```js
import { Router } from 'express'
import { buildPromptA } from '../prompts/promptA.js'
import { buildPromptB } from '../prompts/promptB.js'
import { callGemini } from '../services/geminiClient.js'
import { validateStoryboard } from '../services/validator.js'
import { buildCriticPrompt } from '../prompts/criticPrompt.js'

const router = Router()

function extractAuditArray(raw) {
  if (Array.isArray(raw)) return raw
  if (raw && Array.isArray(raw.audit)) return raw.audit
  return []
}

// Generate storyboard and measure time (no audit yet)
async function generateAndMeasure(promptText) {
  const start = Date.now()
  let storyboard = null
  let isValidJson = false
  let complianceScore = 0

  try {
    storyboard = await callGemini(promptText)
    const v = validateStoryboard(storyboard)
    isValidJson = v.valid
    complianceScore = v.complianceScore ?? 0
  } catch (_) {}

  return { promptText, storyboard, isValidJson, complianceScore, timeMs: Date.now() - start }
}

// Run audit separately (called sequentially to avoid rate-limit spikes)
async function runAudit(storyboard) {
  if (!storyboard) return { avgConfidence: null }
  try {
    const raw = await callGemini(buildCriticPrompt(storyboard))
    const scores = extractAuditArray(raw).map(a => a.confidence).filter(Number.isFinite)
    const avgConfidence = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null
    return { avgConfidence }
  } catch (_) {
    return { avgConfidence: null }
  }
}

router.post('/', async (req, res, next) => {
  try {
    let { topic, level = 'beginner', language = 'english' } = req.body
    topic = typeof topic === 'string' ? topic.trim() : ''
    if (!topic) return res.status(400).json({ error: 'topic is required' })
    if (topic.length > 100) return res.status(400).json({ error: 'topic must be 100 characters or fewer' })

    const params = { topic, level, language }

    // Generations run in PARALLEL
    const [genA, genB] = await Promise.all([
      generateAndMeasure(buildPromptA(params)),
      generateAndMeasure(buildPromptB(params))
    ])

    // Audits run SEQUENTIALLY to avoid rate-limit spikes
    const auditA = await runAudit(genA.isValidJson ? genA.storyboard : null)
    const auditB = await runAudit(genB.isValidJson ? genB.storyboard : null)

    res.json({
      promptA: {
        promptText: genA.promptText,
        storyboard: genA.storyboard,
        metrics: {
          isValidJson: genA.isValidJson,
          scenes: genA.storyboard?.scenes?.length ?? 0,
          avgConfidence: auditA.avgConfidence,
          complianceScore: genA.complianceScore,
          timeMs: genA.timeMs
        }
      },
      promptB: {
        promptText: genB.promptText,
        storyboard: genB.storyboard,
        metrics: {
          isValidJson: genB.isValidJson,
          scenes: genB.storyboard?.scenes?.length ?? 0,
          avgConfidence: auditB.avgConfidence,
          complianceScore: genB.complianceScore,
          timeMs: genB.timeMs
        }
      }
    })
  } catch (err) {
    next(err)
  }
})

export default router
```

#### Re-Explain (`server/routes/reexplain.js`)

```js
import { Router } from 'express'
import { buildReexplainPrompt } from '../prompts/reexplainPrompt.js'
import { callGemini } from '../services/geminiClient.js'

const router = Router()

router.post('/', async (req, res, next) => {
  try {
    // Request body: { scene, language, reason }
    const { scene, language = 'english', reason = 'wrong_answer' } = req.body
    if (!scene) return res.status(400).json({ error: 'scene is required' })

    const prompt = buildReexplainPrompt(scene, language, reason)
    const simpler_scene = await callGemini(prompt)

    res.json({ simpler_scene })
  } catch (err) {
    next(err)
  }
})

export default router
```

#### Ask (`server/routes/ask.js`) — Stub until Phase 6

```js
import { Router } from 'express'

const router = Router()

// Stretch feature: not implemented until Phase 6.
// Returns 501 Not Implemented so the frontend can handle it gracefully.
router.post('/', (_req, res) => {
  res.status(501).json({ error: 'Pause and Ask is not yet implemented (Phase 6 stretch feature).' })
})

export default router
```

---

## 4. Frontend Implementation

### 4.1 API Service (`client/src/services/api.js`)

```js
import axios from 'axios'

const BASE = '/api'

export const generateLesson = (payload) =>
  axios.post(`${BASE}/generate`, payload).then(r => r.data)

export const auditLesson = (storyboard) =>
  axios.post(`${BASE}/audit`, { storyboard }).then(r => r.data)

export const comparePrompts = (payload) =>
  axios.post(`${BASE}/compare`, payload).then(r => r.data)

export const reexplainScene = (scene, language, reason = 'wrong_answer') =>
  axios.post(`${BASE}/reexplain`, { scene, language, reason }).then(r => r.data)

export const askQuestion = (question, context_scene) =>
  axios.post(`${BASE}/ask`, { question, context_scene }).then(r => r.data)
```

---

### 4.2 `useLesson` Hook

```js
// client/src/hooks/useLesson.js
import { useState } from 'react'
import { generateLesson, auditLesson } from '../services/api'

export function useLesson() {
  const [storyboard, setStoryboard] = useState(null)
  const [audit, setAudit] = useState([])
  const [auditing, setAuditing] = useState(false)   // true while audit is in flight
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [usedFallback, setUsedFallback] = useState(false)

  async function generate(params) {
    setLoading(true)
    setError(null)
    setAudit([])
    setUsedFallback(false)

    try {
      // 1. Get storyboard immediately and render it
      const genResult = await generateLesson(params)
      setStoryboard(genResult.storyboard)
      setUsedFallback(!!genResult.usedFallback)
      setMetrics({
        timeMs: genResult.generationTimeMs,
        promptMode: genResult.promptMode,
        isValidJson: genResult.isValidJson,
        complianceScore: genResult.complianceScore
      })
      setLoading(false)

      // 2. Fire audit asynchronously — badges appear when it resolves
      setAuditing(true)
      try {
        const auditResult = await auditLesson(genResult.storyboard)
        setAudit(auditResult.audit)
      } catch (_) {
        // Audit failure is non-fatal; leave audit as []
      } finally {
        setAuditing(false)
      }
    } catch (e) {
      setError(e.message)
      setLoading(false)
    }
  }

  return { storyboard, setStoryboard, audit, setAudit, auditing, loading, error, metrics, usedFallback, generate }
}
```

---

### 4.3 `useSpeech` Hook

```js
// client/src/hooks/useSpeech.js
import { useRef, useState, useEffect } from 'react'

// Use 'en-IN' for Roman-script Hinglish (not 'hi-IN').
// Defined as a constant here so it can be changed in one place if needed.
const HINGLISH_LANG = 'en-IN'

function getVoice(lang) {
  return window.speechSynthesis.getVoices().find(v => v.lang === lang) || null
}

export function useSpeech(language = 'english') {
  const [speaking, setSpeaking] = useState(false)
  const [voicesReady, setVoicesReady] = useState(false)
  const utteranceRef = useRef(null)

  // Wait for the browser's voice list to populate before first speak
  useEffect(() => {
    function onVoicesChanged() { setVoicesReady(true) }
    if (window.speechSynthesis.getVoices().length > 0) {
      setVoicesReady(true)
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged)
      return () => window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged)
    }
  }, [])

  useEffect(() => {
    return () => window.speechSynthesis.cancel()
  }, [])

  function speak(text) {
    if (!voicesReady) return  // voices not loaded yet; silently skip
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    const lang = language === 'hinglish' ? HINGLISH_LANG : 'en-US'
    utterance.lang = lang
    utterance.voice = getVoice(lang)
    utterance.rate = 0.9

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  function pause() { window.speechSynthesis.pause(); setSpeaking(false) }
  function resume() { window.speechSynthesis.resume(); setSpeaking(true) }
  function stop() { window.speechSynthesis.cancel(); setSpeaking(false) }

  return { speaking, voicesReady, speak, pause, resume, stop }
}
```

---

### 4.4 `useQuiz` Hook

```js
// client/src/hooks/useQuiz.js
import { useState } from 'react'
import { reexplainScene, auditLesson } from '../services/api'

export function useQuiz(storyboard, setStoryboard, audit, setAudit, language) {
  const [quizResult, setQuizResult] = useState(null) // 'correct' | 'wrong'
  const [reexplaining, setReexplaining] = useState(false)

  async function submitAnswer(scene, selectedIndex, nextSceneIndex) {
    const isCorrect = selectedIndex === scene.checkpoint.answer
    setQuizResult(isCorrect ? 'correct' : 'wrong')

    if (!isCorrect && nextSceneIndex < storyboard.scenes.length) {
      setReexplaining(true)
      try {
        const { simpler_scene } = await reexplainScene(scene, language, 'wrong_answer')
        const updatedScenes = [...storyboard.scenes]
        // Preserve the original scene id
        updatedScenes[nextSceneIndex] = {
          ...simpler_scene,
          id: storyboard.scenes[nextSceneIndex].id
        }
        setStoryboard({ ...storyboard, scenes: updatedScenes })

        // Drop the stale audit entry for the replaced scene so a stale badge
        // is not shown. Then re-audit just that scene in the background.
        const replacedId = storyboard.scenes[nextSceneIndex].id
        setAudit(prev => prev.filter(a => a.scene_id !== replacedId))

        // Re-audit the replaced scene asynchronously
        try {
          const freshAudit = await auditLesson({ ...storyboard, scenes: [simpler_scene] })
          if (freshAudit.audit?.length) {
            setAudit(prev => [
              ...prev.filter(a => a.scene_id !== replacedId),
              { ...freshAudit.audit[0], scene_id: replacedId }
            ])
          }
        } catch (_) { /* re-audit failure is non-fatal */ }
      } finally {
        setReexplaining(false)
      }
    }
  }

  function clearResult() { setQuizResult(null) }

  return { quizResult, reexplaining, submitAnswer, clearResult }
}
```

---

### 4.5 Key UI Components

#### `LessonForm` — Topic input

```jsx
// client/src/components/LessonForm/LessonForm.jsx
import { useState } from 'react'

export default function LessonForm({ onSubmit, loading }) {
  const [topic, setTopic] = useState('')
  const [level, setLevel] = useState('beginner')
  const [language, setLanguage] = useState('english')
  const [promptMode, setPromptMode] = useState('B')

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit({ topic, level, language, promptMode }) }}>
      <input
        value={topic}
        onChange={e => setTopic(e.target.value)}
        placeholder="Enter topic (e.g. TCP Three-Way Handshake)"
        required
      />
      <select value={level} onChange={e => setLevel(e.target.value)}>
        <option value="beginner">Beginner</option>
        <option value="intermediate">Intermediate</option>
        <option value="advanced">Advanced</option>
      </select>
      <select value={language} onChange={e => setLanguage(e.target.value)}>
        <option value="english">English</option>
        <option value="hinglish">Hinglish</option>
      </select>
      <select value={promptMode} onChange={e => setPromptMode(e.target.value)}>
        <option value="B">Prompt B (Role + Few-shot)</option>
        <option value="A">Prompt A (Zero-shot)</option>
      </select>
      <button type="submit" disabled={loading}>
        {loading ? 'Generating…' : 'Generate Lesson'}
      </button>
    </form>
  )
}
```

#### `AuditBadge` — Confidence indicator

```jsx
// client/src/components/ScenePlayer/AuditBadge.jsx

// When auditing=true, shows a spinner instead of the badge.
// When no auditEntry exists after auditing, shows nothing.
export default function AuditBadge({ auditEntry, auditing }) {
  if (auditing) {
    return <div className="audit-badge audit-badge--auditing">🔍 Auditing…</div>
  }
  if (!auditEntry) return null

  const { confidence, issues } = auditEntry
  const band = confidence >= 90 ? 'green' : confidence >= 70 ? 'yellow' : 'red'
  const label = confidence >= 90 ? '✅ High confidence' : confidence >= 70 ? '⚠️ Moderate' : '❌ Low confidence'

  return (
    <div className={`audit-badge audit-badge--${band}`}>
      <span>{label} ({confidence}/100)</span>
      {issues?.length > 0 && (
        <ul className="audit-issues">
          {issues.map((issue, i) => <li key={i}>{issue}</li>)}
        </ul>
      )}
    </div>
  )
}
```

#### `ScenePlayer` — Main lesson renderer

```jsx
// client/src/components/ScenePlayer/ScenePlayer.jsx
import { useState } from 'react'
import SceneSlide from './SceneSlide'
import AuditBadge from './AuditBadge'
import NarrationBar from './NarrationBar'
import ProgressBar from './ProgressBar'
import CheckpointQuiz from '../Quiz/CheckpointQuiz'
import { useSpeech } from '../../hooks/useSpeech'
import { useQuiz } from '../../hooks/useQuiz'

export default function ScenePlayer({
  storyboard, setStoryboard,
  audit, setAudit,
  auditing, usedFallback,
  fallbackReason, fallbackTopic, requestedTopic,
  language
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const { speaking, speak, stop } = useSpeech(language)
  const { quizResult, reexplaining, submitAnswer, clearResult } =
    useQuiz(storyboard, setStoryboard, audit, setAudit, language)

  const scene = storyboard.scenes[currentIndex]

  // Match audit entry by scene_id; fall back to index position
  const auditEntry =
    audit?.find(a => a.scene_id === scene.id) ??
    audit?.[currentIndex] ??
    null

  function goNext() { stop(); clearResult(); setCurrentIndex(i => Math.min(i + 1, storyboard.scenes.length - 1)) }
  function goPrev() { stop(); clearResult(); setCurrentIndex(i => Math.max(i - 1, 0)) }

  const getFallbackMessage = () => {
    switch (fallbackReason) {
      case 'api_busy': return 'The AI service is busy right now, so we loaded a demo lesson. Try again in a minute.'
      case 'invalid_output': return 'The AI generated an invalid lesson format after retrying, so we loaded a pre-validated demo lesson.'
      case 'api_error': default: return 'Could not connect to the AI service, so we loaded a demo lesson.'
    }
  }

  const isDifferentTopic =
    fallbackTopic && requestedTopic &&
    !requestedTopic.toLowerCase().includes(fallbackTopic.toLowerCase()) &&
    !fallbackTopic.toLowerCase().includes(requestedTopic.toLowerCase())

  return (
    <div className="scene-player">
      {usedFallback && (
        <div className="fallback-banner" role="alert">
          <div>⚠️ {getFallbackMessage()}</div>
          {isDifferentTopic && (
            <small>Showing demo on <strong>{fallbackTopic}</strong> instead of "{requestedTopic}".</small>
          )}
        </div>
      )}

      <ProgressBar current={currentIndex + 1} total={storyboard.scenes.length} />

      <SceneSlide scene={scene} />

      <AuditBadge auditEntry={auditEntry} auditing={auditing} />

      <NarrationBar
        speaking={speaking}
        onPlay={() => speak(scene.narration)}
        onStop={stop}
      />

      {scene.checkpoint && !quizResult && (
        <CheckpointQuiz
          checkpoint={scene.checkpoint}
          onSubmit={(idx) => submitAnswer(scene, idx, currentIndex + 1)}
        />
      )}

      {quizResult && (
        <div className={`quiz-result quiz-result--${quizResult}`}>
          {quizResult === 'correct'
            ? '🎉 Correct!'
            : reexplaining
              ? '🔄 Simplifying next scene…'
              : '❌ Incorrect. Next scene has been simplified for you.'}
        </div>
      )}

      <div className="player-controls">
        <button onClick={goPrev} disabled={currentIndex === 0}>← Prev</button>
        <button onClick={goNext} disabled={currentIndex === storyboard.scenes.length - 1}>Next →</button>
      </div>
    </div>
  )
}
```

#### `PromptInspector` — Side-by-side comparison

```jsx
// client/src/components/PromptInspector/PromptInspector.jsx
import { useState } from 'react'
import { comparePrompts } from '../../services/api'
import MetricsTable from './MetricsTable'

// Collapsible JSON viewer component
function JsonViewer({ data, label }) {
  const [open, setOpen] = useState(false)
  if (!data) return null
  return (
    <div className="json-viewer">
      <button className="json-viewer__toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▼' : '▶'} {label}
      </button>
      {open && (
        <pre className="json-viewer__content">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function PromptInspector({ topic, level, language }) {
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      const data = await comparePrompts({ topic, level, language })
      setResults(data)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="prompt-inspector">
      <button onClick={run} disabled={loading || !topic}>
        {loading ? 'Comparing…' : '🔬 Compare Prompt A vs B'}
      </button>

      {results && (
        <div className="inspector-columns">
          <div className="inspector-col">
            <h3>Prompt A — Zero-Shot</h3>
            <pre>{results.promptA.promptText}</pre>
            <MetricsTable metrics={results.promptA.metrics} />
            <JsonViewer data={results.promptA.storyboard} label="View storyboard JSON" />
          </div>
          <div className="inspector-col">
            <h3>Prompt B — Role + Few-Shot</h3>
            <pre>{results.promptB.promptText}</pre>
            <MetricsTable metrics={results.promptB.metrics} />
            <JsonViewer data={results.promptB.storyboard} label="View storyboard JSON" />
          </div>
        </div>
      )}
    </div>
  )
}
```

```jsx
// client/src/components/PromptInspector/MetricsTable.jsx
export default function MetricsTable({ metrics }) {
  return (
    <table className="metrics-table">
      <tbody>
        <tr><th>Valid JSON</th><td>{metrics.isValidJson ? '✅ Yes' : '❌ No'}</td></tr>
        <tr><th>Scenes</th><td>{metrics.scenes}</td></tr>
        <tr><th>Avg Confidence</th><td>{metrics.avgConfidence ?? 'N/A'}</td></tr>
        <tr><th>Compliance Score</th><td>{metrics.complianceScore != null ? `${metrics.complianceScore}/100` : 'N/A'}</td></tr>
        <tr><th>Time</th><td>{metrics.timeMs} ms</td></tr>
      </tbody>
    </table>
  )
}
```

---

### 4.6 `App.jsx` — Top-Level Composition

```jsx
// client/src/App.jsx
import { useState } from 'react'
import LessonForm from './components/LessonForm/LessonForm'
import ScenePlayer from './components/ScenePlayer/ScenePlayer'
import PromptInspector from './components/PromptInspector/PromptInspector'
import { useLesson } from './hooks/useLesson'

export default function App() {
  const {
    storyboard, setStoryboard,
    audit, setAudit,
    auditing, loading, error, metrics, usedFallback,
    generate
  } = useLesson()
  const [formParams, setFormParams] = useState(null)

  function handleSubmit(params) {
    setFormParams(params)
    generate(params)
  }

  return (
    <div className="app">
      <header>
        <h1>🎓 Clarivid</h1>
        <p>Interactive, fact-audited AI explainer lessons</p>
      </header>

      <LessonForm onSubmit={handleSubmit} loading={loading} />

      {error && <div className="error-banner">Error: {error}</div>}

      {storyboard && (
        <>
          <ScenePlayer
            storyboard={storyboard}
            setStoryboard={setStoryboard}
            audit={audit}
            setAudit={setAudit}
            auditing={auditing}
            usedFallback={usedFallback}
            language={formParams?.language}
          />
          <PromptInspector
            topic={formParams?.topic}
            level={formParams?.level}
            language={formParams?.language}
          />
        </>
      )}
    </div>
  )
}
```

---

## 5. Build & Run

### Development

```bash
# Terminal 1 — Backend
cd server
node index.js          # or: npx nodemon index.js

# Terminal 2 — Frontend
cd client
npm run dev            # Vite dev server on :5173, proxies /api to :3001
```

Open: `http://localhost:5173`

### Production Build

```bash
cd client
npm run build          # Outputs to client/dist/

# Serve static files from Express
# In server/index.js, add:
# import { fileURLToPath } from 'url'
# import path from 'path'
# const __dirname = path.dirname(fileURLToPath(import.meta.url))
# app.use(express.static(path.join(__dirname, '../client/dist')))
```

---

## 6. Implementation Phases

### Phase 1 — Vertical Slice (Core E2E) ✦ Build First

| Task | File(s) |
|---|---|
| `server/package.json` with `"type": "module"` | `server/package.json` |
| `server/.env.example` with `GEMINI_API_KEY`, `GEMINI_MODEL`, `PORT` | `server/.env.example` |
| Express server with `import 'dotenv/config'` as first line; rate limiter on `/api` | `server/index.js` |
| Gemini client using `@google/genai`, model from `GEMINI_MODEL` env var | `server/services/geminiClient.js` |
| Schema validator with compliance score + 1 retry (catches JSON.parse errors) | `server/services/validator.js` |
| `/api/generate` with topic trim/length guard, id normalisation, fs.readFileSync fallback | `routes/generate.js` |
| `/api/ask` stub returning 501 | `routes/ask.js` |
| `LessonForm` → API call → console log storyboard | `client/src/components/LessonForm`, `services/api.js` |
| Basic `ScenePlayer` (heading + bullets + prev/next) | `client/src/components/ScenePlayer` |
| `useSpeech` with `en-IN` Hinglish constant + `voiceschanged` wait | `client/src/hooks/useSpeech.js` |

---

### Phase 2 — Fact Audit & Badges

| Task | File(s) |
|---|---|
| `/api/audit` route + critic prompt; normalise bare-array/wrapped response | `routes/audit.js`, `prompts/criticPrompt.js` |
| Async audit in `useLesson` (storyboard shown immediately; badges appear after audit) | `hooks/useLesson.js` |
| `AuditBadge` with "Auditing…" spinner + colour bands; fallback banner in `ScenePlayer` | `components/ScenePlayer/AuditBadge.jsx`, `ScenePlayer.jsx` |
| Client matches audit entry by `scene_id` with index fallback | `components/ScenePlayer/ScenePlayer.jsx` |

---

### Phase 3 — Hinglish + Exam Tags

| Task | File(s) |
|---|---|
| Hinglish prompt rules in Prompt B; topic inside delimiters in both prompts | `prompts/promptB.js`, `prompts/promptA.js` |
| `en-IN` voice constant + `voiceschanged` in `useSpeech` | `hooks/useSpeech.js` |
| Exam tag display on `SceneSlide` | `components/ScenePlayer/SceneSlide.jsx` |

---

### Phase 4 — Prompt Inspector (Completed)

| Task | File(s) |
|---|---|
| Prompt A builder (with delimiter injection) | `prompts/promptA.js` |
| `/api/compare`: parallel generations, sequential audits, `complianceScore` in metrics, error isolation | `routes/compare.js` |
| Evaluation persistence: append runs to `server/evaluation/results.json` | `routes/compare.js` |
| `PromptInspector` + `MetricsTable` (with better values highlighted) + collapsible `JsonViewer` | `components/PromptInspector/` |
| Mock AI mode notice banner | `components/PromptInspector/PromptInspector.jsx` |

---

### Phase 5 — Checkpoint Quiz & Re-Explainer (Completed)

| Task | File(s) |
|---|---|
| `CheckpointQuiz` MCQ component with interactive feedback | `components/CheckpointQuiz/CheckpointQuiz.jsx` |
| `useQuiz` hook: manages answer state, reset on nav, re-explains next scene, handles last scene | `hooks/useQuiz.js` |
| `ReExplainToast` status notification banner | `components/CheckpointQuiz/ReExplainToast.jsx` |
| `/api/reexplain` route with `{ scene, language, reason }` body and `validateScene` check | `routes/reexplain.js`, `prompts/reexplainPrompt.js` |
| Replace next scene on wrong answer; drop stale audit and trigger re-audit | `hooks/useLesson.js`, `components/ScenePlayer/ScenePlayer.jsx` |
| Single-scene schema validator (`validateScene`) | `services/validator.js` |
| Dependency Injection & Test Suite (`npm test`) | `services/geminiClient.js`, `test/run.js` |

---

### Phase 6 — Stretch: Pause & Ask

| Task | File(s) |
|---|---|
| "Ask" button UI + text input | New component |
| `/api/ask` route + micro-scene prompt | `routes/ask.js` |
| Insert micro-scene into storyboard at current position | `hooks/useLesson.js` |

---

### Phase 7 — Polish & Demo Prep

| Task | Notes |
|---|---|
| Fallback lessons for 2-3 topics | `server/fallback/lessons/` |
| CSS styling | Responsive layout, smooth slide transitions, badge colours |
| Error handling UX | Friendly messages for API errors |
| README with setup steps | `README.md` |

---

## 7. Testing Checklist

| Test | Expected Result |
|---|---|
| Submit topic in Prompt B mode | Valid storyboard JSON returned; scenes rendered immediately; "Auditing…" spinner on badge |
| Badges appear without page reload | Audit resolves in background; green/yellow/red badges replace spinner |
| Submit same topic in Prompt A mode | May return invalid JSON (baseline comparison) |
| Submit empty or 101-char topic | 400 error "topic is required" / "must be 100 characters or fewer" |
| Prompt Inspector compare | Side-by-side view with metrics incl. Compliance Score; Prompt B higher avg confidence; collapsible JSON viewers work |
| Click ▶ Narrate | Speech starts in correct voice (en-IN for Hinglish, en-US for English) |
| Answer quiz correctly | "Correct!" shown; next scene plays normally; no audit change |
| Answer quiz incorrectly | "Simplifying…" shown; next scene content changes; stale badge removed; re-audit badge appears |
| Deliberately insert wrong formula in fallback lesson | Critic assigns confidence < 70; red badge shown |
| API returns malformed JSON | JSON.parse caught; retry fires; fallback lesson loads; `usedFallback` banner shown |
| `/api/ask` called | 501 response returned gracefully |

---

## 8. Known Limitations & Mitigations

| Limitation | Mitigation |
|---|---|
| Gemini may hallucinate | Critic audit + visible confidence badge |
| Critic LLM may also be wrong | Present score as *indicator*, not guarantee; documented in UI |
| `en-IN` TTS sounds robotic | Keep narration sentences short (≤ 120 words); `voiceschanged` ensures voice list is loaded |
| Rate limits during demo | Pre-generated fallback lessons for 2-3 topics; fallback banner informs student |
| JSON parse failure | Caught explicitly in `callWithRetry`; 1 automatic retry; fallback on second failure |
| Stale audit entry after re-explain | Dropped immediately; fresh audit fired asynchronously for the replaced scene |
