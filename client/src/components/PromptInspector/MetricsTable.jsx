import React from 'react'

export default function MetricsTable({ metricsA, metricsB }) {
  if (!metricsA && !metricsB) return null

  // Helpers to compare metrics and decide which side is better (null if tie or missing)
  const getBetterSide = (valA, valB, higherIsBetter = true) => {
    if (valA === undefined || valA === null || valB === undefined || valB === null) return null
    if (valA === valB) return null
    if (higherIsBetter) {
      return valA > valB ? 'A' : 'B'
    } else {
      return valA < valB ? 'A' : 'B'
    }
  }

  const rows = [
    {
      label: 'Valid JSON',
      valA: metricsA?.isValidJson ? 'Yes' : 'No',
      valB: metricsB?.isValidJson ? 'Yes' : 'No',
      better: getBetterSide(Boolean(metricsA?.isValidJson), Boolean(metricsB?.isValidJson), true)
    },
    {
      label: 'Schema Compliance',
      valA: metricsA?.complianceScore !== undefined && metricsA?.complianceScore !== null ? `${metricsA.complianceScore}%` : 'N/A',
      valB: metricsB?.complianceScore !== undefined && metricsB?.complianceScore !== null ? `${metricsB.complianceScore}%` : 'N/A',
      better: getBetterSide(metricsA?.complianceScore, metricsB?.complianceScore, true)
    },
    {
      label: 'Scene Count',
      valA: metricsA?.scenes ?? 'N/A',
      valB: metricsB?.scenes ?? 'N/A',
      // Target range 5-7
      better: (() => {
        const a = metricsA?.scenes ?? 0
        const b = metricsB?.scenes ?? 0
        if (a === b) return null
        const aInRange = a >= 5 && a <= 7
        const bInRange = b >= 5 && b <= 7
        if (aInRange && !bInRange) return 'A'
        if (bInRange && !aInRange) return 'B'
        return a > b ? 'A' : 'B'
      })()
    },
    {
      label: 'Avg Fact-Confidence',
      valA: metricsA?.avgConfidence !== undefined && metricsA?.avgConfidence !== null ? `${metricsA.avgConfidence}/100` : 'N/A',
      valB: metricsB?.avgConfidence !== undefined && metricsB?.avgConfidence !== null ? `${metricsB.avgConfidence}/100` : 'N/A',
      better: getBetterSide(metricsA?.avgConfidence, metricsB?.avgConfidence, true)
    },
    {
      label: 'Generation Latency',
      valA: metricsA?.timeMs !== undefined ? `${metricsA.timeMs}ms` : 'N/A',
      valB: metricsB?.timeMs !== undefined ? `${metricsB.timeMs}ms` : 'N/A',
      better: getBetterSide(metricsA?.timeMs, metricsB?.timeMs, false) // lower latency is better
    }
  ]

  return (
    <div className="metrics-table-card">
      <h4 className="metrics-table-title">📊 Comparative Evaluation Metrics</h4>
      <div className="table-responsive">
        <table className="metrics-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Prompt A (Zero-shot Baseline)</th>
              <th>Prompt B (Role + Few-shot + Schema)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="metric-label">{r.label}</td>
                <td className={`metric-val ${r.better === 'A' ? 'highlight-better' : ''}`}>
                  {r.valA} {r.better === 'A' && <span className="winner-tag">★ Better</span>}
                </td>
                <td className={`metric-val ${r.better === 'B' ? 'highlight-better' : ''}`}>
                  {r.valB} {r.better === 'B' && <span className="winner-tag">★ Better</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="metrics-note">
        <em>Note: Results come from a single run and vary between runs.</em>
      </p>
    </div>
  )
}
