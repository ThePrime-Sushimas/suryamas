import { Router } from 'express'
import { journalLinesController } from './journal-lines.controller'
import { authenticate } from '../../../../middleware/auth.middleware'
import { resolveBranchContext } from '../../../../middleware/branch-context.middleware'

const router = Router()

// Semua route butuh authentication + branch context
router.use(authenticate)
router.use(resolveBranchContext)

/**
 * GET /api/v1/accounting/journals/:journalId/lines
 * List all lines for a specific journal header
 */
router.get(
  '/journals/:journalId/lines',
  (req, res) => journalLinesController.listByJournal(req as any, res)
)

/**
 * GET /api/v1/accounting/journals/:journalId/lines/:id
 * Get single journal line detail
 */
router.get(
  '/journals/:journalId/lines/:id',
  (req, res) => journalLinesController.getById(req as any, res)
)

/**
 * GET /api/v1/accounting/journal-lines/by-account/:accountId
 * Get lines by account (for reporting / GL)
 */
router.get(
  '/by-account/:accountId',
  (req, res) => journalLinesController.getByAccount(req as any, res)
)

/**
 * GET /api/v1/accounting/journal-lines
 * List all journal lines (with pagination, filter, sort)
 */
router.get(
  '/',
  (req, res) => journalLinesController.list(req as any, res)
)

export default router
