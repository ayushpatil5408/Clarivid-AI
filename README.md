# LearnLoop 🔄

LearnLoop is an AI-powered micro-learning studio that transforms educational concepts into bite-sized, interactive storyboards featuring synchronized text-to-speech audio narration, automated factual accuracy audits, and adaptive checkpoint quizzes with real-time AI re-explanation. Built with Node.js/Express and React/Vite, it features a dual-prompt architecture comparing Prompt A (Zero-shot) against Prompt B (Role + Few-shot + Schema), an automated critic agent that evaluates factual soundness and flags issues with suggested corrections, and a built-in Prompt Inspector for side-by-side benchmarking.

---

## Architecture & Features

- **Multi-Scene Storyboards**: Generates structured 5–7 scene micro-lessons with clear visual hints, explanatory narration, and concept breakdowns.
- **Prompt Engineering Techniques (Prompt A vs Prompt B)**: Prompt A provides a zero-shot baseline, while Prompt B incorporates role specification, few-shot demonstration, strict JSON schema constraints, and active learning checkpoints.
- **Fact-Checking Critic Agent**: Background audit system evaluates each scene's factual integrity, assigning confidence scores (0–100), itemizing issues, and proposing precise text corrections.
- **Adaptive Checkpoint Quizzes**: Scene quizzes assess learner comprehension. Answering incorrectly triggers on-the-fly re-explanation of the subsequent scene to reinforce prerequisite knowledge.
- **Synchronized Audio Narration**: Built-in speech synthesis (supporting English and Hinglish) with sentence-by-sentence playback controls.
- **Prompt Inspector**: Side-by-side benchmarking view to compare Prompt A and Prompt B across JSON compliance, audit confidence, scene count, and execution latency.
- **Resilient AI Layer**: Automatic retries with exponential backoff for transient network errors, secondary fallback model routing (`GEMINI_FALLBACK_MODEL`), daily quota detection (`429`), in-memory query caching, and a full offline `MOCK_AI` mode.

---

## Prompt Engineering Techniques

The application exclusively employs the following prompt engineering techniques, mapped directly to their implementations in the codebase:

| Technique | Description | Implementation File | Exported Signature |
| :--- | :--- | :--- | :--- |
| **Zero-shot** (Prompt A) | Baseline prompt generating JSON without persona or example scenes | `server/prompts/promptA.js` | `buildPromptA({ topic, level, language })` |
| **Role-based + Few-shot + Schema-constrained + Constraint-based** (Prompt B) | Uses persona (`"experienced B.Tech professor"`), 1 example scene, JSON schema, and strict constraints (5–7 scenes, ≤120 words narration, exactly 4 checkpoint options, 1 of 4 exam tags) | `server/prompts/promptB.js` | `buildPromptB({ topic, level, language })` |
| **Critic / Self-verification pattern** | Evaluates factual soundness per scene using fact-checker persona (`"rigorous, multi-disciplinary academic fact-checker"`), returning confidence (0–100, <70 if flawed), issues array, and `corrected_text` | `server/prompts/criticPrompt.js`<br>(used in `server/routes/audit.js`) | `buildCriticPrompt(storyboard)` |
| **Adaptive re-prompting** | Empathetic tutor persona (`"expert, empathetic tutor"`) rewrites a scene with simpler analogies and clearer framing when a student answers a checkpoint quiz incorrectly | `server/prompts/reexplainPrompt.js`<br>(used in `server/routes/reexplain.js`) | `buildReexplainPrompt({ scene, language, reason })` |
| **Retry with validation** | Wraps generation with 1 schema validation retry if JSON parsing or schema validation fails. Appends static reinforcement instructions; does **not** feed dynamic validation error messages back to the model | `server/services/validator.js`<br>(called in `server/routes/generate.js`) | `callWithRetry(promptFn, retryInstructions)` |

> **Note on Retry Mechanism:** `callWithRetry` in `server/services/validator.js` catches parsing and schema validation failures and retries once by executing `promptFn() + '\n\n' + retryInstructions`. It appends static reinforcement instructions; it does **not** feed model validation error strings back into the prompt.

---

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **Google Gemini API Key**: (Optional if running in `MOCK_AI=true` mode)

---

## Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd LearnLoop
   ```

2. **Install Server Dependencies**:
   ```bash
   cd server
   npm install
   ```

3. **Install Client Dependencies**:
   ```bash
   cd ../client
   npm install
   ```

4. **Configure Environment Variables**:
   In the `server/` directory, create a `.env` file from the example:
   ```bash
   cd ../server
   cp .env.example .env
   ```

   Configure the variables in `server/.env`:
   ```ini
   PORT=3001
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   GEMINI_MODEL=gemini-2.5-flash
   GEMINI_FALLBACK_MODEL=gemini-1.5-flash
   MOCK_AI=false
   ```

   *Note: If you do not have an active API key or have hit daily quota limits, set `MOCK_AI=true` to run against pre-computed realistic fixtures without making any external API calls.*

---

## Running the Application

1. **Start the Express Backend**:
   ```bash
   cd server
   npm start
   # Server listens on http://localhost:3001
   ```

2. **Start the Vite Client**:
   ```bash
   cd client
   npm run dev
   # Vite dev server runs on http://localhost:5173
   ```

3. Open **`http://localhost:5173`** in your browser.

---

## Demo URLs

LearnLoop includes pre-configured URL query parameters for demonstration, testing, and debugging:

- **`http://localhost:5173/?demo=flawed`**  
  Loads a pre-computed TCP Handshake lesson containing a deliberately planted factual error (claims the handshake is a 4-step process) alongside a precomputed audit result. This reliably demonstrates the critic UI (confidence < 70, warning badge, itemized flaw, suggested correction) without consuming API quota.

- **`http://localhost:5173/?demo=flawed-bio`**  
  Loads a Photosynthesis biology lesson with a planted factual mistake alongside a precomputed audit result.

- **`http://localhost:5173/?audit=live`** (or combined, e.g. `?demo=flawed&audit=live`)  
  Runs the critic for real via the Gemini API, bypassing pre-computed fallback audits.

> **Plain Statement on Audits:** `?demo=flawed` and `?demo=flawed-bio` use **precomputed audits**, and only **`?audit=live`** runs the critic for real.

---

## Testing

LearnLoop includes a zero-dependency automated test runner that injects mock AI responses to verify critical architectural paths without spending API quota:

```bash
cd server
npm test
```

The test suite asserts:
1. Valid storyboard outputs pass schema validation with a 100 compliance score.
2. Malformed JSON triggers exactly one auto-correction validation retry.
3. HTTP 429 daily quota exhaustion aborts immediately without redundant backoff retries, returning `quota_exceeded`.
4. `/api/compare` returns results for both prompt modes even if one side encounters an error.
5. Scene re-explanation produces a valid, updated storyboard scene.

---

## Evaluation Benchmark Runner

To evaluate prompt quality and critic accuracy across benchmark topics ("TCP Three-Way Handshake", "Photosynthesis", "Newton's Laws of Motion"):

```bash
cd server
npm run evaluate -- --confirm
```

*Requirements:*
- Requires a valid `GEMINI_API_KEY` and `MOCK_AI=false`.
- Requires the explicit `--confirm` flag to prevent accidental quota consumption.
- Generates side-by-side metrics and critic verification tables, saving raw outputs to `evaluation/results.json` and a formatted report to `evaluation/summary.md`.

---

## Known Limitations

- **Critic Confidence Calibration**: The confidence score (0–100) returned by the critic agent represents the LLM's self-assessed confidence estimate based on its prompt instructions. It is not an externally calibrated statistical probability, and edge cases may occasionally exhibit minor over- or under-confidence.
- **Browser Text-to-Speech Quality**: Speech synthesis uses the browser's native Web Speech API (`window.speechSynthesis`). Voice inflection, accent fidelity, and Hinglish pronunciation vary depending on the host operating system and selected browser engine.
- **API Quota Constraints**: Gemini API free-tier tiers enforce daily rate limits (~20 requests/day). LearnLoop mitigates this via `MOCK_AI=true`, transparent caching, and `GEMINI_FALLBACK_MODEL`, but prolonged live evaluations require a paid tier or quota reset.
- **Keyword-Based Fallback Matching**: When network or quota failures prevent live generation, the fallback resolver matches topics against curated static lessons (`tcp-handshake.json`, `photosynthesis.json`) using simple keyword heuristics. Unrecognized topics fall back to the default TCP Handshake lesson.
