import crypto from 'crypto'

export const generateCache = new Map()
export const auditCache = new Map()

export function getGenerateCacheKey(topic, level, language, promptMode) {
  const t = (topic || '').trim().toLowerCase()
  const lev = (level || 'beginner').toLowerCase()
  const lang = (language || 'english').toLowerCase()
  const mode = (promptMode || 'B').toUpperCase()
  return `${t}:${lev}:${lang}:${mode}`
}

export function getStoryboardHash(storyboard) {
  if (!storyboard) return ''
  const str = typeof storyboard === 'string' ? storyboard : JSON.stringify(storyboard)
  return crypto.createHash('sha256').update(str).digest('hex')
}
