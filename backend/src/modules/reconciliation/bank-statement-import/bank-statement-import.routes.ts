/**
 * Bank Statement Import Routes
 * Route definitions untuk bank statement import operations
 */

import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canDelete } from '../../../middleware/permission.middleware'
import { createRateLimit, updateRateLimit } from '../../../middleware/rateLimiter.middleware'
import { validateSchema } from '../../../middleware/validation.middleware'
import { bankStatementImportController } from './bank-statement-import.controller'
import { PermissionService } from '../../../services/permission.service'
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

// Upload endpoint
router.post(
  '/upload',
  canInsert('bank_statement_imports'),
  createRateLimit,
  upload.single('file'),
  validateSchema(uploadBankStatementSchema),
  bankStatementImportController.upload
)

// Confirm endpoint
router.post(
  '/:id/confirm',
  canInsert('bank_statement_imports'),
  updateRateLimit,
  validateSchema(confirmBankStatementImportSchema),
  bankStatementImportController.confirm
)

// List endpoint
router.get(
  '/',
  canView('bank_statement_imports'),
  validateSchema(listImportsQuerySchema),
  bankStatementImportController.list
)

// Get by ID endpoint
router.get(
  '/:id',
  canView('bank_statement_imports'),
  validateSchema(getImportByIdSchema),
  bankStatementImportController.getById
)

// Get statements endpoint
router.get(
  '/:id/statements',
  canView('bank_statement_imports'),
  validateSchema(getImportStatementsSchema),
  bankStatementImportController.getStatements
)

// Get summary endpoint
router.get(
  '/:id/summary',
  canView('bank_statement_imports'),
  bankStatementImportController.getSummary
)

// Preview endpoint
router.get(
  '/:id/preview',
  canView('bank_statement_imports'),
  bankStatementImportController.preview
)

// Cancel endpoint
router.post(
  '/:id/cancel',
  canInsert('bank_statement_imports'),
  bankStatementImportController.cancel
)

// Retry endpoint
router.post(
  '/:id/retry',
  canInsert('bank_statement_imports'),
  bankStatementImportController.retry
)

// Delete endpoint
router.delete(
  '/:id',
  canDelete('bank_statement_imports'),
  validateSchema(deleteImportSchema),
  bankStatementImportController.delete
)

export default router

