import { Router } from 'express'
import { journalHeadersController } from './journal-headers.controller'
import { authenticate } from '../../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete, canApprove, canRelease } from '../../../../middleware/permission.middleware'
import { queryMiddleware } from '../../../../middleware/query.middleware'
import { validateSchema } from '../../../../middleware/validation.middleware'
import { PermissionService } from '../../../../services/permission.service'
import { 
  createJournalSchema, 
  updateJournalSchema, 
  journalIdSchema,
  submitJournalSchema,
  rejectJournalSchema,
  reverseJournalSchema
} from './journal-headers.schema'

PermissionService.registerModule('journals', 'Journal Entries Management').catch((error) => {
  console.error('Failed to register journals module:', error.message)
})

const router = Router()

router.use(authenticate, resolveBranchContext)

// List journals
router.get('/', canView('journals'), queryMiddleware({
  allowedSortFields: ['journal_number', 'journal_date', 'journal_type', 'status', 'total_debit', 'created_at', 'updated_at', 'id'],
}), (req, res) => 
  journalHeadersController.list(req, res))

// List journals with lines (for General Journal View)
router.get('/with-lines', canView('journals'), queryMiddleware({
  allowedSortFields: ['journal_number', 'journal_date', 'journal_type', 'status', 'total_debit', 'created_at', 'updated_at', 'id'],
}), (req, res) => 
  journalHeadersController.listWithLines(req, res))

// Status counts (for dashboard)
router.get('/status-counts', canView('journals'), (req, res) =>
  journalHeadersController.statusCounts(req, res))

// Get journal completeness (unreconciled channels)
router.get('/:id/completeness', canView('journals'), validateSchema(journalIdSchema), (req, res) =>
  journalHeadersController.getCompleteness(req, res))

// Get journal by ID
router.get('/:id', canView('journals'), validateSchema(journalIdSchema), (req, res) => 
  journalHeadersController.getById(req, res))

// Create journal
router.post('/', canInsert('journals'), validateSchema(createJournalSchema), (req, res) => 
  journalHeadersController.create(req, res))

// Update journal (DRAFT only)
router.put('/:id', canUpdate('journals'), validateSchema(updateJournalSchema), (req, res) => 
  journalHeadersController.update(req, res))

// Delete journal (DRAFT only)
router.delete('/:id', canDelete('journals'), validateSchema(journalIdSchema), (req, res) => 
  journalHeadersController.delete(req, res))

// Workflow actions (CORRECTED PERMISSIONS)
router.post('/:id/submit', canUpdate('journals'), validateSchema(submitJournalSchema), (req, res) => 
  journalHeadersController.submit(req, res))

router.post('/:id/approve', canApprove('journals'), validateSchema(journalIdSchema), (req, res) => 
  journalHeadersController.approve(req, res))

router.post('/:id/reject', canApprove('journals'), validateSchema(rejectJournalSchema), (req, res) => 
  journalHeadersController.reject(req, res))

router.post('/:id/post', canRelease('journals'), validateSchema(journalIdSchema), (req, res) => 
  journalHeadersController.post(req, res))

router.post('/:id/reverse', canRelease('journals'), validateSchema(reverseJournalSchema), (req, res) => 
  journalHeadersController.reverse(req, res))

// Restore deleted journal
router.post('/:id/restore', canInsert('journals'), validateSchema(journalIdSchema), (req, res) => 
  journalHeadersController.restore(req, res))

router.delete('/:id/force', canRelease('journals'), validateSchema(journalIdSchema), (req, res) => 
  journalHeadersController.forceDelete(req, res))

export default router
