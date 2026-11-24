import axios from 'axios'

const BASE = '/api'

export const generateLesson = (payload) =>
  axios.post(`${BASE}/generate`, payload).then((r) => r.data)

export const auditLesson = (storyboard) =>
  axios.post(`${BASE}/audit`, { storyboard }).then((r) => r.data)

export const checkHealth = () =>
  axios.get(`${BASE}/health`).then((r) => r.data)
