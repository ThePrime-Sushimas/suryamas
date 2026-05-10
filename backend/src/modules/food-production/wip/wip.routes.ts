import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { wipController } from './wip.controller'
import { createWipItemSchema, updateWipItemSchema, wipItemIdSchema, bulkDeleteWipSchema, wipPositionAccessSchema } from './wip.schema'
import { wipPositionAccessController } from './wip-position-access.controller'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule('wip_items', 'WIP Item Management').catch((err) => {
  console.error('Failed to register wip_items module:', err instanceof Error ? err.message : err)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get('/', canView('wip_items'), (req, res) => wipController.list(req, res))
router.get('/search', canView('wip_items'), (req, res) => wipController.search(req, res))
router.post('/bulk/delete', canDelete('wip_items'), validateSchema(bulkDeleteWipSchema), (req, res) => wipController.bulkDelete(req, res))
router.post('/', canInsert('wip_items'), validateSchema(createWipItemSchema), (req, res) => wipController.create(req, res))
router.get('/:id', canView('wip_items'), validateSchema(wipItemIdSchema), (req, res) => wipController.getById(req, res))
router.put('/:id', canUpdate('wip_items'), validateSchema(updateWipItemSchema), (req, res) => wipController.update(req, res))
router.delete('/:id', canDelete('wip_items'), validateSchema(wipItemIdSchema), (req, res) => wipController.delete(req, res))
router.patch('/:id/restore', canUpdate('wip_items'), validateSchema(wipItemIdSchema), (req, res) => wipController.restore(req, res))

// Position Access
router.get('/:id/position-access', canView('wip_items'), validateSchema(wipItemIdSchema), (req, res) => wipPositionAccessController.get(req, res))
router.put('/:id/position-access', canUpdate('wip_items'), validateSchema(wipPositionAccessSchema), (req, res) => wipPositionAccessController.set(req, res))

export default router
