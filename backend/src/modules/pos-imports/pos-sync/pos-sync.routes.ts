import { Router } from "express"
import { requireApiKey } from '../../../middleware/api-key.middleware'
import { authenticate } from '../../../middleware/auth.middleware'
import { salesController, masterController, stagingController } from "./pos-sync.controller"

const router = Router()

// Transaksi — jalur existing
router.post('/import', requireApiKey, salesController.import)

// Master data — jalur baru
router.post('/master', requireApiKey, masterController.sync)

// Dari web admin (JWT)
router.get('/staging/:table',     authenticate, stagingController.list)
router.patch('/staging/:table/:id', authenticate, stagingController.update)


export default router