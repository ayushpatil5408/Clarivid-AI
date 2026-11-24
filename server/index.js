import 'dotenv/config'

import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import generateRoute from './routes/generate.js'
import auditRoute from './routes/audit.js'
import compareRoute from './routes/compare.js'
import reexplainRoute from './routes/reexplain.js'
import askRoute from './routes/ask.js'
import { errorHandler } from './middleware/errorHandler.js'
import { requestLogger } from './middleware/requestLogger.js'

const app = express()
app.use(cors())
app.use(express.json())
app.use(requestLogger)

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
})
app.use('/api', limiter)

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    mockAi: process.env.MOCK_AI === 'true',
    timestamp: new Date().toISOString()
  })
})

app.use('/api/generate', generateRoute)
app.use('/api/audit', auditRoute)
app.use('/api/compare', compareRoute)
app.use('/api/reexplain', reexplainRoute)
app.use('/api/ask', askRoute)

app.use(errorHandler)

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`LearnLoop server running on port ${PORT} (MOCK_AI=${process.env.MOCK_AI === 'true'})`)
})
