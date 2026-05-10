import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { positionsController } from './positions.controller'
import { createPositionSchema, updatePositionSchema, positionIdSchema, listPositionsSchema } from './positions.schema'
import { PermissionService } from '../../services/permission.service'

PermissionService.registerModule('positions', 'Position Management').catch((err) => {
  console.error('Failed to register positions module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('positions'), validateSchema(listPositionsSchema), (req, res) => positionsController.list(req, res))
router.post('/', requireWriteAccess, canInsert('positions'), validateSchema(createPositionSchema), (req, res) => positionsController.create(req, res))
router.get('/:id', canView('positions'), validateSchema(positionIdSchema), (req, res) => positionsController.getById(req, res))
router.put('/:id', requireWriteAccess, canUpdate('positions'), validateSchema(updatePositionSchema), (req, res) => positionsController.update(req, res))
router.delete('/:id', requireWriteAccess, canDelete('positions'), validateSchema(positionIdSchema), (req, res) => positionsController.delete(req, res))

export default router
