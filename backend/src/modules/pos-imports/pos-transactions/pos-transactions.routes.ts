/**
 * POS Transactions Routes
 */

import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView } from '../../../middleware/permission.middleware'
import * as controller from './pos-transactions.controller'

const router = Router()

router.get(
  '/',
  authenticate,
  resolveBranchContext,
  canView('pos_imports'),
  controller.list
)

router.get(
  '/export',
  authenticate,
  resolveBranchContext,
  canView('pos_imports'),
  controller.exportToExcel
)

export default router
