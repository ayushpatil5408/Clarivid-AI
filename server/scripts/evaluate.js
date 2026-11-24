import 'dotenv/config'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { buildPromptA } from '../prompts/promptA.js'
import { buildPromptB } from '../prompts/promptB.js'
import { buildCriticPrompt } from '../prompts/criticPrompt.js'
import { callGemini, isQuotaExhaustedError } from '../services/geminiClient.js'
import { validateStoryboard } from '../services/validator.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const EVALUATION_DIR = join(__dirname, '../evaluation')
const RESULTS_FILE = join(EVALUATION_DIR, 'results.json')
const SUMMARY_FILE = join(EVALUATION_DIR, 'summary.md')
const LESSONS_DIR = join(__dirname, '../fallback/lessons')

const TOPICS = [
  'TCP Three-Way Handshake',
  'Photosynthesis',
  "Newton's Laws of Motion"
]

const PLANNED_COMPARE_CALLS = TOPICS.length * 4 // Prompt A, Prompt B, Audit A, Audit B per topic = 12
const PLANNED_AUDIT_CALLS = 4 // 2 flawed lessons + 2 control lessons = 4
const TOTAL_PLANNED_CALLS = PLANNED_COMPARE_CALLS + PLANNED_AUDIT_CALLS // 16 calls
const DELAY_BETWEEN_CALLS_MS = 4000

// 1. Refuse to run if MOCK_AI=true
if (process.env.MOCK_AI === 'true') {
  console.error('\n❌ ERROR: evaluate.js refuses to run when MOCK_AI=true.')
  console.error('Please set MOCK_AI=false in server/.env and supply a valid GEMINI_API_KEY.\n')
  process.exit(1)
}

// 2. Gate execution on --confirm flag
const hasConfirm = process.argv.includes('--confirm')

if (!hasConfirm) {
  console.log('====================================================================')
  console.log(' Clarivid Automated Evaluation Runner')
  console.log('====================================================================')
  console.log(`Planned Gemini API calls: ${TOTAL_PLANNED_CALLS}`)
  console.log(`  - 3 topics × 4 calls (Prompt A, Prompt B, Audit A, Audit B) = ${PLANNED_COMPARE_CALLS} calls`)
  console.log(`  - 4 live fact-audits (2 flawed lessons + 2 control lessons)  = ${PLANNED_AUDIT_CALLS} calls`)
  console.log(`Delay between consecutive API calls: ${DELAY_BETWEEN_CALLS_MS / 1000}s`)
  console.log('')
  console.log('⚠️  SAFETY GATE: This script will NOT execute without explicit confirmation.')
  console.log('To confirm and run the evaluation, pass the --confirm flag:')
  console.log('    npm run evaluate -- --confirm')
  console.log('====================================================================\n')
  process.exit(0)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

function saveResults(entries) {
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
  existing.push(...entries)
  writeFileSync(RESULTS_FILE, JSON.stringify(existing, null, 2), 'utf8')
  console.log(`[Evaluation] Persisted ${entries.length} record(s) to ${RESULTS_FILE}`)
}

function generateSummaryMarkdown({ model, date, compareRuns, criticRuns }) {
  let md = `# Clarivid Evaluation Summary Report\n\n`
  md += `**Date:** ${date}\n`
  md += `**Model:** \`${model}\`\n\n`
  md += `> single run per topic; results vary between runs\n\n`
  md += `This report compares Prompt A (Zero-shot baseline) against Prompt B (Role + Few-shot + Schema-constrained) and evaluates the Critic fact-auditor against flawed lessons and control lessons.\n\n`

  md += `## 1. Prompt Comparison Results (A vs B)\n\n`

  if (compareRuns.length === 0) {
    md += `*No prompt comparison runs completed.*\n\n`
  } else {
    for (const run of compareRuns) {
      const mA = run.metrics?.promptA
      const mB = run.metrics?.promptB
      md += `### Topic: ${run.topic} (${run.level}, ${run.language})\n\n`
      md += `| Metric | Prompt A (Zero-shot) | Prompt B (Role + Few-shot + Schema) |\n`
      md += `| :--- | :--- | :--- |\n`
      md += `| **Valid JSON** | ${mA?.isValidJson ? '✅ Yes' : '❌ No'} | ${mB?.isValidJson ? '✅ Yes' : '❌ No'} |\n`
      md += `| **Schema Compliance** | ${mA?.complianceScore !== undefined && mA?.complianceScore !== null ? `${mA.complianceScore}%` : 'N/A'} | ${mB?.complianceScore !== undefined && mB?.complianceScore !== null ? `${mB.complianceScore}%` : 'N/A'} |\n`
      md += `| **Scene Count** | ${mA?.scenes ?? 'N/A'} | ${mB?.scenes ?? 'N/A'} |\n`
      md += `| **Avg Fact-Confidence** | ${mA?.avgConfidence !== null && mA?.avgConfidence !== undefined ? `${mA.avgConfidence}/100` : 'N/A'} | ${mB?.avgConfidence !== null && mB?.avgConfidence !== undefined ? `${mB.avgConfidence}/100` : 'N/A'} |\n`
      md += `| **Generation Latency** | ${mA?.timeMs !== undefined ? `${mA.timeMs}ms` : 'N/A'} | ${mB?.timeMs !== undefined ? `${mB.timeMs}ms` : 'N/A'} |\n\n`
    }
  }

  md += `## 2. Critic Fact-Auditor Verification\n\n`
  md += `Live audit evaluations across flawed lessons and control lessons:\n\n`
  md += `| Lesson | Planted Error Scene | Confidence | Confidence < 70? | Issues Flagged |\n`
  md += `| :--- | :--- | :--- | :---: | :--- |\n`

  if (criticRuns.length === 0) {
    md += `| *None* | *None* | *N/A* | *N/A* | *No audit runs completed* |\n\n`
  } else {
    for (const cr of criticRuns) {
      const confStr = cr.confidence !== null ? `${cr.confidence}/100` : 'N/A'
      const below70 = cr.confidence !== null ? (cr.confidence < 70 ? '✅ YES' : '❌ NO') : 'N/A'
      const issuesStr = cr.issues && cr.issues.length > 0 ? cr.issues.map(i => `• ${i}`).join('<br>') : 'None (clean)'
      md += `| **${cr.lesson}** | ${cr.targetScene} | ${confStr} | ${below70} | ${issuesStr} |\n`
    }
    md += `\n`
  }

  return md
}

async function runEvaluation() {
  console.log(`\n🚀 Starting evaluation run with model: ${process.env.GEMINI_MODEL || 'default'}...`)
  const timestamp = new Date().toISOString()
  const model = process.env.GEMINI_MODEL || 'unknown'

  const savedEntries = []
  const completedCompare = []
  const completedCritic = []
  let quotaHit = false

  // --------------------------------------------------------------------------
  // Step 2: Compare runs for each topic
  // --------------------------------------------------------------------------
  console.log('\n--- Step 2: Running Comparative Prompts A vs B ---')
  for (const topic of TOPICS) {
    if (quotaHit) break

    console.log(`\nEvaluating Topic: "${topic}"...`)
    const params = { topic, level: 'beginner', language: 'english' }
    const promptTextA = buildPromptA(params)
    const promptTextB = buildPromptB(params)

    let sideA = { promptText: promptTextA, storyboard: null, metrics: null }
    let sideB = { promptText: promptTextB, storyboard: null, metrics: null }

    try {
      // Prompt A generation
      console.log('  Calling Prompt A...')
      const tA = Date.now()
      const rawA = await callGemini(promptTextA)
      const durA = Date.now() - tA
      const valA = validateStoryboard(rawA)
      sideA.storyboard = normaliseIds(rawA)
      sideA.metrics = {
        isValidJson: valA.valid,
        complianceScore: valA.complianceScore,
        scenes: Array.isArray(rawA?.scenes) ? rawA.scenes.length : 0,
        avgConfidence: null,
        timeMs: durA
      }
    } catch (err) {
      console.error('  ❌ Prompt A failed:', err.message || err)
      sideA.error = err.message || String(err)
      if (isQuotaExhaustedError(err)) {
        quotaHit = true
        break
      }
    }

    await sleep(DELAY_BETWEEN_CALLS_MS)
    if (quotaHit) break

    try {
      // Prompt B generation
      console.log('  Calling Prompt B...')
      const tB = Date.now()
      const rawB = await callGemini(promptTextB)
      const durB = Date.now() - tB
      const valB = validateStoryboard(rawB)
      sideB.storyboard = normaliseIds(rawB)
      sideB.metrics = {
        isValidJson: valB.valid,
        complianceScore: valB.complianceScore,
        scenes: Array.isArray(rawB?.scenes) ? rawB.scenes.length : 0,
        avgConfidence: null,
        timeMs: durB
      }
    } catch (err) {
      console.error('  ❌ Prompt B failed:', err.message || err)
      sideB.error = err.message || String(err)
      if (isQuotaExhaustedError(err)) {
        quotaHit = true
        break
      }
    }

    await sleep(DELAY_BETWEEN_CALLS_MS)
    if (quotaHit) break

    // Audit A
    if (sideA.storyboard && Array.isArray(sideA.storyboard.scenes) && sideA.storyboard.scenes.length > 0) {
      try {
        console.log('  Auditing Output A...')
        const auditRawA = await callGemini(buildCriticPrompt(sideA.storyboard))
        const auditListA = Array.isArray(auditRawA) ? auditRawA : (auditRawA?.audit || [])
        sideA.metrics.avgConfidence = calculateAvgConfidence(auditListA)
        sideA.audit = auditListA
      } catch (err) {
        console.warn('  ⚠️ Audit A failed:', err.message || err)
        if (isQuotaExhaustedError(err)) {
          quotaHit = true
          break
        }
      }
    }

    await sleep(DELAY_BETWEEN_CALLS_MS)
    if (quotaHit) break

    // Audit B
    if (sideB.storyboard && Array.isArray(sideB.storyboard.scenes) && sideB.storyboard.scenes.length > 0) {
      try {
        console.log('  Auditing Output B...')
        const auditRawB = await callGemini(buildCriticPrompt(sideB.storyboard))
        const auditListB = Array.isArray(auditRawB) ? auditRawB : (auditRawB?.audit || [])
        sideB.metrics.avgConfidence = calculateAvgConfidence(auditListB)
        sideB.audit = auditListB
      } catch (err) {
        console.warn('  ⚠️ Audit B failed:', err.message || err)
        if (isQuotaExhaustedError(err)) {
          quotaHit = true
          break
        }
      }
    }

    const runRecord = {
      type: 'compare',
      timestamp,
      model,
      topic,
      level: 'beginner',
      language: 'english',
      metrics: { promptA: sideA.metrics, promptB: sideB.metrics },
      outputs: { promptA: sideA, promptB: sideB }
    }

    savedEntries.push(runRecord)
    completedCompare.push(runRecord)
    console.log(`  ✓ Finished topic "${topic}"`)

    await sleep(DELAY_BETWEEN_CALLS_MS)
  }

  // --------------------------------------------------------------------------
  // Step 3: Live Critic Audits on Flawed and Control Lessons
  // --------------------------------------------------------------------------
  if (!quotaHit) {
    console.log('\n--- Step 3: Running Live Critic Audits on Flawed & Control Lessons ---')

    const auditTargets = [
      {
        lesson: 'tcp-handshake-flawed.json',
        label: 'TCP Handshake (Flawed)',
        targetScene: 'Scene 1 (4-way claim)',
        targetSceneId: 1
      },
      {
        lesson: 'tcp-handshake.json',
        label: 'TCP Handshake (Control)',
        targetScene: 'All scenes (Control)',
        targetSceneId: 1
      },
      {
        lesson: 'photosynthesis-flawed.json',
        label: 'Photosynthesis (Flawed)',
        targetScene: 'Scene 2 (CO gas equation)',
        targetSceneId: 2
      },
      {
        lesson: 'photosynthesis.json',
        label: 'Photosynthesis (Control)',
        targetScene: 'All scenes (Control)',
        targetSceneId: 2
      }
    ]

    for (const target of auditTargets) {
      if (quotaHit) break

      const filePath = join(LESSONS_DIR, target.lesson)
      if (!existsSync(filePath)) {
        console.warn(`  ⚠️ File not found: ${filePath}`)
        continue
      }

      console.log(`\nAuditing ${target.label}...`)
      try {
        const lessonData = JSON.parse(readFileSync(filePath, 'utf8'))
        const prompt = buildCriticPrompt(lessonData)
        const raw = await callGemini(prompt)
        const auditList = Array.isArray(raw) ? raw : (raw?.audit || [])

        // Find audit entry for the target scene
        const targetEntry = auditList.find(a => a.scene_id === target.targetSceneId) || auditList[0]

        const criticRecord = {
          type: 'critic_live_audit',
          timestamp,
          model,
          lesson: target.label,
          targetScene: target.targetScene,
          confidence: targetEntry ? targetEntry.confidence : null,
          issues: targetEntry ? (targetEntry.issues || []) : [],
          rawAudit: auditList
        }

        savedEntries.push(criticRecord)
        completedCritic.push(criticRecord)
        console.log(`  ✓ Confidence for ${target.targetScene}: ${targetEntry?.confidence}/100`)
      } catch (err) {
        console.error(`  ❌ Audit failed for ${target.label}:`, err.message || err)
        if (isQuotaExhaustedError(err)) {
          quotaHit = true
          break
        }
      }

      await sleep(DELAY_BETWEEN_CALLS_MS)
    }
  }

  // --------------------------------------------------------------------------
  // Step 4 & 5: Save Results and Write Summary Markdown
  // --------------------------------------------------------------------------
  if (savedEntries.length > 0) {
    saveResults(savedEntries)

    const summaryMd = generateSummaryMarkdown({
      model,
      date: timestamp,
      compareRuns: completedCompare,
      criticRuns: completedCritic
    })

    writeFileSync(SUMMARY_FILE, summaryMd, 'utf8')
    console.log(`\n📄 Report-ready evaluation summary written to: ${SUMMARY_FILE}`)
  }

  if (quotaHit) {
    console.warn('\n⚠️ [QUOTA EXHAUSTED] Daily API limit encountered. Halted immediately; partial results were safely recorded.')
  } else {
    console.log('\n✅ Evaluation completed successfully!')
  }
}

runEvaluation().catch((err) => {
  console.error('\nEvaluation execution failed:', err)
  process.exit(1)
})
