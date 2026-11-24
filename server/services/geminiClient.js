import { GoogleGenAI } from '@google/genai'

const CALL_TIMEOUT_MS = 45000 // 45 seconds per-call timeout
const RETRY_DELAYS = [1500, 3000] // Exponential backoff: 1.5s, then 3s

export function isTransientError(err) {
  if (!err) return false

  // Status code check (HTTP 429, 500, 502, 503, 504)
  const status = err.status || err.code || err.statusCode
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true
  }

  // Network or timeout checks
  const msg = String(err.message || '').toLowerCase()
  const code = String(err.code || '').toLowerCase()

  if (
    code === 'etimedout' ||
    code === 'econnreset' ||
    code === 'econnrefused' ||
    code === 'aborterror' ||
    err.isTimeout ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('high demand') ||
    msg.includes('temporarily unavailable') ||
    msg.includes('503') ||
    msg.includes('429')
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
