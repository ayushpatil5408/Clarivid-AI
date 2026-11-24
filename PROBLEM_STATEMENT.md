# LearnLoop: An Interactive, Fact-Audited AI Explainer Generator

**Subject:** AI Tools and Prompt Engineering
**Project type:** Mini Project
**Document:** Problem Statement and Project Overview

---

## 1. One-Line Summary

LearnLoop turns any topic into an interactive, scene-by-scene explainer lesson that is fact-checked by a second AI agent, available in English or Hinglish, tagged with exam-mark relevance, and able to adapt itself when the student gets confused. It also shows exactly how prompt engineering shaped the result.

---

## 2. Background

AI video and explainer generators such as Invideo, Magiclight, X-Pilot and Google NotebookLM have made it easy to turn text into presentation-style videos or audio overviews. Students increasingly use them to learn difficult subjects quickly.

However, most of these tools are built as **content-production tools**, not **learning tools**. They generate a finished, linear artefact (an MP4 or a slide video) and hand it to the user. The student then watches passively, with no way to interact with the content, verify it, or adapt it to their needs.

---

## 3. Problem Statement

Students who learn from AI-generated explainers face five recurring problems:

| # | Problem | Why it matters |
|---|---------|----------------|
| 1 | **Passive, linear playback.** The output is a fixed video. | If a student is confused mid-scene, they cannot ask a question and get an answer in context. They must pause, leave, and search elsewhere. |
| 2 | **Unverified content (hallucinations).** Tools usually carry only a generic disclaimer such as "output may contain inaccuracies". | A wrong formula or definition looks as confident as a correct one. Students cannot tell the difference, and the burden of verification falls entirely on them. |
| 3 | **One-size-fits-all difficulty.** Personalisation is typically a single prompt such as "explain for beginners". | The video does not respond to whether the student actually understood it. |
| 4 | **Weak fit for Indian students.** Output is usually standard English or a generic translation or dubbing. | Many Indian students think and study in code-mixed Hinglish, and they need content aligned to exam patterns (for example B.Tech university exams or NCERT-based boards), not just general explanation. |
| 5 | **Black-box prompting.** The prompt engineering behind the output is hidden. | Learners and developers cannot see how prompt design affects output quality, so the process is hard to learn from or evaluate. |

**Core problem:** *There is a need for an AI explainer tool that is interactive, verifiable, adaptive to the learner's understanding, culturally and academically relevant to Indian students, and transparent about how its AI prompts produce its output.*

---

## 4. Research Findings: Existing Tools and Gaps

The following summarises the comparison of existing tools. Gaps are described as areas these tools do **not offer as a core workflow**, rather than as absolute claims, since the tools evolve quickly.

| Feature Area | Existing Tools (Invideo, Magiclight, X-Pilot, NotebookLM) | Gap Addressed by LearnLoop |
|---|---|---|
| Playback experience | Linear MP4 or passive slide video | **Pause and Ask:** the student asks a question mid-lesson and a short explanatory scene is generated and inserted on the spot |
| Hallucination control | Generic disclaimer or manual user review | **Dual-LLM Fact-Audit:** a second "Critic" agent reviews every scene and shows a confidence badge before the student sees it |
| Prerequisite adaptation | Single difficulty prompt | **Confusion-Triggered Re-Explainer:** a wrong answer on a checkpoint quiz triggers a simpler re-explanation of the next scene |
| Indian student context | Standard English or generic translation | **Hinglish mode and Exam-Blueprint tags:** natural code-mixed explanation, with slides tagged by exam mark type (for example 2-mark definition, 5-mark diagram) |
| Prompt transparency | Black-box generation | **Prompt Inspector:** shows how zero-shot and role-based few-shot JSON prompting change the output |

---

## 5. Proposed Solution

LearnLoop is a web application with a **Scene Player** instead of a rendered video. Each lesson is a structured JSON storyboard. Each scene in it is displayed as an animated slide with browser-based text-to-speech narration.

This design choice is deliberate:

- To the learner it feels like a short video (animated slides, voice narration, progress bar).
- Because every scene is structured data, interactivity (pausing, asking, re-explaining, quizzing) becomes simple to implement.
- It avoids heavy video rendering pipelines, keeping the project feasible and fast.

### 5.1 Workflow

```
Topic + Level + Language
        |
        v
[LLM 1: Storyboard Generator]  -->  JSON scenes
        |
        v
[LLM 2: Critic / Auditor]      -->  confidence score + issues per scene
        |
        v
Scene Player (slides + TTS narration)
        |
        v
Checkpoint quiz  -->  wrong answer  -->  Re-explainer (simpler scene)
        |
        v
"Ask" button     -->  student question  -->  inserted micro-scene
```

---

## 6. Objectives

1. Build a working web application that generates an interactive explainer lesson from a topic.
2. Reduce the risk of misinformation by adding an automated second-agent fact audit with visible confidence indicators.
3. Support Hinglish explanations and exam-oriented tagging for Indian students.
4. Adapt the lesson in response to student performance on checkpoint questions.
5. Demonstrate and compare prompt engineering techniques (zero-shot vs role-based few-shot JSON prompting) transparently inside the product.

---

## 7. Features

### 7.1 Core features (must build)

| Feature | Description |
|---|---|
| **Topic-to-storyboard generation** | User enters a topic, difficulty level and language. The system returns a validated JSON storyboard of scenes. |
| **Scene Player** | One scene at a time with animated bullets, play, pause, next and previous controls, a progress bar, and spoken narration using the browser's speech synthesis. |
| **Dual-LLM Fact-Audit** | A Critic agent reviews each scene and returns a confidence score (0-100), a list of issues, and corrected text where needed. The player shows a green, yellow or red badge per scene. |
| **Hinglish mode** | Narration and on-screen text are generated in natural code-mixed Hinglish. Text-to-speech uses the Hindi-India voice. |
| **Exam-mark tags** | Each scene carries a tag such as "2-mark definition", "5-mark diagram" or "numerical", helping students prioritise. |
| **Prompt Inspector** | Runs the same topic through Prompt A (zero-shot) and Prompt B (role-based, schema-constrained, few-shot) and shows both prompts and both outputs side by side with comparison metrics. |

### 7.2 Secondary features (build if time allows)

| Feature | Description |
|---|---|
| **Checkpoint quiz** | A short multiple-choice question after selected scenes to check understanding. |
| **Confusion-triggered re-explainer** | If the student answers incorrectly, the system rewrites the next scene with a simpler analogy and replaces it in the lesson. |

### 7.3 Stretch features

| Feature | Description |
|---|---|
| **Pause and Ask** | At any point the student can pause and type a question. The system generates a short micro-scene answering it and inserts it into the lesson at the current position. |
| **Export** | Download the lesson as JSON or print-friendly notes. |

### 7.4 Out of scope

To keep the project achievable, the following are intentionally excluded:

- Rendering real video files (MP4) with FFmpeg or Remotion
- AI avatars, voice cloning and stock footage libraries
- User accounts and databases
- Support for languages other than English and Hinglish

---

## 8. Prompt Engineering Component

This project is built around prompt engineering and is designed so that the techniques used are visible and measurable.

| Technique | Where it is used |
|---|---|
| **Zero-shot prompting** | Prompt A in the Prompt Inspector, serving as the baseline |
| **Role-based prompting** | Prompt B: "You are an experienced B.Tech professor..." |
| **Few-shot prompting** | Prompt B includes one worked example storyboard |
| **Structured output (JSON schema)** | Enforced through schema instructions and the API's JSON response mode |
| **Constraint-based prompting** | Limits on scene count, narration length, and tone and language rules (Hinglish) |
| **Critic / self-verification pattern** | Second LLM call that audits the first LLM's output |
| **Adaptive re-prompting** | Re-explainer prompt rewrites a scene with a simpler analogy based on student failure |
| **Retry with validation** | Output is validated against the schema, and one automatic retry is made if parsing fails |

### Comparison metrics (Prompt Inspector)

For each prompt mode, the tool reports:

- Whether the output is valid JSON matching the schema
- Number of scenes generated
- Completeness (presence of narration, exam tag, checkpoint)
- Average fact-audit confidence score
- Generation time

---

## 9. Technical Design

### 9.1 Technology stack

| Layer | Choice |
|---|---|
| Frontend | Vite + React |
| Backend | Node.js + Express |
| AI model | Google Gemini API (JSON response mode) |
| Voice | Browser Web Speech API (`speechSynthesis`) |
| Development environment | Antigravity IDE |

The API key is stored in a backend `.env` file and is never exposed to the frontend.

### 9.2 Storyboard JSON schema

```json
{
  "title": "TCP Three-Way Handshake",
  "language": "hinglish",
  "level": "beginner",
  "scenes": [
    {
      "id": 1,
      "heading": "What is a handshake?",
      "bullets": ["Two devices agree before talking", "Uses SYN, SYN-ACK, ACK"],
      "narration": "Socho do log phone par baat shuru karne se pehle confirm karte hain...",
      "visual_hint": "Diagram of client and server exchanging three arrows",
      "exam_tag": "2-mark definition",
      "checkpoint": {
        "q": "Which flag does the client send first?",
        "options": ["ACK", "SYN", "FIN", "RST"],
        "answer": 1
      }
    }
  ]
}
```

### 9.3 Audit output schema

```json
{
  "scene_id": 1,
  "confidence": 92,
  "issues": ["Minor: SYN-ACK should be explained as a combined flag set"],
  "corrected_text": null
}
```

Confidence bands: **90-100 green**, **70-89 yellow**, **below 70 red**.

### 9.4 API endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/generate` | Generate a storyboard (accepts topic, level, language, prompt mode) |
| `POST /api/audit` | Run the Critic agent on a storyboard |
| `POST /api/compare` | Run Prompt A and Prompt B and return both results with metrics |
| `POST /api/reexplain` | Rewrite a scene with a simpler analogy |
| `POST /api/ask` | Generate a micro-scene from a student question (stretch) |

---

## 10. Target Users

- **Primary:** Indian undergraduate engineering students (B.Tech) and school students (NCERT-based curricula) revising concepts before exams.
- **Secondary:** Students and educators of prompt engineering who want to see how prompt design changes AI output.

---

## 11. Expected Outcomes

1. A functioning web app that generates, audits and plays interactive explainer lessons.
2. A measurable demonstration that role-based, schema-constrained, few-shot prompting produces more reliable and complete output than zero-shot prompting.
3. A visible reduction of blind trust in AI output through per-scene confidence badges.
4. A learning experience tailored to Indian students through Hinglish and exam-aligned tagging.

---

## 12. Evaluation Plan

| Criterion | How it will be evaluated |
|---|---|
| Schema reliability | Percentage of generations that produce valid JSON on the first attempt, for Prompt A vs Prompt B, across 5 or more topics |
| Content quality | Manual check of 3-5 topics against textbook definitions |
| Audit usefulness | Whether the Critic correctly flags deliberately inserted errors (for example a wrong formula) in a test storyboard |
| Language quality | Informal review of Hinglish naturalness and text-to-speech clarity |
| Usability | Walkthrough of the full flow (topic, lesson, quiz, re-explain) without errors |

---

## 13. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| LLM returns malformed JSON | JSON response mode, schema validation, one automatic retry |
| The Critic LLM is itself wrong | Present the score as a *confidence indicator*, not a guarantee, and state this limitation clearly in the report |
| API is slow or rate-limited during the demo | Keep pre-generated fallback lessons for 2-3 topics |
| Hinglish text-to-speech sounds unnatural | Use the Hindi-India voice and keep narration sentences short; treat it as a known limitation |
| Time overrun | Build vertically (end-to-end first), and cut stretch features before polishing core ones |

---

## 14. Limitations

- The fact audit uses another AI model and does not replace human or textbook verification.
- Browser text-to-speech voice quality varies by device and browser.
- Lessons are slide-style presentations, not rendered video.
- Hinglish quality depends on the underlying model.

---

## 15. Future Scope

- Real video export (MP4) using a rendering pipeline
- Additional Indian languages (Marathi, Tamil, Bengali and others)
- Retrieval-augmented generation grounded in uploaded notes or NCERT and university syllabus PDFs
- Student progress tracking and personalised revision plans
- Teacher dashboard for assigning and reviewing lessons

---

## 16. Conclusion

Existing AI explainer tools are optimised for producing content quickly, not for helping students learn reliably. LearnLoop shifts the focus to the learner by making the output interactive, verifiable, adaptive and relevant to Indian exam contexts, while exposing its prompt engineering so that the techniques behind it can be studied and evaluated.
