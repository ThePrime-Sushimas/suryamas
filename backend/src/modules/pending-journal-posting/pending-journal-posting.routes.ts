import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware'
import { resolveBranchContext } from '../../middleware/branch-context.middleware'
import { canView, canUpdate } from '../../middleware/permission.middleware'
import { validateSchema } from '../../middleware/validation.middleware'
import { PermissionService } from '../../services/permission.service'
import { pendingJournalPostingController } from './pending-journal-posting.controller'
import { listPendingSchema, postSingleSchema, postBulkSchema } from './pending-journal-posting.schema'

const MODULE = 'pending_journal_posting'

PermissionService.registerModule(MODULE, 'Pending Journal Posting — Cross-Module View & Action').catch(() => {})

const router = Router()

router.use(authenticate, resolveBranchContext)

// List pending records with summary
router.get(
  '/',
  canView(MODULE),
  validateSchema(listPendingSchema),
  (req, res) => pendingJournalPostingController.list(req, res),
)

// Post single record
router.post(
  '/:module/:id/post',
  canUpdate(MODULE),
  validateSchema(postSingleSchema),
  (req, res) => pendingJournalPostingController.postSingle(req, res),
)

// Bulk post (same module)
router.post(
  '/bulk-post',
  canUpdate(MODULE),
  validateSchema(postBulkSchema),
  (req, res) => pendingJournalPostingController.postBulk(req, res),
)

export default router
