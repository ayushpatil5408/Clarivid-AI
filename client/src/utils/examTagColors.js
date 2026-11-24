export const EXAM_TAGS = {
  '2-mark definition': {
    label: '2-Mark Definition',
    badgeClass: 'tag-definition',
    color: '#4ade80',
    bgColor: 'rgba(34, 197, 94, 0.2)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    icon: '📝'
  },
  '5-mark diagram': {
    label: '5-Mark Diagram',
    badgeClass: 'tag-diagram',
    color: '#60a5fa',
    bgColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: 'rgba(59, 130, 246, 0.4)',
    icon: '📊'
  },
  'numerical': {
    label: 'Numerical Problem',
    badgeClass: 'tag-numerical',
    color: '#fb923c',
    bgColor: 'rgba(249, 115, 22, 0.2)',
    borderColor: 'rgba(249, 115, 22, 0.4)',
    icon: '🔢'
  },
  'conceptual': {
    label: 'Conceptual Question',
    badgeClass: 'tag-conceptual',
    color: '#c084fc',
    bgColor: 'rgba(168, 85, 247, 0.2)',
    borderColor: 'rgba(168, 85, 247, 0.4)',
    icon: '💡'
  }
}

export function getExamTagInfo(tag) {
  if (!tag) return null
  const normalized = String(tag).trim().toLowerCase()
  return (
    EXAM_TAGS[normalized] || {
      label: tag,
      badgeClass: 'tag-default',
      color: '#94a3b8',
      bgColor: 'rgba(148, 163, 184, 0.15)',
      borderColor: 'rgba(148, 163, 184, 0.3)',
      icon: '🏷️'
    }
  )
}
