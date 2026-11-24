import { Router } from 'express'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const router = Router()
const __dirname = dirname(fileURLToPath(import.meta.url))

const FIXTURE_REEXPLAIN = JSON.parse(
  readFileSync(join(__dirname, '../fixtures/reexplain.json'), 'utf8')
)

router.post('/', async (req, res, next) => {
  try {
    const { scene, language, reason } = req.body

    // In mock mode or until Phase 5 full AI, return fixture
    if (process.env.MOCK_AI === 'true') {
      return res.json({
        ...FIXTURE_REEXPLAIN,
        mockAi: true
      })
    }

    // Default / stub behavior returning simpler scene fixture
    res.json(FIXTURE_REEXPLAIN)
  } catch (err) {
    next(err)
  }
})

export default router
