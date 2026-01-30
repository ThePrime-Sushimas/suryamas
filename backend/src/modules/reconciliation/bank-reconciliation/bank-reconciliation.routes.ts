import { Router } from 'express';
import { BankReconciliationController } from './bank-reconciliation.controller';
import { authenticate } from '../../../middleware/auth.middleware';
import { resolveBranchContext } from '../../../middleware/branch-context.middleware';
import { canView, canInsert } from '../../../middleware/permission.middleware';
import { queryMiddleware } from '../../../middleware/query.middleware';
import { createRateLimit, updateRateLimit } from '../../../middleware/rateLimiter.middleware';
import { validateSchema } from '../../../middleware/validation.middleware';
import { PermissionService } from '../../../services/permission.service';
import { 
  manualReconcileSchema, 
  autoMatchSchema, 
  getDiscrepanciesQuerySchema, 
  getSummaryQuerySchema 
} from './bank-reconciliation.schema';
import type { AuthenticatedQueryRequest, AuthenticatedRequest } from '../../../types/request.types';
import { ValidatedAuthRequest } from '../../../middleware/validation.middleware';

// Register module in permission system
PermissionService.registerModule('bank_reconciliation', 'Bank Reconciliation Management').catch(() => {});

export function createBankReconciliationRouter(controller: BankReconciliationController): Router {
  const router = Router();

  // All routes require authentication and branch context
  router.use(authenticate, resolveBranchContext);

  // Query middleware for GET endpoints with pagination, sorting, and filtering
  router.use(queryMiddleware({
    allowedSortFields: ['id', 'created_at', 'updated_at', 'transaction_date', 'amount']
  }));

  /**
   * @route POST /api/v1/reconciliation/bank/manual
   * @desc Manually reconcile a POS aggregate with a bank statement
   */
  router.post(
    '/manual',
    canInsert('bank_reconciliation'),
    createRateLimit,
    validateSchema(manualReconcileSchema),
    (req, res) => controller.reconcile(req as ValidatedAuthRequest<typeof manualReconcileSchema>, res)
  );

  /**
   * @route POST /api/v1/reconciliation/bank/auto-match
   * @desc Run auto-matching algorithm
   */
  router.post(
    '/auto-match',
    canInsert('bank_reconciliation'),
    createRateLimit,
    validateSchema(autoMatchSchema),
    (req, res) => controller.autoMatch(req as ValidatedAuthRequest<typeof autoMatchSchema>, res)
  );

  /**
   * @route GET /api/v1/reconciliation/bank/discrepancies
   * @desc Get items requiring manual review
   */
  router.get(
    '/discrepancies',
    canView('bank_reconciliation'),
    validateSchema(getDiscrepanciesQuerySchema),
    (req, res) => controller.getDiscrepancies(req as AuthenticatedQueryRequest, res)
  );

  /**
   * @route GET /api/v1/reconciliation/bank/summary
   * @desc Get reconciliation summary
   */
  router.get(
    '/summary',
    canView('bank_reconciliation'),
    validateSchema(getSummaryQuerySchema),
    (req, res) => controller.getSummary(req as AuthenticatedQueryRequest, res)
  );

  /**
   * @route POST /api/v1/reconciliation/bank/undo/:statementId
   * @desc Undo a previous reconciliation
   */
  router.post(
    '/undo/:statementId',
    canInsert('bank_reconciliation'),
    updateRateLimit,
    (req, res) => controller.undo(req as AuthenticatedRequest, res)
  );

  return router;
}
