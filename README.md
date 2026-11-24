# LearnLoop 🔄

LearnLoop is an AI-powered micro-learning studio that transforms educational concepts into bite-sized, interactive storyboards featuring synchronized text-to-speech audio narration, automated factual accuracy audits, and adaptive checkpoint quizzes with real-time AI re-explanation. Built with Node.js/Express and React/Vite, it features a dual-prompt architecture with prompt mode A (naive single-prompt) vs mode B (chain-of-thought with pedagogical structure and exam tagging), an automated critic agent that evaluates factual soundness and flags issues with suggested corrections, and a built-in Prompt Inspector for side-by-side benchmarking.

---

## Architecture & Features

- **Multi-Scene Storyboards**: Generates structured 5–7 scene micro-lessons with clear visual hints, explanatory narration, and concept breakdowns.
- **Pedagogical Prompting (Mode A vs Mode B)**: Mode A provides basic instructional generation, while Mode B incorporates chain-of-thought scaffolding, active learning checkpoints, and exam relevance tagging.
- **Fact-Checking Critic Agent**: Background audit system evaluates each scene's factual integrity, assigning confidence scores (0–100), itemizing issues, and proposing precise text corrections.
- **Adaptive Checkpoint Quizzes**: Scene quizzes assess learner comprehension. Answering incorrectly triggers on-the-fly re-explanation of the subsequent scene to reinforce prerequisite knowledge.
- **Synchronized Audio Narration**: Built-in speech synthesis (supporting English and Hinglish) with sentence-by-sentence playback controls.
- **Prompt Inspector**: Side-by-side benchmarking view to compare Prompt A and Prompt B across JSON compliance, audit confidence, scene count, and execution latency.
- **Resilient AI Layer**: Automatic retries with exponential backoff for transient network errors, secondary fallback model routing (`GEMINI_FALLBACK_MODEL`), daily quota detection (`429`), in-memory query caching, and a full offline `MOCK_AI` mode.

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
  Loads a pre-computed TCP Handshake lesson containing a deliberately planted factual error (claims the handshake is a 4-step process). Demonstrates the critic agent catching the error, rendering a warning/alert audit badge with confidence < 70, itemizing the flaw, and providing a suggested correction.

- **`http://localhost:5173/?demo=flawed-bio`**  
  Loads a Photosynthesis biology lesson with a planted factual mistake (claims light-independent reactions take place on thylakoid membranes).

- **`http://localhost:5173/?audit=live`**  
  Forces a live critic audit via the Gemini API, bypassing pre-computed fallback audits for demo lessons.

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
