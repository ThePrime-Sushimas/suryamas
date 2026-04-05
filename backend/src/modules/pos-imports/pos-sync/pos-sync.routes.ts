import { Router } from "express"
import { requireApiKey } from '../../../middleware/api-key.middleware'
import { salesController, masterController } from "./pos-sync.controller"

const router = Router()

// Transaksi — jalur existing
router.post('/import', requireApiKey, salesController.import)

// Master data — jalur baru
router.post('/master', requireApiKey, masterController.sync)


export default router