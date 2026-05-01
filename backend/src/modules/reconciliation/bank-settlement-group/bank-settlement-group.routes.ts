import { Router } from 'express'
import { settlementGroupController } from './bank-settlement-group.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert } from '../../../middleware/permission.middleware'
import { queryMiddleware } from '../../../middleware/query.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { createRateLimit, updateRateLimit } from '../../../middleware/rateLimiter.middleware'
import { PermissionService } from '../../../services/permission.service'
import {
  createSettlementGroupSchema,
  getSettlementGroupListSchema,
  getSettlementGroupByIdSchema,
  undoSettlementGroupSchema,
  getSettlementGroupAggregatesSchema,
  getAvailableAggregatesSchema,
  getSuggestionsSchema,
} from './bank-settlement-group.schema'

PermissionService.registerModule('bank_settlement_group', 'Bank Settlement Group Management')
  .catch((err) => console.error('Failed to register bank_settlement_group module:', err))

const router = Router()

router.use(authenticate, resolveBranchContext)

router.use(queryMiddleware({
  allowedSortFields: ['id', 'created_at', 'updated_at', 'settlement_date', 'total_statement_amount', 'status'],
}))

router.post('/create', canInsert('bank_settlement_group'), createRateLimit,
  validateSchema(createSettlementGroupSchema),
  (req, res) => settlementGroupController.create(req, res))

router.get('/list', canView('bank_settlement_group'),
  validateSchema(getSettlementGroupListSchema),
  (req, res) => settlementGroupController.getList(req, res))

router.get('/aggregates/available', canView('bank_settlement_group'),
  validateSchema(getAvailableAggregatesSchema),
  (req, res) => settlementGroupController.getAvailableAggregates(req, res))

router.get('/suggestions', canView('bank_settlement_group'),
  validateSchema(getSuggestionsSchema),
  (req, res) => settlementGroupController.getSuggestedAggregates(req, res))

router.get('/:id', canView('bank_settlement_group'),
  validateSchema(getSettlementGroupByIdSchema),
  (req, res) => settlementGroupController.getById(req, res))

router.get('/:id/aggregates', canView('bank_settlement_group'),
  validateSchema(getSettlementGroupAggregatesSchema),
  (req, res) => settlementGroupController.getSettlementAggregates(req, res))

router.delete('/:id', canInsert('bank_settlement_group'), updateRateLimit,
  validateSchema(undoSettlementGroupSchema),
  (req, res) => settlementGroupController.delete(req, res))

export default router
