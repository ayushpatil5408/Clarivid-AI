export function buildReexplainPrompt({ scene, language = 'english', reason = 'wrong_answer' }) {
  return `You are an expert, empathetic tutor helping a student who just struggled with a concept.
A student answered the checkpoint quiz for the following scene INCORRECTLY (reason: ${reason}).
Rewrite this scene using a simpler analogy, clearer intuitive framing, and plainer language so the concept becomes crystal clear.

CRITICAL CONSTRAINTS:
1. Retain the exact same JSON schema structure as the original scene.
2. The scene must include:
   - "id": ${scene?.id || 1}
   - "heading": string
   - "bullets": array of 2 to 4 concise strings
   - "narration": string (MAXIMUM 120 words — strictly enforced)
   - "visual_hint": string describing an intuitive analogy illustration
   - "exam_tag": one of "2-mark definition", "5-mark diagram", "numerical", "conceptual"
   - "checkpoint": object with "q" (string), "options" (exactly 4 strings), and "answer" (0-indexed numeric integer)
3. Language requirement: ${language}.
   - If "hinglish": write narration in natural Roman-script Hinglish.
   - If "english": write narration in simple, accessible English.
4. Output must be valid JSON only. No markdown fences. No commentary.

Original Scene:
${JSON.stringify(scene, null, 2)}

Return ONLY a JSON object with this shape:
{
  "simpler_scene": {
    "id": ${scene?.id || 1},
    "heading": "string",
    "bullets": ["string"],
    "narration": "string",
    "visual_hint": "string",
    "exam_tag": "conceptual",
    "checkpoint": {
      "q": "string",
      "options": ["string", "string", "string", "string"],
      "answer": 0
    }
  }
}`
}
