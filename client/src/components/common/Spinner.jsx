import React from 'react'

export default function Spinner({ message = 'Generating lesson with AI...' }) {
  return (
    <div className="spinner-container">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  )
}
