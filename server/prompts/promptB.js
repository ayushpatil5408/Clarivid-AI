const EXAMPLE_SCENE = {
  id: 1,
  heading: 'What is a handshake?',
  bullets: ['Two devices agree before talking', 'Uses SYN, SYN-ACK, ACK'],
  narration: 'Socho do log phone par baat shuru karne se pehle confirm karte hain ki dono ready hain — exactly aisa hi TCP karta hai.',
  visual_hint: 'Diagram of client and server exchanging three arrows labelled SYN, SYN-ACK, ACK',
  exam_tag: '2-mark definition',
  checkpoint: {
    q: 'Which flag does the client send first?',
    options: ['ACK', 'SYN', 'FIN', 'RST'],
    answer: 1
  }
}

export function buildPromptB({ topic, level, language }) {
  return `You are an experienced B.Tech professor who creates concise, exam-focused lesson storyboards.

TASK: Generate a storyboard of 5-7 scenes about <<<TOPIC>>>${topic}<<<END_TOPIC>>> for ${level} students in ${language}.

LANGUAGE RULES:
- If language is "hinglish": write narration as natural code-mixed Hindi-English (not a translation). Use Devanagari sparingly; prefer Roman Hinglish.
- If language is "english": use clear, formal but friendly English.

CONSTRAINTS:
- Narration per scene: maximum 120 words
- exam_tag must be one of: "2-mark definition", "5-mark diagram", "numerical", "conceptual"
- Every scene must have a checkpoint with exactly 4 options
- Checkpoint answer must be a 0-indexed number indicating the correct option
- Output must be valid JSON only — no markdown fences, no commentary

JSON SCHEMA:
{
  "title": "string",
  "language": "string",
  "level": "string",
  "scenes": [
    {
      "id": "number",
      "heading": "string",
      "bullets": ["string"],
      "narration": "string",
      "visual_hint": "string",
      "exam_tag": "string",
      "checkpoint": { "q": "string", "options": ["string", "string", "string", "string"], "answer": "number" }
    }
  ]
}

EXAMPLE SCENE:
${JSON.stringify(EXAMPLE_SCENE, null, 2)}

Now generate the full storyboard for topic: <<<TOPIC>>>${topic}<<<END_TOPIC>>>`
}
