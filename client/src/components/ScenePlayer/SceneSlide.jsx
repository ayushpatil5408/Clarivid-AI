import React from 'react'

export default function SceneSlide({ scene }) {
  if (!scene) return null

  const getTagClass = (tag) => {
    switch (tag) {
      case '2-mark definition':
        return 'tag-definition'
      case '5-mark diagram':
        return 'tag-diagram'
      case 'numerical':
        return 'tag-numerical'
      case 'conceptual':
        return 'tag-conceptual'
      default:
        return 'tag-default'
    }
  }

  return (
    <div className="scene-slide">
      <div className="slide-header">
        <h3 className="scene-title">{scene.heading}</h3>
        {scene.exam_tag && (
          <span className={`exam-tag ${getTagClass(scene.exam_tag)}`}>
            🏷️ {scene.exam_tag}
          </span>
        )}
      </div>

      <ul className="bullet-points">
        {scene.bullets?.map((bullet, idx) => (
          <li key={idx} className="bullet-item">
            {bullet}
          </li>
        ))}
      </ul>

      {scene.visual_hint && (
        <div className="visual-hint">
          <strong>Visual:</strong> {scene.visual_hint}
        </div>
      )}

      {scene.narration && (
        <div className="narration-box">
          <p className="narration-text">{scene.narration}</p>
        </div>
      )}
    </div>
  )
}
