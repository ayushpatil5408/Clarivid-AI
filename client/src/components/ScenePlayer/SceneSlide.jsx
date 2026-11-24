import React from 'react'
import { getExamTagInfo } from '../../utils/examTagColors'

export default function SceneSlide({ scene }) {
  if (!scene) return null

  const tagInfo = getExamTagInfo(scene.exam_tag)

  return (
    <div className="scene-slide">
      <div className="slide-header">
        <h3 className="scene-title">{scene.heading}</h3>
        {tagInfo && (
          <span
            className={`exam-tag ${tagInfo.badgeClass}`}
            style={{
              backgroundColor: tagInfo.bgColor,
              borderColor: tagInfo.borderColor,
              color: tagInfo.color
            }}
          >
            {tagInfo.icon} {tagInfo.label}
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
