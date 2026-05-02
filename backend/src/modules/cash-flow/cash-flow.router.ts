import { Router } from 'express'
import { cashFlowSalesController } from './cash-flow-sales.controller'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../middleware/permission.middleware'
import { requireWriteAccess } from '../../middleware/write-guard.middleware'
import {
  createPeriodBalanceSchema, updatePeriodBalanceSchema, deletePeriodBalanceSchema,
  getSuggestionSchema, listPeriodsSchema,
  createGroupSchema, updateGroupSchema, deleteGroupSchema, reorderGroupsSchema,
  getCashFlowDailySchema,
} from './cash-flow-sales.schema'

const MODULE = 'cash_flow'
const router = Router()

router.use(authenticate, resolveBranchContext)

// Period Balance
router.get('/periods', canView(MODULE), validateSchema(listPeriodsSchema), (req, res) => cashFlowSalesController.listPeriods(req, res))
router.post('/periods', requireWriteAccess, canInsert(MODULE), validateSchema(createPeriodBalanceSchema), (req, res) => cashFlowSalesController.createPeriod(req, res))
router.put('/periods/:id', requireWriteAccess, canUpdate(MODULE), validateSchema(updatePeriodBalanceSchema), (req, res) => cashFlowSalesController.updatePeriod(req, res))
router.delete('/periods/:id', requireWriteAccess, canDelete(MODULE), validateSchema(deletePeriodBalanceSchema), (req, res) => cashFlowSalesController.deletePeriod(req, res))

// Suggestion
router.get('/suggestion', canView(MODULE), validateSchema(getSuggestionSchema), (req, res) => cashFlowSalesController.getSuggestion(req, res))

// Payment Method Groups
router.get('/groups', canView(MODULE), (req, res) => cashFlowSalesController.listGroups(req, res))
router.post('/groups', requireWriteAccess, canInsert(MODULE), validateSchema(createGroupSchema), (req, res) => cashFlowSalesController.createGroup(req, res))
router.put('/groups/reorder', requireWriteAccess, canUpdate(MODULE), validateSchema(reorderGroupsSchema), (req, res) => cashFlowSalesController.reorderGroups(req, res))
router.put('/groups/:id', requireWriteAccess, canUpdate(MODULE), validateSchema(updateGroupSchema), (req, res) => cashFlowSalesController.updateGroup(req, res))
router.delete('/groups/:id', requireWriteAccess, canDelete(MODULE), validateSchema(deleteGroupSchema), (req, res) => cashFlowSalesController.deleteGroup(req, res))

// Cash Flow Daily
router.get('/daily', canView(MODULE), validateSchema(getCashFlowDailySchema), (req, res) => cashFlowSalesController.getCashFlowDaily(req, res))

// Branches
router.get('/branches', canView(MODULE), (req, res) => cashFlowSalesController.getBranches(req, res))

export default router
