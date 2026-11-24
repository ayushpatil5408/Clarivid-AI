const ALLOWED_EXAM_TAGS = new Set([
  '2-mark definition',
  '5-mark diagram',
  'numerical',
  'conceptual'
])

export function validateScene(scene) {
  if (!scene || typeof scene !== 'object') {
    return { valid: false, error: 'Scene is not an object' }
  }
  if (typeof scene.id !== 'number' && typeof scene.id !== 'string') {
    return { valid: false, error: 'Missing or invalid scene id' }
  }
  if (!scene.heading || typeof scene.heading !== 'string') {
    return { valid: false, error: 'Missing or invalid heading' }
  }
  if (!scene.narration || typeof scene.narration !== 'string') {
    return { valid: false, error: 'Missing or invalid narration' }
  }
  if (scene.narration.trim().split(/\s+/).length > 120) {
    return { valid: false, error: 'Narration exceeds 120 words' }
  }
  if (!scene.visual_hint || typeof scene.visual_hint !== 'string') {
    return { valid: false, error: 'Missing or invalid visual_hint' }
  }
  if (!ALLOWED_EXAM_TAGS.has(scene.exam_tag)) {
    return { valid: false, error: `Invalid exam_tag: ${scene.exam_tag}` }
  }
  if (
    !scene.checkpoint ||
    !Array.isArray(scene.checkpoint.options) ||
    scene.checkpoint.options.length !== 4
  ) {
    return { valid: false, error: 'Checkpoint must have exactly 4 options' }
  }
  if (typeof scene.checkpoint.answer !== 'number') {
    return { valid: false, error: 'Checkpoint answer must be numeric' }
  }
  return { valid: true, data: scene }
}

export function validateStoryboard(obj) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, error: 'Not an object', complianceScore: 0 }
  }
  if (!Array.isArray(obj.scenes) || obj.scenes.length < 5 || obj.scenes.length > 7) {
    return {
      valid: false,
      error: `scenes array must contain between 5 and 7 scenes (received ${Array.isArray(obj?.scenes) ? obj.scenes.length : 0})`,
      complianceScore: 0
    }
  }

  let passing = 0
  for (const scene of obj.scenes) {
    if (validateScene(scene).valid) {
      passing++
    }
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
  const { callGemini, isTransientError, isQuotaExhaustedError } = await import('./geminiClient.js')

  function determineFailureReason(err) {
    if (isQuotaExhaustedError(err)) return 'quota_exceeded'
    if (isTransientError(err)) return 'api_busy'
    return 'api_error'
  }

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
    failureReason = determineFailureReason(err)
  }

  // 2. Separate schema-validation retry (max 1 retry) if parsing or schema failed
  // (Do NOT retry if quota is exhausted!)
  if (!validation.valid && failureReason !== 'quota_exceeded') {
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
      failureReason = determineFailureReason(err)
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
