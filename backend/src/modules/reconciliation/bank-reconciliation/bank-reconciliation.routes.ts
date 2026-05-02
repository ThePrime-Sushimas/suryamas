import { Router } from "express";
import { bankReconciliationController } from "./bank-reconciliation.controller";
import { authenticate } from "../../../middleware/auth.middleware";
import { resolveBranchContext } from "../../../middleware/branch-context.middleware";
import { canView, canInsert } from "../../../middleware/permission.middleware";
import { queryMiddleware } from "../../../middleware/query.middleware";
import { createRateLimit, updateRateLimit } from "../../../middleware/rateLimiter.middleware";
import { validateSchema } from "../../../middleware/validation.middleware";
import { PermissionService } from "../../../services/permission.service";
import { requireWriteAccess } from '../../../middleware/write-guard.middleware'
import {
  manualReconcileSchema,
  manualReconcileCashDepositSchema,
  autoMatchSchema,
  autoMatchPreviewSchema,
  autoMatchConfirmSchema,
  getStatementsQuerySchema,
  getSummaryQuerySchema,
  multiMatchSchema,
  multiMatchGroupQuerySchema,
  multiMatchSuggestionsQuerySchema,
} from "./bank-reconciliation.schema";

PermissionService.registerModule("bank_reconciliation", "Bank Reconciliation Management")
  .catch((err) => console.error("Failed to register bank_reconciliation module:", err));

const router = Router();

router.use(authenticate, resolveBranchContext);

router.use(queryMiddleware({
  allowedSortFields: ["id", "created_at", "updated_at", "transaction_date", "amount"],
}));

// POST — mutations
router.post("/manual", requireWriteAccess, canInsert("bank_reconciliation"), createRateLimit,
  validateSchema(manualReconcileSchema),
  (req, res) => bankReconciliationController.reconcile(req, res));

router.post("/manual-cash-deposit", requireWriteAccess, canInsert("bank_reconciliation"), createRateLimit,
  validateSchema(manualReconcileCashDepositSchema),
  (req, res) => bankReconciliationController.reconcileCashDeposit(req, res));

router.post("/auto-match", requireWriteAccess, canInsert("bank_reconciliation"), createRateLimit,
  validateSchema(autoMatchSchema),
  (req, res) => bankReconciliationController.autoMatch(req, res));

router.post("/auto-match/preview", canView("bank_reconciliation"), createRateLimit,
  validateSchema(autoMatchPreviewSchema),
  (req, res) => bankReconciliationController.previewAutoMatch(req, res));

router.post("/auto-match/confirm", requireWriteAccess, canInsert("bank_reconciliation"), createRateLimit,
  validateSchema(autoMatchConfirmSchema),
  (req, res) => bankReconciliationController.confirmAutoMatch(req, res));

router.post("/undo/:statementId", requireWriteAccess, canInsert("bank_reconciliation"), updateRateLimit,
  (req, res) => bankReconciliationController.undo(req, res));

router.post("/multi-match", requireWriteAccess, canInsert("bank_reconciliation"), createRateLimit,
  validateSchema(multiMatchSchema),
  (req, res) => bankReconciliationController.createMultiMatch(req, res));

router.delete("/multi-match/:groupId", requireWriteAccess, canInsert("bank_reconciliation"), updateRateLimit,
  (req, res) => bankReconciliationController.undoMultiMatch(req, res));

// GET — static routes BEFORE dynamic /:id (convention #35)
router.get("/statements", canView("bank_reconciliation"),
  validateSchema(getStatementsQuerySchema),
  (req, res) => bankReconciliationController.getStatements(req, res));

router.get("/statements/unreconciled", canView("bank_reconciliation"),
  (req, res) => bankReconciliationController.getUnreconciledStatements(req, res));

router.get("/statements/find-by-amount", canView("bank_reconciliation"),
  (req, res) => bankReconciliationController.findStatementsByAmount(req, res));

router.get("/statements/:id/potential-matches", canView("bank_reconciliation"),
  (req, res) => bankReconciliationController.getPotentialMatches(req, res));

router.get("/bank-accounts", canView("bank_reconciliation"),
  (req, res) => bankReconciliationController.getAllBankAccounts(req, res));

router.get("/bank-accounts/all", canView("bank_reconciliation"),
  (req, res) => bankReconciliationController.getAllBankAccounts(req, res));

router.get("/bank-accounts/status", canView("bank_reconciliation"),
  validateSchema(getSummaryQuerySchema),
  (req, res) => bankReconciliationController.getBankAccountsStatus(req, res));

router.get("/summary", canView("bank_reconciliation"),
  validateSchema(getSummaryQuerySchema),
  (req, res) => bankReconciliationController.getSummary(req, res));

router.get("/multi-match/suggestions", canView("bank_reconciliation"),
  validateSchema(multiMatchSuggestionsQuerySchema),
  (req, res) => bankReconciliationController.getSuggestedGroupStatements(req, res));

router.get("/multi-match/groups", canView("bank_reconciliation"),
  validateSchema(multiMatchGroupQuerySchema),
  (req, res) => bankReconciliationController.getReconciliationGroups(req, res));

router.get("/multi-match/:groupId", canView("bank_reconciliation"),
  (req, res) => bankReconciliationController.getMultiMatchGroup(req, res));

export default router;
