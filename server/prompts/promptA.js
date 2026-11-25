export function buildPromptA({ topic, level, language }) {
  return `Generate a lesson storyboard of 5-7 scenes about <<<TOPIC>>>${topic}<<<END_TOPIC>>> for ${level} level students in ${language}.
Return valid JSON with this structure:
{
  "title": "string",
  "language": "${language}",
  "level": "${level}",
  "scenes": [
    {
      "id": 1,
      "heading": "string",
      "bullets": ["string"],
      "narration": "string",
      "visual_hint": "string",
      "exam_tag": "2-mark definition",
      "checkpoint": { "q": "string", "options": ["string", "string", "string", "string"], "answer": 0 }
    }
  ]
}
CONSTRAINTS:
- scenes array MUST contain between 5 and 7 scenes.
- exam_tag must be one of: "2-mark definition", "5-mark diagram", "numerical", "conceptual".
- Narration must not exceed 120 words per scene.
- Every checkpoint must have exactly 4 options and a 0-indexed numeric answer (0, 1, 2, or 3).
- Return valid JSON only, no markdown commentary.`
}
