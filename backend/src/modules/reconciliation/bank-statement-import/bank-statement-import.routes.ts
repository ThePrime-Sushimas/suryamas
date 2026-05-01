/**
 * Bank Statement Import Routes
 * Route definitions untuk bank statement import operations
 */

import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canDelete } from '../../../middleware/permission.middleware'
import { queryMiddleware } from '../../../middleware/query.middleware'
import { createRateLimit, updateRateLimit } from '../../../middleware/rateLimiter.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { bankStatementImportController } from './bank-statement-import.controller'
import { PermissionService } from '../../../services/permission.service'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { GetImportByIdReq, ManualEntryReq, ManualBulkEntryReq, HardDeleteStatementReq, HardDeleteBulkStatementsReq } from './bank-statement-import.controller'
import {
  uploadBankStatementSchema,
  confirmBankStatementImportSchema,
  getImportByIdSchema,
  deleteImportSchema,
  listImportsQuerySchema,
  getImportStatementsSchema,
  manualEntrySchema,
  manualBulkEntrySchema,
  hardDeleteStatementSchema,
  hardDeleteBulkStatementsSchema,
  listManualEntriesSchema,
} from './bank-statement-import.schema'
import { FILE_UPLOAD } from './bank-statement-import.constants'

// Configure multer for file upload
const upload = multer({
  dest: '/tmp/uploads',
  limits: {
    fileSize: FILE_UPLOAD.MAX_SIZE, // 50MB from constants
  },
  fileFilter: (req, file, cb) => {
    if (FILE_UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) or CSV (.csv) files are allowed.'))
    }
  },
})

// Register module in permission system
PermissionService.registerModule('bank_statement_imports', 'Bank Statement Import Management').catch(() => {})

const router = Router()

// All routes require authentication and branch context
router.use(authenticate, resolveBranchContext)

// ==================== MANUAL ENTRY ROUTES ====================

// List manual entries grouped by month
router.get(
  '/manual',
  canView('bank_statement_imports'),
  validateSchema(listManualEntriesSchema),
  (req, res) => bankStatementImportController.listManualEntries(req as ValidatedAuthRequest<typeof listManualEntriesSchema>, res)
)

// Single manual entry
router.post(
  '/manual',
  canInsert('bank_statement_imports'),
  createRateLimit,
  validateSchema(manualEntrySchema),
  (req, res) => bankStatementImportController.manualEntry(req as ManualEntryReq, res)
)

// Bulk manual entry
router.post(
  '/manual/bulk',
  canInsert('bank_statement_imports'),
  createRateLimit,
  validateSchema(manualBulkEntrySchema),
  (req, res) => bankStatementImportController.manualBulkEntry(req as ManualBulkEntryReq, res)
)

// ==================== HARD DELETE ROUTES ====================

// Hard delete single statement
router.delete(
  '/statements/:id/hard',
  canDelete('bank_statement_imports'),
  validateSchema(hardDeleteStatementSchema),
  (req, res) => bankStatementImportController.hardDeleteStatement(req as HardDeleteStatementReq, res)
)

// Hard delete bulk statements
router.post(
  '/statements/hard-delete',
  canDelete('bank_statement_imports'),
  validateSchema(hardDeleteBulkStatementsSchema),
  (req, res) => bankStatementImportController.hardDeleteBulkStatements(req as HardDeleteBulkStatementsReq, res)
)

// ==================== FILE UPLOAD ROUTES ====================

// Query middleware for GET endpoints with pagination, sorting, and filtering
router.use(queryMiddleware({
  allowedSortFields: ['id', 'created_at', 'updated_at', 'import_date', 'bank_account_id', 'status']
}))

// Upload endpoint
router.post(
  '/upload',
  canInsert('bank_statement_imports'),
  createRateLimit,
  upload.single('file'),
  validateSchema(uploadBankStatementSchema),
  (req, res) => bankStatementImportController.upload(req as ValidatedAuthRequest<typeof uploadBankStatementSchema>, res)
)

// Confirm endpoint
router.post(
  '/:id/confirm',
  canInsert('bank_statement_imports'),
  updateRateLimit,
  validateSchema(confirmBankStatementImportSchema),
  (req, res) => bankStatementImportController.confirm(req as ValidatedAuthRequest<typeof confirmBankStatementImportSchema>, res)
)

// List endpoint
router.get(
  '/',
  canView('bank_statement_imports'),
  validateSchema(listImportsQuerySchema),
  (req, res) => bankStatementImportController.list(req, res)
)

// Get by ID endpoint
router.get(
  '/:id',
  canView('bank_statement_imports'),
  validateSchema(getImportByIdSchema),
  (req, res) => bankStatementImportController.getById(req as GetImportByIdReq, res)
)

// Get statements endpoint
router.get(
  '/:id/statements',
  canView('bank_statement_imports'),
  validateSchema(getImportStatementsSchema),
  (req, res) => bankStatementImportController.getStatements(req, res)
)

// Get summary endpoint
router.get(
  '/:id/summary',
  canView('bank_statement_imports'),
  (req, res) => bankStatementImportController.getSummary(req, res)
)

// Preview endpoint
router.get(
  '/:id/preview',
  canView('bank_statement_imports'),
  (req, res) => bankStatementImportController.preview(req, res)
)

// Cancel endpoint
router.post(
  '/:id/cancel',
  canInsert('bank_statement_imports'),
  (req, res) => bankStatementImportController.cancel(req, res)
)

// Retry endpoint
router.post(
  '/:id/retry',
  canInsert('bank_statement_imports'),
  (req, res) => bankStatementImportController.retry(req, res)
)

// Delete endpoint
router.delete(
  '/:id',
  canDelete('bank_statement_imports'),
  validateSchema(deleteImportSchema),
  (req, res) => bankStatementImportController.delete(req as ValidatedAuthRequest<typeof deleteImportSchema>, res)
)

export default router

