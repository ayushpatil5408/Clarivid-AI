export function buildCriticPrompt(storyboard) {
  return `You are a rigorous, multi-disciplinary academic fact-checker.
Review each scene of the following educational lesson storyboard for factual correctness, accuracy of definitions, formulas, and technical integrity.

VERIFICATION INSTRUCTIONS:
1. Carefully analyze each factual claim, definition, scientific law, historical statement, and mathematical/chemical formula across the scene's heading, bullets, narration, and checkpoint question/options.
2. Cross-examine claims against established academic standards, textbook definitions, scientific consensus, and official specifications.
3. If a scene contains any factual error, false claim, incorrect formula, wrong step in a process, or invalid checkpoint answer:
   - Assign a confidence score strictly below 70 (in the 0 to 69 range).
   - Detail every identified error clearly in the "issues" array.
   - Provide an accurate, factual correction in "corrected_text".
4. If a scene is fully correct, precise, and verified:
   - Assign a confidence score between 90 and 100.
   - Set "issues" to [].
   - Set "corrected_text" to null.
5. If a scene has minor ambiguity, slight imprecision, or missing non-critical nuance but no direct falsehood:
   - Assign a confidence score between 70 and 89, note the observation in "issues", and optionally suggest refined wording in "corrected_text".

AUDIT SCHEMA: Return ONLY a valid JSON array where each element corresponds to one scene:
[
  {
    "scene_id": number,
    "confidence": number, // integer 0-100 (strictly < 70 if any factual error is present)
    "issues": [string],   // list of specific factual errors, gaps, or inaccuracies (empty [] if none)
    "corrected_text": string | null // corrected explanation/narration if errors found, otherwise null
  }
]

Confidence Scoring Criteria:
- 90 to 100: Factually accurate, academically sound, definitions and formulas correct.
- 70 to 89: Minor imprecisions, slight ambiguity, or non-critical omission without direct factual falsehood.
- 0 to 69: Significant factual error, incorrect process/equation/formula, false claims, or misleading information.

Storyboard to audit:
${JSON.stringify(storyboard, null, 2)}

Return ONLY the JSON array matching the AUDIT SCHEMA. No markdown fences. No commentary.`
}
