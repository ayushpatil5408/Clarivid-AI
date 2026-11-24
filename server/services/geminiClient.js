import { GoogleGenAI } from '@google/genai'

export async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing')
  }
  if (!model) {
    throw new Error('GEMINI_MODEL environment variable is missing')
  }

  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      responseMimeType: 'application/json'
    }
  })

  const text = response.text
  return JSON.parse(text)
}
