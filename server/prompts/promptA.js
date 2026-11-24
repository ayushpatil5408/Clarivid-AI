export function buildPromptA({ topic, level, language }) {
  return `Generate a lesson storyboard about <<<TOPIC>>>${topic}<<<END_TOPIC>>> for ${level} level students in ${language}.
Return valid JSON with this structure:
{ "title": "", "language": "${language}", "level": "${level}", "scenes": [ { "id": 1, "heading": "", "bullets": [], "narration": "", "visual_hint": "", "exam_tag": "", "checkpoint": { "q": "", "options": ["", "", "", ""], "answer": 0 } } ] }`
}
