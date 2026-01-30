import { Router } from 'express';
import { BankReconciliationController } from './bank-reconciliation.controller';
import { 
  manualReconcileSchema, 
  autoMatchSchema, 
  getDiscrepanciesQuerySchema, 
  getSummaryQuerySchema 
} from './bank-reconciliation.schema';
// Assuming a global validation middleware exists
// import { validate } from '../../shared/middleware/validate'; 

export function createBankReconciliationRouter(controller: BankReconciliationController): Router {
  const router = Router();

  /**
   * @route POST /api/v1/reconciliation/bank/manual
   * @desc Manually reconcile a POS aggregate with a bank statement
   */
  router.post(
    '/manual',
    // validate(manualReconcileSchema),
    (req, res) => controller.reconcile(req, res)
  );

  /**
   * @route POST /api/v1/reconciliation/bank/auto-match
   * @desc Run auto-matching algorithm
   */
  router.post(
    '/auto-match',
    // validate(autoMatchSchema),
    (req, res) => controller.autoMatch(req, res)
  );

  /**
   * @route GET /api/v1/reconciliation/bank/discrepancies
   * @desc Get items requiring manual review
   */
  router.get(
    '/discrepancies',
    // validate(getDiscrepanciesQuerySchema),
    (req, res) => controller.getDiscrepancies(req, res)
  );

  /**
   * @route GET /api/v1/reconciliation/bank/summary
   * @desc Get reconciliation summary
   */
  router.get(
    '/summary',
    // validate(getSummaryQuerySchema),
    (req, res) => controller.getSummary(req, res)
  );

  return router;
}
