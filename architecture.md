# LearnLoop — Architecture Document

> **Version:** 1.1  
> **Date:** November 2026  
> **Stack:** Vite + React · Node.js + Express · Google Gemini API (`@google/genai`) · Web Speech API

---

## 1. System Overview

LearnLoop is a full-stack web application that converts any learning topic into an **interactive, scene-by-scene explainer lesson**. Unlike traditional AI video generators that produce a fixed linear artefact, LearnLoop generates structured JSON storyboards that are rendered as animated slides with browser-based TTS narration — keeping the experience feel cinematic while enabling full interactivity.

```
┌─────────────────────────────────────────────────────────────┐
│                      BROWSER (React)                        │
│  ┌────────────┐  ┌─────────────┐  ┌──────────────────────┐ │
│  │  Lesson    │  │   Scene     │  │   Prompt Inspector   │ │
│  │  Config    │  │   Player   │  │   (A vs B compare)   │ │
│  │  Form      │  │ + Quiz UI  │  │                      │ │
│  └─────┬──────┘  └──────┬──────┘  └──────────┬───────────┘ │
│        │                │                     │             │
└────────┼────────────────┼─────────────────────┼─────────────┘
         │   REST / JSON  │                     │
┌────────▼────────────────▼─────────────────────▼─────────────┐
│                   EXPRESS BACKEND (Node.js)                  │
│  ┌────────────┐  ┌────────────┐  ┌───────────┐  ┌────────┐ │
│  │ /generate  │  │  /audit    │  │ /compare  │  │ /reex- │ │
│  │            │  │            │  │           │  │ plain  │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬─────┘  └───┬────┘ │
│        │               │               │             │      │
│  ┌─────▼───────────────▼───────────────▼─────────────▼────┐ │
│  │                 Prompt Engine                          │ │
│  │  (builds, validates, retries Gemini API calls)        │ │
│  └──────────────────────┬─────────────────────────────────┘ │
└─────────────────────────┼───────────────────────────────────┘
                          │  HTTPS
              ┌───────────▼────────────┐
              │  Google Gemini API     │
              │  (JSON response mode)  │
              │  LLM 1: Storyboard     │
              │  LLM 2: Critic/Auditor │
              └────────────────────────┘
```

---

## 2. Architecture Style

LearnLoop follows a **layered, dual-LLM pipeline** pattern:

| Layer | Responsibility |
|---|---|
| **Presentation** | React UI — form, scene player, quiz, prompt inspector |
| **API Gateway** | Express router — validates requests, routes to handlers |
| **Prompt Engine** | Builds prompts, calls Gemini, validates JSON output, retries |
| **LLM 1 (Generator)** | Produces the storyboard JSON from topic + constraints; model name from `GEMINI_MODEL` env var |
| **LLM 2 (Critic)** | Audits each scene, returns confidence score + issues |
| **Speech Layer** | Browser `speechSynthesis` API — no backend dependency |

---

## 3. Component Architecture

### 3.1 Frontend (React / Vite)

```
src/
├── components/
│   ├── LessonForm/          # Topic, level, language input form
│   │   └── LessonForm.jsx
│   ├── ScenePlayer/         # Main lesson player
│   │   ├── ScenePlayer.jsx  # Orchestrates scenes
│   │   ├── SceneSlide.jsx   # Animated slide with bullets
│   │   ├── NarrationBar.jsx # TTS play/pause controls
│   │   ├── ProgressBar.jsx  # Scene X of N
│   │   └── AuditBadge.jsx   # Green/Yellow/Red confidence badge
│   ├── Quiz/
│   │   ├── CheckpointQuiz.jsx  # MCQ component
│   │   └── ReExplainToast.jsx  # "Simplifying…" feedback
│   ├── PromptInspector/
│   │   ├── PromptInspector.jsx # Side-by-side A vs B
│   │   ├── PromptPanel.jsx     # Shows raw prompt text
│   │   └── MetricsTable.jsx    # Comparison metrics table
│   └── common/
│       ├── Spinner.jsx
│       └── ErrorBanner.jsx
├── hooks/
│   ├── useLesson.js        # Lesson generation + audit state
│   ├── useSpeech.js        # speechSynthesis wrapper
│   └── useQuiz.js          # Quiz state + re-explain trigger
├── services/
│   └── api.js              # Axios calls to Express backend
├── utils/
│   ├── schemaValidator.js  # Client-side JSON schema check
│   └── examTagColors.js    # Tag → colour mapping
├── App.jsx
└── main.jsx
```

### 3.2 Backend (Node.js / Express)

```
server/
├── routes/
│   ├── generate.js    # POST /api/generate
│   ├── audit.js       # POST /api/audit
│   ├── compare.js     # POST /api/compare
│   ├── reexplain.js   # POST /api/reexplain
│   └── ask.js         # POST /api/ask  (stretch — returns 501 until Phase 6)
├── prompts/
│   ├── promptA.js     # Zero-shot storyboard prompt builder
│   ├── promptB.js     # Role-based, few-shot, schema-constrained prompt builder
│   ├── criticPrompt.js  # Fact-audit prompt builder
│   └── reexplainPrompt.js  # Simpler-analogy rewrite prompt
├── services/
│   ├── geminiClient.js  # Initialises Gemini SDK, handles JSON mode
│   └── validator.js     # JSON schema validation + retry logic
├── middleware/
│   ├── errorHandler.js
│   └── requestLogger.js
├── fallback/
│   └── lessons/        # Pre-generated JSON for demo resilience
│       ├── tcp-handshake.json
│       └── photosynthesis.json
├── .env                # GEMINI_API_KEY, GEMINI_MODEL, PORT (never sent to client)
├── .env.example        # Committed template with placeholder values
└── index.js
```

---

## 4. Data Flow Diagrams

### 4.1 Main Lesson Generation Flow

```
User submits form
      │
      ▼
POST /api/generate
{ topic (trimmed, ≤100 chars), level, language, promptMode }
      │
      ▼
Prompt Engine
  ├── if promptMode = "A"  →  promptA.js  (zero-shot)
  └── if promptMode = "B"  →  promptB.js  (role + few-shot + schema)
  (topic injected inside delimiters to prevent prompt injection)
      │
      ▼
Gemini API (LLM 1 — Generator)
  JSON response mode ON · model from GEMINI_MODEL env var
  ├── Per-call timeout: 45s
  ├── Transient error retry: up to 2 retries (1.5s, 3s backoff)
  └── Fallback model (GEMINI_FALLBACK_MODEL) if primary fails after retries
      │
      ▼
validator.js
  ├── Catch JSON.parse errors
  ├── Validate against storyboard schema (fields, exam_tag allowlist,
  │   checkpoint options × 4, numeric answer, narration ≤ 120 words)
  ├── Compute compliance score (0-100)
  ├── On failure → retry once with stricter instruction (carries its own transient retries)
  └── On total failure → select keyword-matched fallback lesson with fallbackReason
      │
      ▼
Server normalises scene ids to 1..n
      │
      ▼
Response to frontend immediately:
{ storyboard, generationTimeMs, promptMode, isValidJson, retried,
  usedFallback, fallbackReason, fallbackTopic, requestedTopic }
      │
      ▼ (async — triggered by frontend after rendering)
POST /api/audit
{ storyboard }
      │
      ▼
criticPrompt.js  →  Gemini API (LLM 2 — Critic)
  Returns audit[] : [{ scene_id, confidence, issues, corrected_text }]
  Route accepts bare array OR { audit: [...] } wrapper
  Client matches entries by scene_id; falls back to index if id mismatches
      │
      ▼
Badges rendered per scene (replace "Auditing…" spinner)
```

### 4.2 Quiz & Re-Explainer Flow

```
Scene finishes playing
      │
      ▼
CheckpointQuiz shown (if checkpoint exists in scene JSON)
      │
   ┌──┴──┐
Correct  Wrong
   │       │
   │       ▼
   │  POST /api/reexplain
   │  { scene, language, reason: "wrong_answer" }
   │       │
   │       ▼
   │  reexplainPrompt.js  →  Gemini API
   │  Returns: simpler_scene (same schema shape)
   │       │
   │       ▼
   │  Replace next scene in storyboard with simpler_scene
   │  Drop (or re-audit) stale audit entry for that scene
   │       │
   └───────┤
           ▼
      Next scene plays
```

### 4.3 Prompt Inspector Flow

```
User clicks "Compare Prompts"
      │
      ▼
POST /api/compare
{ topic, level, language }
      │
      ▼
Backend runs generations in PARALLEL:
  ├── Prompt A (zero-shot)  →  Gemini  →  storyboard_A
  └── Prompt B (role+few-shot)  →  Gemini  →  storyboard_B
      │
      ▼
Audits run SEQUENTIALLY (to avoid rate-limit spikes):
  Audit A  →  Gemini Critic  →  audit_A
  Audit B  →  Gemini Critic  →  audit_B
      │
      ▼
Metrics computed per side:
  { isValidJson, scenes, avgConfidence, complianceScore, timeMs }
      │
      ▼
Response: { promptA: { promptText, storyboard, metrics },
            promptB: { promptText, storyboard, metrics } }
      │
      ▼
PromptInspector UI:
  Side-by-side prompt text + MetricsTable
  + Collapsible JSON viewer for each storyboard output
```

---

## 5. API Contract

### `POST /api/generate`

**Request:**
```json
{
  "topic": "TCP Three-Way Handshake",
  "level": "beginner",
  "language": "hinglish",
  "promptMode": "B"
}
```

> **Input validation:** `topic` is trimmed; requests with an empty topic or topic longer than 100 characters are rejected with `400`.

**Response:**
```json
{
  "storyboard": { "title": "...", "language": "hinglish", "scenes": [...] },
  "generationTimeMs": 3240,
  "promptMode": "B",
  "isValidJson": true,
  "retried": false,
  "usedFallback": false,
  "fallbackReason": null,
  "fallbackTopic": null,
  "requestedTopic": "TCP Three-Way Handshake"
}
```

> **Fallback Handling:** If `usedFallback` is `true`, `fallbackReason` is one of `"api_busy"` | `"invalid_output"` | `"api_error"`. The lesson returned is chosen by keyword matching against available demo lessons (`tcp-handshake.json` or `photosynthesis.json`).
>
> Storyboard is returned immediately. The UI renders at once and fires `/api/audit` asynchronously; badges show an "Auditing…" spinner until the audit resolves.

---

### `POST /api/audit`

**Request:**
```json
{ "storyboard": { ... } }
```

> The route also accepts `{ "audit": [...] }` or a bare JSON array from the LLM — the handler normalises all three shapes to `{ audit: [...] }`.

**Response:**
```json
{
  "audit": [
    { "scene_id": 1, "confidence": 92, "issues": [], "corrected_text": null },
    { "scene_id": 2, "confidence": 68, "issues": ["Formula incorrect"], "corrected_text": "..." }
  ]
}
```

---

### `POST /api/compare`

**Request:**
```json
{ "topic": "Photosynthesis", "level": "intermediate", "language": "english" }
```

**Response:**
```json
{
  "promptA": {
    "promptText": "...",
    "storyboard": { ... },
    "metrics": { "isValidJson": false, "scenes": 0, "avgConfidence": null, "complianceScore": null, "timeMs": 1800 }
  },
  "promptB": {
    "promptText": "...",
    "storyboard": { ... },
    "metrics": { "isValidJson": true, "scenes": 6, "avgConfidence": 87, "complianceScore": 91, "timeMs": 3100 }
  }
}
```

---

### `POST /api/reexplain`

**Request:**
```json
{ "scene": { ... }, "language": "hinglish", "reason": "wrong_answer" }
```

**Response:**
```json
{ "simpler_scene": { ... } }
```

---

### `POST /api/ask` *(stretch — returns 501 until Phase 6)*

**Request:**
```json
{ "question": "Why is SYN-ACK one packet?", "context_scene": { ... } }
```

**Response:**
```json
{ "micro_scene": { ... } }
```

---

## 6. JSON Schemas

### 6.1 Storyboard Schema

```json
{
  "title": "string",
  "language": "english | hinglish",
  "level": "beginner | intermediate | advanced",
  "scenes": [
    {
      "id": "number (server normalises to 1..n after generation)",
      "heading": "string",
      "bullets": ["string"],
      "narration": "string (≤ 120 words — enforced by validator)",
      "visual_hint": "string",
      "exam_tag": "2-mark definition | 5-mark diagram | numerical | conceptual",
      "checkpoint": {
        "q": "string",
        "options": ["string × exactly 4"],
        "answer": "number (0-indexed, must be numeric)"
      }
    }
  ]
}
```

**Validator checks (all must pass for `valid: true`):**

| Check | Rule |
|---|---|
| Scene count | 5–7 scenes allowed (array length between 5 and 7) |
| Required fields | `id`, `heading`, `narration`, `visual_hint` present on every scene |
| `exam_tag` | Must be one of the 4 allowed values |
| `checkpoint.options` | Exactly 4 elements |
| `checkpoint.answer` | Must be a number (not a string) |
| `narration` length | ≤ 120 words |

The validator also returns a `complianceScore` (0–100) counting how many scenes pass all checks proportionally, regardless of `valid`.

### 6.2 Audit Schema

```json
{
  "scene_id": "number",
  "confidence": "number (0-100)",
  "issues": ["string"],
  "corrected_text": "string | null"
}
```

**Confidence bands:**

| Score | Band | Badge Colour |
|---|---|---|
| 90–100 | High confidence | 🟢 Green |
| 70–89 | Moderate confidence | 🟡 Yellow |
| 0–69 | Low confidence | 🔴 Red |

---

## 7. Prompt Engineering Architecture

| Prompt | Technique | Where used |
|---|---|---|
| **Prompt A** | Zero-shot | Baseline; Prompt Inspector only |
| **Prompt B** | Role-based + few-shot + schema-constrained + constraint-based | Default lesson generation |
| **Critic prompt** | Critic / self-verification pattern | `/api/audit` |
| **Re-explainer prompt** | Adaptive re-prompting | `/api/reexplain` |
| **Micro-scene prompt** | In-context question answering | `/api/ask` (stretch) |
| **All prompts** | Retry with validation | Automatic on JSON parse failure |

Prompt B structure:
```
1. ROLE     → "You are an experienced B.Tech professor…"
2. TASK     → "Generate a 5-7 scene storyboard as JSON…"
3. SCHEMA   → Paste exact JSON schema
4. EXAMPLE  → One fully worked-out scene
5. CONSTRAINTS → scene count, narration word limit, Hinglish rules
6. TOPIC    → injected at runtime
```

---

## 8. State Management (Frontend)

LearnLoop uses **React local state + custom hooks** (no Redux/Zustand) since the data model is session-scoped and there is no persistence requirement.

```
App
 └── useLesson           # storyboard, audit, loading, error
      ├── ScenePlayer
      │    └── useQuiz   # currentScene, quizResult, re-explain flag
      │         └── useSpeech  # utterance, speaking, rate
      └── PromptInspector  # local state only (compare results)
```

---

## 9. Security Considerations

| Concern | Approach |
|---|---|
| API key exposure | Key lives only in `server/.env`; never sent to or logged by the client |
| Model name | Read from `GEMINI_MODEL` env var; no hardcoded model string in source |
| Prompt injection | User topic is trimmed, capped at 100 chars, and injected inside `<<<TOPIC>>>` delimiters — never concatenated into structural prompt parts |
| Rate limiting | `express-rate-limit` applied to all `/api` routes (100 req / 15 min per IP by default) |
| Malformed LLM output | JSON.parse errors caught; schema validation + one retry; fallback to static lesson on second failure. Fallback loaded with `fs.readFileSync`, not import assertions |
| Fallback banner | When `usedFallback: true`, UI shows a dismissible banner warning the student they are viewing a cached lesson |

---

## 10. Deployment Topology

```
┌──────────────────────────────┐
│   Dev Machine / Cloud Host   │
│  ┌──────────────┐            │
│  │  Vite Dev    │ :5173       │  ◄── Browser
│  │  Server      │ → proxy →  │
│  └──────────────┘            │
│  ┌──────────────┐            │
│  │  Express     │ :3001       │
│  │  Server      │            │
│  └──────────────┘            │
└──────────────────────────────┘
            │ HTTPS
   ┌────────▼────────┐
   │  Gemini API     │
   │  (Google Cloud) │
   └─────────────────┘
```

For production: Vite builds a static bundle served by Express (or a CDN), and Express handles all `/api/*` routes.

---

## 11. Key Design Decisions

| Decision | Rationale |
|---|---|
| JSON storyboard instead of rendered video | Enables all interactivity features; avoids heavy video pipeline; feasible for a mini project |
| Browser TTS instead of cloud voice | Zero latency, zero cost, works offline; known trade-off: quality varies by device |
| Hinglish TTS lang constant | `en-IN` used for Roman-script Hinglish (not `hi-IN`); defined as a single constant so it can be switched; `voiceschanged` event awaited before first speak |
| Two separate LLM calls (Generator + Critic) | Separation of concerns; makes the fact-audit visible and independently auditable |
| Async audit (generation first, audit in background) | User sees the lesson immediately; badges appear as audit resolves; reduces perceived latency |
| No database / user accounts | Out of scope; keeps architecture simple and deployable as a stateless app |
| Fallback lessons pre-generated | Protects demo reliability against API outage or rate limits; loaded via `fs.readFileSync` |
| Parallel generation in `/api/compare`, sequential audits | Generation calls are independent (parallel); audit calls share rate-limit budget (sequential) |
| `server/package.json` `"type": "module"` | Required for ESM `import` syntax across all server files |
| `import 'dotenv/config'` as first line of `index.js` | ESM hoisting means module-level code in `geminiClient.js` runs before `dotenv.config()` if placed later; first-line import ensures env vars exist before any other module loads |
