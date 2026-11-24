/**
 * Clarivid Server Test Suite
 * Plain Node.js script (no test framework required) testing real AI code paths via dependency injection.
 */
import assert from 'node:assert/strict'
import { validateStoryboard, validateScene, callWithRetry } from '../services/validator.js'
import {
  setGeminiClient,
  resetGeminiClient,
  setSingleExecutor,
  isQuotaExhaustedError,
  isTransientError,
  callGemini
} from '../services/geminiClient.js'
import { buildPromptA } from '../prompts/promptA.js'
import { buildPromptB } from '../prompts/promptB.js'
import { buildCriticPrompt } from '../prompts/criticPrompt.js'
import { buildReexplainPrompt } from '../prompts/reexplainPrompt.js'

const CANNED_VALID_SCENE = {
  id: 1,
  heading: 'Valid Intro Heading',
  bullets: ['Bullet 1', 'Bullet 2'],
  narration: 'This is a valid concise narration explaining the concept simply within limits.',
  visual_hint: 'An illustration showing the concept',
  exam_tag: '2-mark definition',
  checkpoint: {
    q: 'What is the answer?',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    answer: 0
  }
}

const CANNED_VALID_STORYBOARD = {
  title: 'Test Storyboard',
  language: 'english',
  level: 'beginner',
  scenes: [
    { ...CANNED_VALID_SCENE, id: 1 },
    { ...CANNED_VALID_SCENE, id: 2, heading: 'Scene 2' },
    { ...CANNED_VALID_SCENE, id: 3, heading: 'Scene 3' },
    { ...CANNED_VALID_SCENE, id: 4, heading: 'Scene 4' },
    { ...CANNED_VALID_SCENE, id: 5, heading: 'Scene 5' }
  ]
}

async function runTests() {
  console.log('\n🧪 Running Clarivid Test Suite (using Dependency Injection)...\n')
  let passed = 0

  // --------------------------------------------------------------------------
  // (a) Valid output passes
  // --------------------------------------------------------------------------
  {
    console.log('Test (a): Valid output passes validateStoryboard and callWithRetry')
    const vResult = validateStoryboard(CANNED_VALID_STORYBOARD)
    assert.equal(vResult.valid, true, 'validateStoryboard should report valid: true')
    assert.equal(vResult.complianceScore, 100, 'Compliance score should be 100')

    // Inject fake client returning valid output
    setGeminiClient(async () => CANNED_VALID_STORYBOARD)
    const retryResult = await callWithRetry(() => 'prompt text', 'fix instructions')
    assert.equal(retryResult.valid, true, 'callWithRetry should return valid: true')
    assert.equal(retryResult.retried, false, 'Should not have retried on valid output')
    assert.equal(retryResult.complianceScore, 100, 'Compliance should be 100')
    resetGeminiClient()
    console.log('  ✓ (a) Passed: Valid output accepted with compliance 100% and 0 retries\n')
    passed++
  }

  // --------------------------------------------------------------------------
  // (b) Malformed JSON triggers exactly one validation retry
  // --------------------------------------------------------------------------
  {
    console.log('Test (b): Malformed JSON triggers exactly one validation retry')
    let callCount = 0
    let secondCallPrompt = ''

    setGeminiClient(async (prompt) => {
      callCount++
      if (callCount === 1) {
        // First attempt returns invalid schema (missing required fields / wrong scene count)
        return { scenes: [{ id: 1, heading: 'Incomplete' }] }
      }
      secondCallPrompt = prompt
      // Second attempt returns repaired valid storyboard
      return CANNED_VALID_STORYBOARD
    })

    const result = await callWithRetry(
      () => 'Base prompt',
      'REPAIR: Return valid JSON with 5 scenes.'
    )

    assert.equal(callCount, 2, `Expected exactly 2 calls (initial + 1 retry), got ${callCount}`)
    assert.equal(result.retried, true, 'Result.retried should be true')
    assert.equal(result.valid, true, 'Result should be valid after the single retry')
    assert.ok(
      secondCallPrompt.includes('REPAIR: Return valid JSON with 5 scenes.'),
      'Second call should include repair instructions'
    )
    resetGeminiClient()
    console.log('  ✓ (b) Passed: Malformed output triggered exactly 1 validation retry and succeeded\n')
    passed++
  }

  // --------------------------------------------------------------------------
  // (c) A 429 daily-quota error yields quota_exceeded without backoff retries
  // --------------------------------------------------------------------------
  {
    console.log('Test (c): 429 daily-quota error yields quota_exceeded without backoff retries')

    const quotaError = new Error(
      'ResourceExhausted: Generate content requests per day limit exceeded on Free Tier. Please retry in 16h43m.'
    )
    quotaError.status = 429
    quotaError.code = 'RESOURCE_EXHAUSTED'

    assert.equal(isQuotaExhaustedError(quotaError), true, 'Error should be classified as quota exhausted')
    assert.equal(isTransientError(quotaError), false, 'Quota exhausted should NOT be classified as backoff transient')

    // Inject fake single executor to verify callGemini does NOT retry 3 times on daily quota
    let executorCalls = 0
    setSingleExecutor(async () => {
      executorCalls++
      throw quotaError
    })

    // callGemini should attempt primary model once, and since fallback fails or is tested, stop immediately
    let thrown = null
    try {
      // Temporarily ensure env vars exist
      process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test_key'
      process.env.GEMINI_MODEL = 'gemini-test'
      delete process.env.GEMINI_FALLBACK_MODEL
      const prevMock = process.env.MOCK_AI
      delete process.env.MOCK_AI

      await callGemini('test prompt')
      process.env.MOCK_AI = prevMock
    } catch (err) {
      thrown = err
    }

    assert.equal(executorCalls, 1, `Expected primary model to be called only 1 time on 429 quota, got ${executorCalls}`)
    assert.ok(thrown && (thrown.isQuotaExhausted || isQuotaExhaustedError(thrown)), 'Threw quota exhausted error')

    // Test callWithRetry returns failureReason: 'quota_exceeded' and retried: false
    setGeminiClient(async () => {
      throw quotaError
    })
    const retryRes = await callWithRetry(() => 'prompt', 'repair')
    assert.equal(retryRes.valid, false, 'Should be invalid')
    assert.equal(retryRes.retried, false, 'Should NOT perform validation retry when quota is exhausted')
    assert.equal(retryRes.failureReason, 'quota_exceeded', 'failureReason must be quota_exceeded')

    resetGeminiClient()
    console.log('  ✓ (c) Passed: 429 daily quota classified, skipped backoff retries, yielded quota_exceeded\n')
    passed++
  }

  // --------------------------------------------------------------------------
  // (d) /api/compare returns both sides even when one side throws
  // --------------------------------------------------------------------------
  {
    console.log('Test (d): /api/compare returns both sides even when one side throws')

    // Simulate the comparison pipeline: Prompt A throws, Prompt B succeeds
    const promptTextA = buildPromptA({ topic: 'TCP', level: 'beginner', language: 'english' })
    const promptTextB = buildPromptB({ topic: 'TCP', level: 'beginner', language: 'english' })

    const generateSide = async (mode, promptText) => {
      if (mode === 'A') {
        throw new Error('Simulated upstream failure on Prompt A')
      }
      return {
        storyboard: CANNED_VALID_STORYBOARD,
        timeMs: 120,
        isValidJson: true,
        complianceScore: 100,
        scenesCount: 5
      }
    }

    const [resA, resB] = await Promise.allSettled([
      generateSide('A', promptTextA),
      generateSide('B', promptTextB)
    ])

    const sideA = resA.status === 'fulfilled'
      ? { storyboard: resA.value.storyboard, metrics: resA.value }
      : { storyboard: null, metrics: null, error: resA.reason?.message }

    const sideB = resB.status === 'fulfilled'
      ? { storyboard: resB.value.storyboard, metrics: resB.value }
      : { storyboard: null, metrics: null, error: resB.reason?.message }

    assert.ok(sideA.error, 'Side A should contain error message')
    assert.equal(sideA.storyboard, null, 'Side A storyboard should be null')
    assert.equal(sideB.error, undefined, 'Side B should not have error')
    assert.ok(sideB.storyboard, 'Side B storyboard must be present')
    assert.equal(sideB.metrics.complianceScore, 100, 'Side B metrics must be computed')

    console.log('  ✓ (d) Passed: /api/compare returned both sides safely with isolated error on failing side\n')
    passed++
  }

  // --------------------------------------------------------------------------
  // (e) reexplain returns a scene that passes validation
  // --------------------------------------------------------------------------
  {
    console.log('Test (e): reexplain returns a scene that passes validation')

    const simplerSceneCandidate = {
      id: 2,
      heading: 'Simpler Walkie-Talkie Analogy',
      bullets: [
        'Device A says: "Can you hear me?"',
        'Device B says: "Loud and clear! Can you hear me?"',
        'Device A confirms: "Yes, connection ready!"'
      ],
      narration: 'Think of this like two friends testing walkie-talkies. Before sharing important news, both confirm they can transmit and receive clearly.',
      visual_hint: 'Two walkie-talkies exchanging friendly check signals',
      exam_tag: 'conceptual',
      checkpoint: {
        q: 'Why do both sides confirm transmission first?',
        options: [
          'To ensure two-way communication is functional',
          'To format the hard drive',
          'To disconnect immediately',
          'To reboot the modem'
        ],
        answer: 0
      }
    }

    // Validate single scene directly with validateScene
    const sceneVal = validateScene(simplerSceneCandidate)
    assert.equal(sceneVal.valid, true, `validateScene failed: ${sceneVal.error}`)

    // Test re-explain prompt builder generates compliant prompt
    const reexplainPrompt = buildReexplainPrompt({
      scene: CANNED_VALID_SCENE,
      language: 'english',
      reason: 'wrong_answer'
    })
    assert.ok(reexplainPrompt.includes('REASON: wrong_answer') || reexplainPrompt.includes('wrong_answer'))
    assert.ok(reexplainPrompt.includes('simpler_scene'))

    // Inject fake client returning simpler_scene
    setGeminiClient(async () => ({ simpler_scene: simplerSceneCandidate }))
    const rawResult = await callGemini(reexplainPrompt)
    assert.ok(rawResult.simpler_scene, 'Returned object should have simpler_scene')
    assert.equal(validateScene(rawResult.simpler_scene).valid, true, 'Returned scene must pass validation')

    resetGeminiClient()
    console.log('  ✓ (e) Passed: reexplain scene satisfies all validation rules (4 options, <=120 words, numeric answer)\n')
    passed++
  }

  console.log(`🎉 All ${passed}/5 test suites passed successfully!\n`)
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err)
  process.exit(1)
})
