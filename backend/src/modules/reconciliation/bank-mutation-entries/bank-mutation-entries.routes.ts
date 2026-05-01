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
  mutationEntryIdSchema,
  listMutationEntriesSchema,
  coaSuggestionsSchema,
} from './bank-mutation-entries.schema'
import { PermissionService } from '../../../services/permission.service'

PermissionService.registerModule(
  'bank_mutation_entries',
  'Bank Mutation Entries (Non-POS Reconciliation)',
).catch((err) => console.error('Failed to register bank_mutation_entries module:', err))

const router = Router()

router.use(authenticate, resolveBranchContext)

router.get(
  '/',
  canView('bank_mutation_entries'),
  validateSchema(listMutationEntriesSchema),
  (req, res) => bankMutationEntriesController.list(req, res),
)

router.get(
  '/coa-suggestions',
  canView('bank_mutation_entries'),
  validateSchema(coaSuggestionsSchema),
  (req, res) => bankMutationEntriesController.getCoaSuggestions(req, res),
)

router.get(
  '/:id',
  canView('bank_mutation_entries'),
  validateSchema(mutationEntryIdSchema),
  (req, res) => bankMutationEntriesController.getById(req, res),
)

router.post(
  '/reconcile',
  canInsert('bank_mutation_entries'),
  createRateLimit,
  validateSchema(reconcileWithMutationEntrySchema),
  (req, res) => bankMutationEntriesController.reconcile(req, res),
)

router.post(
  '/:id/void',
  canDelete('bank_mutation_entries'),
  updateRateLimit,
  validateSchema(voidMutationEntrySchema),
  (req, res) => bankMutationEntriesController.voidEntry(req, res),
)

export default router
