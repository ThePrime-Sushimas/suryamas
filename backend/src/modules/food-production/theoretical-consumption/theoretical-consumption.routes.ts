import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { theoreticalConsumptionController } from './theoretical-consumption.controller'
import { theoreticalConsumptionQuerySchema } from './theoretical-consumption.schema'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule('consumption_analysis', 'Analisa Konsumsi Bahan').catch((err) => {
  console.error('Failed to register consumption_analysis module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('consumption_analysis'), validateSchema(theoreticalConsumptionQuerySchema), (req, res) => theoreticalConsumptionController.getTheoretical(req, res))
router.get('/variance', canView('consumption_analysis'), validateSchema(theoreticalConsumptionQuerySchema), (req, res) => theoreticalConsumptionController.getVariance(req, res))
router.get('/coverage', canView('consumption_analysis'), validateSchema(theoreticalConsumptionQuerySchema), (req, res) => theoreticalConsumptionController.getCoverage(req, res))

export default router
