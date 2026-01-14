import { Router } from 'express'
import { journalHeadersController } from './journal-headers.controller'
import { authenticate } from '../../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../../middleware/permission.middleware'
import { queryMiddleware } from '../../../../middleware/query.middleware'
import { validateSchema, ValidatedAuthRequest } from '../../../../middleware/validation.middleware'
import { PermissionService } from '../../../../services/permission.service'
import { 
  createJournalSchema, 
  updateJournalSchema, 
  journalIdSchema,
  submitJournalSchema,
  rejectJournalSchema,
  reverseJournalSchema
} from './journal-headers.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../../types/request.types'

PermissionService.registerModule('journals', 'Journal Entries Management').catch((error) => {
  console.error('Failed to register journals module:', error.message)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// List journals
router.get('/', canView('journals'), queryMiddleware({
  allowedSortFields: ['journal_number', 'journal_date', 'journal_type', 'status', 'total_debit', 'created_at', 'updated_at', 'id'],
}), (req, res) => 
  journalHeadersController.list(req as AuthenticatedQueryRequest, res))

// Get journal by ID
router.get('/:id', canView('journals'), validateSchema(journalIdSchema), (req, res) => 
  journalHeadersController.getById(req as AuthenticatedRequest, res))

// Create journal
router.post('/', canInsert('journals'), validateSchema(createJournalSchema), (req, res) => 
  journalHeadersController.create(req as ValidatedAuthRequest<typeof createJournalSchema>, res))

// Update journal (DRAFT only)
router.put('/:id', canUpdate('journals'), validateSchema(updateJournalSchema), (req, res) => 
  journalHeadersController.update(req as ValidatedAuthRequest<typeof updateJournalSchema>, res))

// Delete journal (DRAFT only)
router.delete('/:id', canDelete('journals'), validateSchema(journalIdSchema), (req, res) => 
  journalHeadersController.delete(req as AuthenticatedRequest, res))

// Workflow actions
router.post('/:id/submit', canUpdate('journals'), validateSchema(submitJournalSchema), (req, res) => 
  journalHeadersController.submit(req as AuthenticatedRequest, res))

router.post('/:id/approve', canUpdate('journals'), validateSchema(journalIdSchema), (req, res) => 
  journalHeadersController.approve(req as AuthenticatedRequest, res))

router.post('/:id/reject', canUpdate('journals'), validateSchema(rejectJournalSchema), (req, res) => 
  journalHeadersController.reject(req as ValidatedAuthRequest<typeof rejectJournalSchema>, res))

router.post('/:id/post', canUpdate('journals'), validateSchema(journalIdSchema), (req, res) => 
  journalHeadersController.post(req as AuthenticatedRequest, res))

router.post('/:id/reverse', canUpdate('journals'), validateSchema(reverseJournalSchema), (req, res) => 
  journalHeadersController.reverse(req as ValidatedAuthRequest<typeof reverseJournalSchema>, res))

export default router
