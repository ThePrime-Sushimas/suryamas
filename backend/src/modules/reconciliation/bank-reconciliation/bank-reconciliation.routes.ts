import { Router } from 'express';
import { BankReconciliationController } from './bank-reconciliation.controller';
import { authenticate } from '../../../middleware/auth.middleware';
import { resolveBranchContext } from '../../../middleware/branch-context.middleware';
import { canView, canInsert } from '../../../middleware/permission.middleware';
import { createRateLimit, updateRateLimit } from '../../../middleware/rateLimiter.middleware';
import { validateSchema } from '../../../middleware/validation.middleware';
import { PermissionService } from '../../../services/permission.service';
import { 
  manualReconcileSchema, 
  autoMatchSchema, 
  getDiscrepanciesQuerySchema, 
  getSummaryQuerySchema 
} from './bank-reconciliation.schema';

// Register module in permission system
PermissionService.registerModule('bank_reconciliation', 'Bank Reconciliation Management').catch(() => {});

export function createBankReconciliationRouter(controller: BankReconciliationController): Router {
  const router = Router();

  // All routes require authentication and branch context
  router.use(authenticate, resolveBranchContext);

  /**
   * @route POST /api/v1/reconciliation/bank/manual
   * @desc Manually reconcile a POS aggregate with a bank statement
   */
  router.post(
    '/manual',
    canInsert('bank_reconciliation'),
    createRateLimit,
    validateSchema(manualReconcileSchema),
    (req, res) => controller.reconcile(req, res)
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
    (req, res) => controller.autoMatch(req, res)
  );

  /**
   * @route GET /api/v1/reconciliation/bank/discrepancies
   * @desc Get items requiring manual review
   */
  router.get(
    '/discrepancies',
    canView('bank_reconciliation'),
    validateSchema(getDiscrepanciesQuerySchema),
    (req, res) => controller.getDiscrepancies(req, res)
  );

  /**
   * @route POST /api/v1/reconciliation/bank/undo/:statementId
   * @desc Undo a previous reconciliation
   */
  router.post(
    '/undo/:statementId',
    canInsert('bank_reconciliation'),
    updateRateLimit,
    (req, res) => controller.undo(req, res)
  );

  return router;
}
