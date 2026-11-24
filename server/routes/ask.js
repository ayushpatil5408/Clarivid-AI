import { Router } from 'express'

const router = Router()

// Stretch feature: not implemented until Phase 6
router.post('/', (_req, res) => {
  res.status(501).json({ error: 'Pause and Ask is not yet implemented (Phase 6 stretch feature).' })
})

export default router
