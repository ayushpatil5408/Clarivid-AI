const ALLOWED_EXAM_TAGS = new Set([
  '2-mark definition',
  '5-mark diagram',
  'numerical',
  'conceptual'
])

export function validateStoryboard(obj) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, error: 'Not an object', complianceScore: 0 }
  }
  if (!Array.isArray(obj.scenes) || obj.scenes.length === 0) {
    return { valid: false, error: 'scenes array missing or empty', complianceScore: 0 }
  }

  let passing = 0
  for (const scene of obj.scenes) {
    if (!scene || typeof scene !== 'object') continue
    if (typeof scene.id !== 'number' && typeof scene.id !== 'string') continue
    if (!scene.heading || typeof scene.heading !== 'string') continue
    if (!scene.narration || typeof scene.narration !== 'string') continue
    if (!ALLOWED_EXAM_TAGS.has(scene.exam_tag)) continue
    if (
      !scene.checkpoint ||
      !Array.isArray(scene.checkpoint.options) ||
      scene.checkpoint.options.length !== 4
    ) {
      continue
    }
    if (typeof scene.checkpoint.answer !== 'number') continue
    if (scene.narration.trim().split(/\s+/).length > 120) continue

    passing++
  }

  const complianceScore = Math.round((passing / obj.scenes.length) * 100)
  const valid = passing === obj.scenes.length

  if (!valid) {
    return {
      valid: false,
      error: `${obj.scenes.length - passing} scene(s) failed validation`,
      complianceScore
    }
  }

  return { valid: true, data: obj, complianceScore }
}

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
