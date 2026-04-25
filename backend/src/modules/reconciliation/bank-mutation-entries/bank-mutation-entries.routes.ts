import { Router } from 'express'
import { bankMutationEntriesController } from './bank-mutation-entries.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canDelete } from '../../../middleware/permission.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { createRateLimit, updateRateLimit } from '../../../middleware/rateLimiter.middleware'
import {
  reconcileWithMutationEntrySchema,
  voidMutationEntrySchema,
  listMutationEntriesSchema,
  coaSuggestionsSchema,
} from './bank-mutation-entries.schema'
import type { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule(
  'bank_mutation_entries',
  'Bank Mutation Entries (Non-POS Reconciliation)',
).catch(() => {})

const router = Router()

// All routes: authenticate → resolveBranchContext
router.use(authenticate, resolveBranchContext)

/**
 * @route GET /api/v1/bank-mutation-entries
 * @desc List bank mutation entries with filters & pagination
 */
router.get(
  '/',
  canView('bank_mutation_entries'),
  validateSchema(listMutationEntriesSchema),
  (req, res) => bankMutationEntriesController.list(req as ValidatedAuthRequest<typeof listMutationEntriesSchema>, res),
)

/**
 * @route GET /api/v1/bank-mutation-entries/coa-suggestions
 * @desc Get COA suggestions based on entry type
 */
router.get(
  '/coa-suggestions',
  canView('bank_mutation_entries'),
  validateSchema(coaSuggestionsSchema),
  (req, res) => bankMutationEntriesController.getCoaSuggestions(req as ValidatedAuthRequest<typeof coaSuggestionsSchema>, res),
)

/**
 * @route GET /api/v1/bank-mutation-entries/:id
 * @desc Get single mutation entry detail
 */
router.get(
  '/:id',
  canView('bank_mutation_entries'),
  (req, res) => bankMutationEntriesController.getById(req as ValidatedAuthRequest<typeof voidMutationEntrySchema>, res),
)

/**
 * @route POST /api/v1/bank-mutation-entries/reconcile
 * @desc One-step: create mutation entry + reconcile bank statement + auto-create journal
 */
router.post(
  '/reconcile',
  canInsert('bank_mutation_entries'),
  createRateLimit,
  validateSchema(reconcileWithMutationEntrySchema),
  (req, res) => bankMutationEntriesController.reconcile(req as ValidatedAuthRequest<typeof reconcileWithMutationEntrySchema>, res),
)

/**
 * @route POST /api/v1/bank-mutation-entries/:id/void
 * @desc Void a mutation entry — undo reconciliation + reverse journal
 */
router.post(
  '/:id/void',
  canDelete('bank_mutation_entries'),
  updateRateLimit,
  validateSchema(voidMutationEntrySchema),
  (req, res) => bankMutationEntriesController.voidEntry(req as ValidatedAuthRequest<typeof voidMutationEntrySchema>, res),
)

export default router
