import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

const FIXTURE_COMPARE = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/compare.json'), 'utf8')
)

router.post('/', async (req, res, next) => {
  try {
    const { topic, level, language } = req.body

    // In mock mode or until Phase 4 full compare, return fixture
    if (process.env.MOCK_AI === 'true') {
      return res.json({
        ...FIXTURE_COMPARE,
        mockAi: true
      })
    }

    res.json(FIXTURE_COMPARE)
  } catch (err) {
    next(err)
  }
})

export default router
