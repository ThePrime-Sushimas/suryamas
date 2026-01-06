// backend/src/modules/payment-terms/payment-terms.routes.ts

import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { paginationMiddleware } from '../../middleware/pagination.middleware'
import { sortMiddleware } from '../../middleware/sort.middleware'
import { filterMiddleware } from '../../middleware/filter.middleware'
import { paymentTermsController } from './payment-terms.controller'
import { PermissionService } from '../../services/permission.service'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../types/request.types'

const router = Router()

PermissionService.registerModule('payment_terms', 'Payment Terms Management').catch(() => {})

router.use(authenticate, resolveBranchContext)

router.get('/', canView('payment_terms'), paginationMiddleware, sortMiddleware, filterMiddleware, (req, res) =>
  paymentTermsController.list(req as AuthenticatedQueryRequest, res))

router.get('/minimal/active', authenticate, (req, res) =>
  paymentTermsController.minimalActive(req as AuthenticatedRequest, res))

router.get('/:id', canView('payment_terms'), (req, res) =>
  paymentTermsController.findById(req as AuthenticatedRequest, res))

router.post('/', canInsert('payment_terms'), (req, res) =>
  paymentTermsController.create(req as AuthenticatedRequest, res))

router.put('/:id', canUpdate('payment_terms'), (req, res) =>
  paymentTermsController.update(req as AuthenticatedRequest, res))

router.delete('/:id', canDelete('payment_terms'), (req, res) =>
  paymentTermsController.delete(req as AuthenticatedRequest, res))

router.post('/:id/restore', canUpdate('payment_terms'), (req, res) =>
  paymentTermsController.restore(req as AuthenticatedRequest, res))

export default router
