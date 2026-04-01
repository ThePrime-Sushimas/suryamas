import { Router } from "express"
import { requireApiKey } from '../../../middleware/api-key.middleware'
import { salesController } from "./pos-sync.controller"

const router = Router()

router.post('/import', requireApiKey, salesController.import)

export default router