import express from 'express'
import { callGemini } from '../services/geminiClient.js'

const router = express.Router()

const VALID_ARCHETYPES = new Set([
  'cycle_loop',
  'network_flow',
  'neural_net',
  'tree_graph',
  'physics_orbit',
  'wave_mechanics',
  'timeline_story',
  'comparison_split',
  'equation_math',
  'bar_chart',
  'concept_spotlight'
])

const VALID_PARTICLES = new Set([
  'stars',
  'photons',
  'data_bits',
  'atoms',
  'waves',
  'leaves',
  'geometric'
])

/**
 * Deterministic semantic fallback visual spec generator so every topic
 * gets relatable icons, flows, and animations even without AI.
 */
export function buildHeuristicVisualSpec(title, scene, idx = 0) {
  const heading = scene.heading || scene.keyTerm || `Scene ${idx + 1}`
  const bullets = Array.isArray(scene.bullets) ? scene.bullets : []
  const text = `${title || ''} ${heading} ${scene.visual_hint || scene.visualPrompt || ''} ${bullets.join(' ')} ${scene.narration || ''}`.toLowerCase()

  // Domain detection
  if (text.includes('photo') || text.includes('chloroplast') || text.includes('plant') || text.includes('calvin') || text.includes('atp')) {
    const isCalvin = text.includes('calvin') || text.includes('glucose') || text.includes('cycle')
    return {
      scene_id: scene.id || idx + 1,
      archetype: isCalvin ? 'cycle_loop' : 'concept_spotlight',
      mood_color: '#10B981',
      secondary_color: '#F59E0B',
      bg_particles: 'photons',
      center_icon: isCalvin ? '🍬' : '🌿',
      center_label: isCalvin ? 'Calvin Cycle' : 'Chloroplast',
      entities: [
        { id: 'sun', icon: '☀️', label: 'Sunlight', sub: 'Light Photons', color: '#F59E0B' },
        { id: 'h2o', icon: '💧', label: 'H₂O + CO₂', sub: 'Raw Inputs', color: '#38BDF8' },
        { id: 'atp', icon: '⚡', label: 'ATP & NADPH', sub: 'Energy Carriers', color: '#A855F7' },
        { id: 'o2', icon: '🫧', label: 'Glucose & O₂', sub: 'Clean Output', color: '#10B981' }
      ],
      flows: [
        { from: 'sun', to: 'h2o', label: 'Excites e⁻', particle: '✨' },
        { from: 'h2o', to: 'atp', label: 'Splits H₂O', particle: '💧' },
        { from: 'atp', to: 'o2', label: 'Synthesizes', particle: '⚡' }
      ],
      callouts: bullets.slice(0, 3),
      equation: '6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂'
    }
  }

  if (text.includes('neural') || text.includes('deep learning') || text.includes('ai') || text.includes('perceptron') || text.includes('transformer') || text.includes('machine learning')) {
    return {
      scene_id: scene.id || idx + 1,
      archetype: 'neural_net',
      mood_color: '#8B5CF6',
      secondary_color: '#06B6D4',
      bg_particles: 'data_bits',
      center_icon: '🧠',
      center_label: heading.slice(0, 22),
      entities: [
        { id: 'in', icon: '📥', label: 'Input Features', sub: 'Raw Vectors', color: '#38BDF8' },
        { id: 'h1', icon: '⚙️', label: 'Hidden Layer 1', sub: 'Weights & Bias', color: '#8B5CF6' },
        { id: 'h2', icon: '⚡', label: 'Activation', sub: 'ReLU / Softmax', color: '#EC4899' },
        { id: 'out', icon: '🎯', label: 'Prediction', sub: 'Class Probabilities', color: '#10B981' }
      ],
      flows: [
        { from: 'in', to: 'h1', label: 'Forward Pass', particle: '⚡' },
        { from: 'h1', to: 'h2', label: 'Weighted Sum', particle: '✨' },
        { from: 'h2', to: 'out', label: 'Output', particle: '🎯' }
      ],
      callouts: bullets.slice(0, 3),
      equation: 'y = σ(W · x + b)'
    }
  }

  if (text.includes('tcp') || text.includes('http') || text.includes('api') || text.includes('network') || text.includes('server') || text.includes('socket') || text.includes('dns')) {
    return {
      scene_id: scene.id || idx + 1,
      archetype: 'network_flow',
      mood_color: '#6366F1',
      secondary_color: '#10B981',
      bg_particles: 'data_bits',
      center_icon: '🌐',
      center_label: heading.slice(0, 22),
      entities: [
        { id: 'client', icon: '💻', label: 'Client Node', sub: 'Initiator', color: '#6366F1' },
        { id: 'router', icon: '🛡️', label: 'Protocol Layer', sub: 'Packet Validation', color: '#F59E0B' },
        { id: 'server', icon: '🖥️', label: 'Server Node', sub: 'Responder', color: '#10B981' }
      ],
      flows: [
        { from: 'client', to: 'server', label: 'Request / SYN', particle: '📦' },
        { from: 'server', to: 'client', label: 'Response / ACK', particle: '✅' },
        { from: 'client', to: 'server', label: 'Verified Session', particle: '🔒' }
      ],
      callouts: bullets.slice(0, 3)
    }
  }

  if (text.includes('tree') || text.includes('bst') || text.includes('graph') || text.includes('binary') || text.includes('heap') || text.includes('recursion')) {
    return {
      scene_id: scene.id || idx + 1,
      archetype: 'tree_graph',
      mood_color: '#06B6D4',
      secondary_color: '#10B981',
      bg_particles: 'geometric',
      center_icon: '🌳',
      center_label: heading.slice(0, 22),
      entities: [
        { id: 'root', icon: '🔵', label: 'Root (50)', sub: 'Entry Point', color: '#6366F1' },
        { id: 'left', icon: '🟢', label: 'Left (<50)', sub: '30 → 15, 40', color: '#10B981' },
        { id: 'right', icon: '🟣', label: 'Right (>50)', sub: '75 → 60, 90', color: '#A855F7' }
      ],
      flows: [],
      callouts: bullets.slice(0, 3),
      equation: 'Time: O(log n) average'
    }
  }

  if (text.includes('gravity') || text.includes('orbit') || text.includes('solar') || text.includes('planet') || text.includes('atom') || text.includes('electron') || text.includes('nuclear')) {
    const isAtom = text.includes('atom') || text.includes('electron')
    return {
      scene_id: scene.id || idx + 1,
      archetype: 'physics_orbit',
      mood_color: '#F59E0B',
      secondary_color: '#38BDF8',
      bg_particles: isAtom ? 'atoms' : 'stars',
      center_icon: isAtom ? '⚛️' : '☀️',
      center_label: isAtom ? 'Nucleus' : 'Central Mass',
      entities: [
        { id: 'o1', icon: isAtom ? '⚡' : '🌍', label: isAtom ? 'Inner Shell' : 'Inner Orbit', sub: 'High Velocity', color: '#38BDF8' },
        { id: 'o2', icon: isAtom ? '🔵' : '🪐', label: isAtom ? 'Valence Shell' : 'Outer Orbit', sub: 'Stable Trajectory', color: '#A855F7' },
        { id: 'o3', icon: '✨', label: 'Energy Field', sub: 'Force Balance', color: '#10B981' }
      ],
      flows: [],
      callouts: bullets.slice(0, 3),
      equation: isAtom ? 'E = hf' : 'F = G(m₁m₂)/r²'
    }
  }

  if (text.includes('wave') || text.includes('sound') || text.includes('frequency') || text.includes('signal') || text.includes('ac ') || text.includes('quantum') || text.includes('electromagnetic')) {
    return {
      scene_id: scene.id || idx + 1,
      archetype: 'wave_mechanics',
      mood_color: '#06B6D4',
      secondary_color: '#EC4899',
      bg_particles: 'waves',
      center_icon: '〰️',
      center_label: heading.slice(0, 22),
      entities: [
        { id: 'amp', icon: '📶', label: 'Amplitude', sub: 'Peak Intensity', color: '#06B6D4' },
        { id: 'freq', icon: '⏱️', label: 'Frequency', sub: 'Cycles / Sec (Hz)', color: '#EC4899' },
        { id: 'wl', icon: '📏', label: 'Wavelength (λ)', sub: 'Crest to Crest', color: '#10B981' }
      ],
      flows: [],
      callouts: bullets.slice(0, 3),
      equation: 'v = f · λ'
    }
  }

  if (text.includes('history') || text.includes('timeline') || text.includes('evolution') || text.includes('era') || text.includes('ancient') || text.includes('century') || text.includes('revolution')) {
    return {
      scene_id: scene.id || idx + 1,
      archetype: 'timeline_story',
      mood_color: '#F59E0B',
      secondary_color: '#10B981',
      bg_particles: 'stars',
      center_icon: '📜',
      center_label: heading.slice(0, 22),
      entities: bullets.slice(0, 3).map((b, i) => ({
        id: `m${i}`,
        icon: ['🏛️', '⚙️', '🚀'][i] || '📌',
        label: `Phase ${i + 1}`,
        sub: b.slice(0, 36),
        color: ['#F59E0B', '#38BDF8', '#10B981'][i] || '#6366F1'
      })),
      flows: [],
      callouts: bullets.slice(0, 3)
    }
  }

  if (text.includes('vs') || text.includes('compare') || text.includes('difference') || text.includes('advantage') || text.includes('tradeoff')) {
    return {
      scene_id: scene.id || idx + 1,
      archetype: 'comparison_split',
      mood_color: '#EC4899',
      secondary_color: '#38BDF8',
      bg_particles: 'geometric',
      center_icon: '⚖️',
      center_label: heading.slice(0, 22),
      entities: [
        { id: 'a', icon: '⚡', label: 'Approach A', sub: bullets[0] ? bullets[0].slice(0, 38) : 'Primary Mechanism', color: '#38BDF8' },
        { id: 'b', icon: '🛡️', label: 'Approach B', sub: bullets[1] ? bullets[1].slice(0, 38) : 'Alternative Tradeoff', color: '#EC4899' }
      ],
      flows: [],
      callouts: bullets.slice(0, 3)
    }
  }

  if (text.includes('cycle') || text.includes('loop') || text.includes('mitosis') || text.includes('water') || text.includes('krebs') || text.includes('feedback')) {
    return {
      scene_id: scene.id || idx + 1,
      archetype: 'cycle_loop',
      mood_color: '#10B981',
      secondary_color: '#38BDF8',
      bg_particles: 'photons',
      center_icon: '🔄',
      center_label: heading.slice(0, 22),
      entities: (bullets.length >= 3 ? bullets.slice(0, 4) : ['Initiate', 'Process', 'Transform', 'Feedback']).map((b, i) => ({
        id: `c${i}`,
        icon: ['1️⃣', '2️⃣', '3️⃣', '4️⃣'][i],
        label: `Stage ${i + 1}`,
        sub: String(b).slice(0, 30),
        color: ['#38BDF8', '#10B981', '#F59E0B', '#A855F7'][i % 4]
      })),
      flows: [],
      callouts: bullets.slice(0, 3)
    }
  }

  if (text.includes('sulba') || text.includes('pythagor') || text.includes('geometry') || text.includes('calculus') || text.includes('equation') || text.includes('theorem') || text.includes('formula')) {
    return {
      scene_id: scene.id || idx + 1,
      archetype: 'equation_math',
      mood_color: '#6366F1',
      secondary_color: '#10B981',
      bg_particles: 'geometric',
      center_icon: '📐',
      center_label: heading.slice(0, 22),
      entities: bullets.slice(0, 3).map((b, i) => ({
        id: `eq${i}`,
        icon: ['📏', '🔺', '✨'][i] || '📌',
        label: `Step ${i + 1}`,
        sub: b.slice(0, 32),
        color: ['#6366F1', '#10B981', '#F59E0B'][i % 3]
      })),
      flows: [],
      callouts: bullets.slice(0, 3),
      equation: text.includes('pythagor') || text.includes('sulba') ? 'a² + b² = c²' : 'f(x) → Δy / Δx'
    }
  }

  // Rotate through rich non-flowchart archetypes so every scene looks distinct & engaging!
  const fallbackArchetypes = ['concept_spotlight', 'cycle_loop', 'timeline_story', 'wave_mechanics', 'bar_chart']
  const chosenArch = fallbackArchetypes[idx % fallbackArchetypes.length]
  const palette = [
    ['#6366F1', '#10B981'],
    ['#EC4899', '#38BDF8'],
    ['#F59E0B', '#8B5CF6'],
    ['#10B981', '#06B6D4']
  ][idx % 4]

  const entityIcons = ['💡', '🔬', '⚡', '🎯', '🧩', '🚀']
  const entities = (bullets.length ? bullets.slice(0, 4) : [heading, 'Core Mechanism', 'Key Interaction', 'Practical Impact']).map((b, i) => ({
    id: `e${i}`,
    icon: entityIcons[(idx + i) % entityIcons.length],
    label: String(b).split(/[:—-]/)[0].trim().slice(0, 22) || `Concept ${i + 1}`,
    sub: String(b).slice(0, 36),
    color: ['#38BDF8', '#10B981', '#F59E0B', '#A855F7'][i % 4]
  }))

  return {
    scene_id: scene.id || idx + 1,
    archetype: chosenArch,
    mood_color: palette[0],
    secondary_color: palette[1],
    bg_particles: ['photons', 'geometric', 'stars', 'waves'][idx % 4],
    center_icon: entityIcons[idx % entityIcons.length],
    center_label: heading.slice(0, 24),
    entities,
    flows: entities.slice(0, -1).map((ent, i) => ({
      from: ent.id,
      to: entities[i + 1].id,
      label: 'Drives',
      particle: '✨'
    })),
    callouts: bullets.slice(0, 3),
    bars: entities.map((e, i) => ({
      label: e.label.slice(0, 12),
      value: [55, 75, 92, 68][i % 4],
      color: e.color
    }))
  }
}

function sanitizeVisualSpec(raw, title, scene, idx) {
  const fallback = buildHeuristicVisualSpec(title, scene, idx)
  if (!raw || typeof raw !== 'object') return fallback

  const archetype = VALID_ARCHETYPES.has(raw.archetype) ? raw.archetype : fallback.archetype
  const bg_particles = VALID_PARTICLES.has(raw.bg_particles) ? raw.bg_particles : fallback.bg_particles
  const entities = Array.isArray(raw.entities) && raw.entities.length >= 2
    ? raw.entities.slice(0, 5).map((e, i) => ({
        id: String(e.id || `e${i}`),
        icon: String(e.icon || '✨'),
        label: String(e.label || `Element ${i + 1}`).slice(0, 26),
        sub: String(e.sub || '').slice(0, 42),
        color: typeof e.color === 'string' && e.color.startsWith('#') ? e.color : ['#38BDF8', '#10B981', '#F59E0B', '#A855F7', '#EC4899'][i % 5]
      }))
    : fallback.entities

  const flows = Array.isArray(raw.flows)
    ? raw.flows.slice(0, 4).map((f) => ({
        from: String(f.from || ''),
        to: String(f.to || ''),
        label: String(f.label || '').slice(0, 24),
        particle: String(f.particle || '✨')
      }))
    : fallback.flows

  return {
    scene_id: Number(raw.scene_id) || scene.id || idx + 1,
    archetype,
    mood_color: typeof raw.mood_color === 'string' && raw.mood_color.startsWith('#') ? raw.mood_color : fallback.mood_color,
    secondary_color: typeof raw.secondary_color === 'string' && raw.secondary_color.startsWith('#') ? raw.secondary_color : fallback.secondary_color,
    bg_particles,
    center_icon: String(raw.center_icon || fallback.center_icon),
    center_label: String(raw.center_label || fallback.center_label).slice(0, 28),
    entities,
    flows,
    callouts: Array.isArray(raw.callouts) && raw.callouts.length ? raw.callouts.slice(0, 3).map(c => String(c).slice(0, 65)) : fallback.callouts,
    equation: raw.equation
      ? String(raw.equation)
          .replace(/\\sum/g, 'Σ')
          .replace(/\\times/g, '×')
          .replace(/\\cdot/g, '·')
          .replace(/\\rightarrow/g, '→')
          .replace(/\\sigma/g, 'σ')
          .slice(0, 48)
      : fallback.equation,
    bars: Array.isArray(raw.bars) && raw.bars.length ? raw.bars.slice(0, 5) : fallback.bars
  }
}

router.post('/', async (req, res) => {
  try {
    const { title, scenes } = req.body || {}
    if (!Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({ error: 'scenes array is required' })
    }

    // If MOCK_AI is enabled, return semantic heuristic visual specs immediately
    if (process.env.MOCK_AI === 'true') {
      const visualSpecs = scenes.map((s, idx) => buildHeuristicVisualSpec(title, s, idx))
      return res.json({ visualSpecs, source: 'heuristic' })
    }

    const sceneSummaries = scenes.map((s, idx) => ({
      scene_id: s.id || s.numericId || idx + 1,
      heading: s.heading || s.keyTerm || `Scene ${idx + 1}`,
      visual_hint: s.visual_hint || s.visualPrompt || '',
      bullets: Array.isArray(s.bullets) ? s.bullets.slice(0, 3) : [],
      narration: String(s.narration || '').slice(0, 240)
    }))

    const prompt = `You are a Motion Graphics Director for educational explainer videos (like Kurzgesagt / 3Blue1Brown / Gemini Flow).
Given a lesson titled "${title || 'Educational Lesson'}" and its scenes, design a DISTINCT, RELATABLE, ANIMATED visual choreography JSON for each scene.
Do NOT make every scene the same generic box diagram — vary the archetypes across scenes so the video feels alive and tailored to the topic!

Available archetypes:
- "cycle_loop": Circular rotating process/cycle with orbiting energy particles (best for cycles, loops, biological/chemical cycles).
- "network_flow": Communicating nodes with animated flying packets/tokens (best for networking, APIs, client-server, protocols, pipelines).
- "neural_net": Multi-layer glowing nodes & pulsing synapse waves (best for AI, ML, neural networks, brain/signal propagation).
- "tree_graph": Hierarchical tree/graph with animated traversal spotlight (best for trees, hierarchies, decision paths, recursion).
- "physics_orbit": Central glowing mass/nucleus with orbiting bodies & force vectors (best for space, gravity, atoms, solar systems).
- "wave_mechanics": Oscillating animated sine/cosine waves with crest/wavelength markers (best for sound, light, signals, quantum waves, frequency).
- "timeline_story": Animated left-to-right milestone ribbon with popping era cards (best for history, evolution, step-by-step progressions).
- "comparison_split": Side-by-side VS comparison cards with animated highlights (best for tradeoffs, A vs B, before vs after).
- "equation_math": Animated geometric/coordinate visual with highlighted formula banner (best for math, geometry, physics formulas, complexity).
- "bar_chart": Animated growing bars with data labels (best for metrics, comparisons, performance, distributions).
- "concept_spotlight": Central glowing hero emoji/emblem with concentric aura rings and radiating satellite concepts connected by particle beams.

Available bg_particles: "stars", "photons", "data_bits", "atoms", "waves", "leaves", "geometric".

Return ONLY a valid JSON array (no markdown fences) of objects, one per scene, with this exact structure:
[
  {
    "scene_id": 1,
    "archetype": "one of the archetypes above",
    "mood_color": "#hex",
    "secondary_color": "#hex",
    "bg_particles": "one of bg_particles",
    "center_icon": "single relevant emoji",
    "center_label": "short 2-4 word title",
    "entities": [
      { "id": "e1", "icon": "emoji", "label": "short label (max 22 chars)", "sub": "short detail (max 36 chars)", "color": "#hex" }
    ],
    "flows": [
      { "from": "e1", "to": "e2", "label": "short verb/packet", "particle": "emoji" }
    ],
    "callouts": ["short takeaway 1", "short takeaway 2"],
    "equation": "optional short formula or key expression",
    "bars": [{ "label": "short", "value": 80, "color": "#hex" }]
  }
]

Scenes to choreograph:
${JSON.stringify(sceneSummaries, null, 2)}`

    const geminiResult = await callGemini(prompt)
    let parsed = geminiResult
    if (typeof geminiResult === 'string') {
      const cleaned = geminiResult
        .replace(/^```(?:json)?/im, '')
        .replace(/```$/m, '')
        .trim()
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        const match = cleaned.match(/\[[\s\S]*\]/)
        parsed = match ? JSON.parse(match[0]) : []
      }
    } else if (geminiResult && !Array.isArray(geminiResult) && Array.isArray(geminiResult.visualSpecs)) {
      parsed = geminiResult.visualSpecs
    } else if (geminiResult && !Array.isArray(geminiResult) && Array.isArray(geminiResult.scenes)) {
      parsed = geminiResult.scenes
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('Invalid visual choreography array from Gemini')
    }

    const visualSpecs = scenes.map((s, idx) => {
      const match = parsed.find((p) => Number(p.scene_id) === Number(s.id || s.numericId || idx + 1)) || parsed[idx]
      return sanitizeVisualSpec(match, title, s, idx)
    })

    return res.json({ visualSpecs, source: 'gemini' })
  } catch (err) {
    console.warn('[Visuals] Falling back to semantic visual specs:', err.message)
    const { title, scenes } = req.body || {}
    const visualSpecs = (Array.isArray(scenes) ? scenes : []).map((s, idx) =>
      buildHeuristicVisualSpec(title, s, idx)
    )
    return res.json({ visualSpecs, source: 'heuristic_fallback' })
  }
})

export default router
