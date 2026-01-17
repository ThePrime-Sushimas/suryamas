/**
 * POS Imports Routes
 * Following journal-headers.routes.ts pattern
 */

import { Router } from 'express'
import { posImportsController } from './pos-imports.controller'
import { authenticate } from '../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../middleware/branch-context.middleware'
import { canView, canInsert, canUpdate, canDelete } from '../../../middleware/permission.middleware'
import { queryMiddleware } from '../../../middleware/query.middleware'
import { validateSchema, ValidatedAuthRequest } from '../../../middleware/validation.middleware'
import { upload } from '../../../middleware/upload.middleware'
import { createRateLimit } from '../../../middleware/rateLimiter.middleware'
import { PermissionService } from '../../../services/permission.service'
import { 
  posImportIdSchema,
  uploadPosFileSchema,
  confirmImportSchema,
  updateStatusSchema,
  listPosImportsSchema
} from './pos-imports.schema'
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../types/request.types'

// Register module permissions
PermissionService.registerModule('pos_imports', 'POS Imports Management').catch((error) => {
  console.error('Failed to register pos_imports module:', error.message)
})

const router = Router()

// Apply authentication and branch context to all routes
router.use(authenticate, resolveBranchContext)

// List POS imports
router.get('/', canView('pos_imports'), queryMiddleware({
  allowedSortFields: ['import_date', 'file_name', 'status', 'total_rows', 'created_at', 'date_range_start', 'date_range_end'],
}), validateSchema(listPosImportsSchema), (req, res) => 
  posImportsController.list(req as AuthenticatedQueryRequest, res))

// Upload and analyze Excel file
router.post('/upload', 
  canInsert('pos_imports'), 
  createRateLimit,
  upload.single('file'),
  validateSchema(uploadPosFileSchema), 
  (req, res) => 
    posImportsController.upload(req as ValidatedAuthRequest<typeof uploadPosFileSchema>, res))

// Get import by ID
router.get('/:id', canView('pos_imports'), validateSchema(posImportIdSchema), (req, res) => 
  posImportsController.getById(req as AuthenticatedRequest, res))

// Get import lines with pagination
router.get('/:id/lines', canView('pos_imports'), queryMiddleware({
  allowedSortFields: ['row_number'],
}), validateSchema(posImportIdSchema), (req, res) => 
  posImportsController.getLines(req as AuthenticatedQueryRequest, res))

// Export import to Excel
router.get('/:id/export', canView('pos_imports'), validateSchema(posImportIdSchema), (req, res) => 
  posImportsController.export(req as AuthenticatedRequest, res))

// Get financial summary
router.get('/:id/summary', canView('pos_imports'), validateSchema(posImportIdSchema), (req, res) => 
  posImportsController.getSummary(req as AuthenticatedRequest, res))

// Confirm import (after duplicate analysis)
router.post('/:id/confirm', 
  canInsert('pos_imports'), 
  validateSchema(confirmImportSchema), 
  (req, res) => 
    posImportsController.confirm(req as ValidatedAuthRequest<typeof confirmImportSchema>, res))

// Update status
router.put('/:id/status', 
  canUpdate('pos_imports'), 
  validateSchema(updateStatusSchema), 
  (req, res) => 
    posImportsController.updateStatus(req as ValidatedAuthRequest<typeof updateStatusSchema>, res))

// Delete import
router.delete('/:id', canDelete('pos_imports'), validateSchema(posImportIdSchema), (req, res) => 
  posImportsController.delete(req as AuthenticatedRequest, res))

// Restore deleted import
router.post('/:id/restore', canInsert('pos_imports'), validateSchema(posImportIdSchema), (req, res) => 
  posImportsController.restore(req as AuthenticatedRequest, res))

export default router
