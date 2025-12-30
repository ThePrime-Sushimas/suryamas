import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { productUomsController } from './product-uoms.controller'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedRequest } from '../../types/request.types'

PermissionService.registerModule('product-uoms', 'Product UOM Management').catch(() => {})

const router = Router({ mergeParams: true })

router.use(authenticate, resolveBranchContext)

router.get('/', canView('product-uoms'), (req, res) => 
  productUomsController.list(req as AuthenticatedRequest, res))

router.post('/', canInsert('product-uoms'), (req, res) => 
  productUomsController.create(req as AuthenticatedRequest, res))

router.put('/:uomId', canUpdate('product-uoms'), (req, res) => 
  productUomsController.update(req as AuthenticatedRequest, res))

router.delete('/:uomId', canDelete('product-uoms'), (req, res) => 
  productUomsController.delete(req as AuthenticatedRequest, res))

router.post('/:uomId/restore', canUpdate('product-uoms'), (req, res) => 
  productUomsController.restore(req as AuthenticatedRequest, res))

export default router
