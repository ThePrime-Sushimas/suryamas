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
import type { AuthenticatedQueryRequest } from '../../../types/request.types'
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import type { GetImportByIdReq } from './bank-statement-import.controller'
import {
  uploadBankStatementSchema,
  confirmBankStatementImportSchema,
  getImportByIdSchema,
  deleteImportSchema,
  listImportsQuerySchema,
  getImportStatementsSchema,
} from './bank-statement-import.schema'

// Configure multer for file upload
const upload = multer({
  dest: '/tmp/uploads',
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv',
    ]

    if (allowedMimeTypes.includes(file.mimetype)) {
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
  (req, res) => bankStatementImportController.list(req as AuthenticatedQueryRequest, res)
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
  (req, res) => bankStatementImportController.getStatements(req as AuthenticatedQueryRequest, res)
)

// Get summary endpoint
router.get(
  '/:id/summary',
  canView('bank_statement_imports'),
  (req, res) => bankStatementImportController.getSummary(req as AuthenticatedQueryRequest, res)
)

// Preview endpoint
router.get(
  '/:id/preview',
  canView('bank_statement_imports'),
  (req, res) => bankStatementImportController.preview(req as AuthenticatedQueryRequest, res)
)

// Cancel endpoint
router.post(
  '/:id/cancel',
  canInsert('bank_statement_imports'),
  (req, res) => bankStatementImportController.cancel(req as AuthenticatedQueryRequest, res)
)

// Retry endpoint
router.post(
  '/:id/retry',
  canInsert('bank_statement_imports'),
  (req, res) => bankStatementImportController.retry(req as AuthenticatedQueryRequest, res)
)

// Delete endpoint
router.delete(
  '/:id',
  canDelete('bank_statement_imports'),
  validateSchema(deleteImportSchema),
  (req, res) => bankStatementImportController.delete(req as ValidatedAuthRequest<typeof deleteImportSchema>, res)
)

export default router

