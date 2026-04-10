import { Router } from 'express'
import { journalLinesController } from './journal-lines.controller'
import { authenticate } from '../../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../../middleware/branch-context.middleware'
import { canView } from '../../../../middleware/permission.middleware'

import { PermissionService } from '../../../../services/permission.service'

const router = Router()

// Register module permissions
PermissionService.registerModule('journals', 'Journal Entries Management').catch((error) => {
  console.error('Failed to register journals module:', error.message)
})


// Semua route butuh authentication + branch context
router.use(authenticate, resolveBranchContext)

/**
 * GET /api/v1/accounting/journals/:journalId/lines
 * List all lines for a specific journal header
 */
router.get(
  '/journals/:journalId/lines',
  canView('journals'),
  (req, res) => journalLinesController.listByJournal(req as any, res)
)

/**
 * GET /api/v1/accounting/journals/:journalId/lines/:id
 * Get single journal line detail
 */
router.get(
  '/journals/:journalId/lines/:id',
  canView('journals'),
  (req, res) => journalLinesController.getById(req as any, res)
)

/**
 * GET /api/v1/accounting/journal-lines/by-account/:accountId
 * Get lines by account (for reporting / GL)
 */
router.get(
  '/by-account/:accountId',
  canView('journals'),
  (req, res) => journalLinesController.getByAccount(req as any, res)
)

/**
 * GET /api/v1/accounting/journal-lines
 * List all journal lines (with pagination, filter, sort)
 */
router.get(
  '/',
  canView('journals'),
  (req, res) => journalLinesController.list(req as any, res)
)

export default router

