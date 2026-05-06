import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { cogsController } from './cogs.controller'
import { cogsPreviewSchema, cogsFinalizeSchema, cogsIdSchema, cogsListSchema } from './cogs.schema'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule('cogs', 'COGS Calculation').catch((err) => {
  console.error('Failed to register cogs module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('cogs'), validateSchema(cogsListSchema), (req, res) => cogsController.list(req, res))
router.post('/preview', canView('cogs'), validateSchema(cogsPreviewSchema), (req, res) => cogsController.preview(req, res))
router.post('/finalize', canInsert('cogs'), validateSchema(cogsFinalizeSchema), (req, res) => cogsController.finalize(req, res))
router.get('/:id', canView('cogs'), validateSchema(cogsIdSchema), (req, res) => cogsController.getById(req, res))

export default router
