export function buildCriticPrompt(storyboard) {
  return `You are a strict academic fact-checker and university professor for computer science and engineering coursework.
Review each scene of the following lesson storyboard for technical and factual correctness.

VERIFICATION INSTRUCTIONS:
1. Examine each factual claim in the scene's heading, bullets, narration, and checkpoint.
2. Cross-reference against established academic textbook definitions, standard network protocols (RFC standards), and scientific facts.
3. If a scene contains an incorrect concept, wrong number of protocol steps (e.g., claiming TCP connection establishment is 4-way instead of 3-way), non-existent packet types (e.g., a "CONFIRM" packet in TCP handshake), or false explanations, you MUST:
   - Assign a confidence score strictly below 70 (in the 0 to 69 range).
   - Explicitly list each factual error in the "issues" array.
   - Provide a factual, accurate rewrite in "corrected_text".
4. If a scene is fully accurate and adheres to standard engineering definitions, assign a confidence score between 90 and 100, set "issues" to [], and set "corrected_text" to null.

AUDIT SCHEMA: Return ONLY a valid JSON array where each element corresponds to one scene:
[
  {
    "scene_id": number,
    "confidence": number, // integer 0-100 (STRICT: < 70 if any factual error is present)
    "issues": [string],   // list of specific factual errors, gaps, or inaccuracies (empty [] if none)
    "corrected_text": string | null // corrected explanation/narration if errors found, otherwise null
  }
]

Confidence Scoring Criteria:
- 90 to 100: Factually accurate, scientifically sound, definitions and formulas correct.
- 70 to 89: Minor imprecisions, slight ambiguity, or non-critical omission.
- 0 to 69: Significant factual error, wrong protocol steps, incorrect equation, fictitious packets, or misleading claims.

Storyboard to audit:
${JSON.stringify(storyboard, null, 2)}

Return ONLY the JSON array matching the AUDIT SCHEMA. No markdown fences. No commentary.`
}
