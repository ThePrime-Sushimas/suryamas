import { Router } from "express";
import { bankReconciliationController } from "./bank-reconciliation.controller";
import { authenticate } from "../../../middleware/auth.middleware";
import { resolveBranchContext } from "../../../middleware/branch-context.middleware";
import { canView, canInsert } from "../../../middleware/permission.middleware";
import { queryMiddleware } from "../../../middleware/query.middleware";
import {
  createRateLimit,
  updateRateLimit,
} from "../../../middleware/rateLimiter.middleware";
import { validateSchema } from "../../../middleware/validation.middleware";
import { PermissionService } from "../../../services/permission.service";
import {
  manualReconcileSchema,
  autoMatchSchema,
  getStatementsQuerySchema,
  getSummaryQuerySchema,
  multiMatchSchema,
  multiMatchGroupQuerySchema,
  multiMatchSuggestionsQuerySchema,
} from "./bank-reconciliation.schema";
import type {
  AuthenticatedQueryRequest,
  AuthenticatedRequest,
} from "../../../types/request.types";
import { ValidatedAuthRequest } from "../../../middleware/validation.middleware";

// Register module in permission system
PermissionService.registerModule(
  "bank_reconciliation",
  "Bank Reconciliation Management",
).catch(() => {});

const router = Router();

// All routes require authentication and branch context
router.use(authenticate, resolveBranchContext);

// Query middleware for GET endpoints with pagination, sorting, and filtering
router.use(
  queryMiddleware({
    allowedSortFields: [
      "id",
      "created_at",
      "updated_at",
      "transaction_date",
      "amount",
    ],
  }),
);

/**
 * @route POST /api/v1/reconciliation/bank/manual
 * @desc Manually reconcile a POS aggregate with a bank statement
 */
router.post(
  "/manual",
  canInsert("bank_reconciliation"),
  createRateLimit,
  validateSchema(manualReconcileSchema),
  (req, res) =>
    bankReconciliationController.reconcile(
      req as ValidatedAuthRequest<typeof manualReconcileSchema>,
      res,
    ),
);

/**
 * @route POST /api/v1/reconciliation/bank/auto-match
 * @desc Run auto-matching algorithm
 */
router.post(
  "/auto-match",
  canInsert("bank_reconciliation"),
  createRateLimit,
  validateSchema(autoMatchSchema),
  (req, res) =>
    bankReconciliationController.autoMatch(
      req as ValidatedAuthRequest<typeof autoMatchSchema>,
      res,
    ),
);

/**
 * @route GET /api/v1/reconciliation/bank/statements
 * @desc Get all bank statements with reconciliation info
 */
router.get(
  "/statements",
  canView("bank_reconciliation"),
  validateSchema(getStatementsQuerySchema),
  (req, res) =>
    bankReconciliationController.getStatements(
      req as AuthenticatedQueryRequest,
      res,
    ),
);

/**
 * @route GET /api/v1/reconciliation/bank/bank-accounts
 * @desc Get all bank accounts (no date filter needed)
 */
router.get(
  "/bank-accounts",
  canView("bank_reconciliation"),
  (req, res) =>
    bankReconciliationController.getAllBankAccounts(
      req as AuthenticatedQueryRequest,
      res,
    ),
);

/**
 * @route GET /api/v1/reconciliation/bank/bank-accounts/all
 * @desc Get all bank accounts without date filter - for filter dropdown
 */
router.get(
  "/bank-accounts/all",
  canView("bank_reconciliation"),
  (req, res) =>
    bankReconciliationController.getAllBankAccounts(
      req as AuthenticatedQueryRequest,
      res,
    ),
);

/**
 * @route GET /api/v1/reconciliation/bank/bank-accounts/status
 * @desc Get reconciliation status per bank account
 */
router.get(
  "/bank-accounts/status",
  canView("bank_reconciliation"),
  validateSchema(getSummaryQuerySchema), // Use summary schema as it has the same companyId/date range
  (req, res) =>
    bankReconciliationController.getBankAccountsStatus(
      req as AuthenticatedQueryRequest,
      res,
    ),
);

/**
 * @route GET /api/v1/reconciliation/bank/summary
 * @desc Get reconciliation summary
 */
router.get(
  "/summary",
  canView("bank_reconciliation"),
  validateSchema(getSummaryQuerySchema),
  (req, res) =>
    bankReconciliationController.getSummary(
      req as AuthenticatedQueryRequest,
      res,
    ),
);

/**
 * @route GET /api/v1/reconciliation/bank/statements/:id/potential-matches
 * @desc Get potential matches for a bank statement
 */
router.get(
  "/statements/:id/potential-matches",
  canView("bank_reconciliation"),
  (req, res) =>
    bankReconciliationController.getPotentialMatches(req as any, res),
);

/**
 * @route POST /api/v1/reconciliation/bank/undo/:statementId
 * @desc Undo a previous reconciliation
 */
router.post(
  "/undo/:statementId",
  canInsert("bank_reconciliation"),
  updateRateLimit,
  (req, res) =>
    bankReconciliationController.undo(req as AuthenticatedRequest, res),
);

// =====================================================
// MULTI-MATCH ROUTES
// =====================================================

/**
 * @route POST /api/v1/reconciliation/bank/multi-match
 * @desc Create multi-match (1 POS = N Bank Statements)
 */
router.post(
  "/multi-match",
  canInsert("bank_reconciliation"),
  createRateLimit,
  validateSchema(multiMatchSchema),
  (req, res) =>
    bankReconciliationController.createMultiMatch(
      req as ValidatedAuthRequest<typeof multiMatchSchema>,
      res,
    ),
);

/**
 * @route DELETE /api/v1/reconciliation/bank/multi-match/:groupId
 * @desc Undo multi-match
 */
router.delete(
  "/multi-match/:groupId",
  canInsert("bank_reconciliation"),
  updateRateLimit,
  (req, res) =>
    bankReconciliationController.undoMultiMatch(req as AuthenticatedRequest, res),
);

/**
 * @route GET /api/v1/reconciliation/bank/multi-match/suggestions
 * @desc Get suggested statements for grouping
 */
router.get(
  "/multi-match/suggestions",
  canView("bank_reconciliation"),
  validateSchema(multiMatchSuggestionsQuerySchema),
  (req, res) =>
    bankReconciliationController.getSuggestedGroupStatements(
      req as AuthenticatedQueryRequest,
      res,
    ),
);

/**
 * @route GET /api/v1/reconciliation/bank/multi-match/groups
 * @desc Get all multi-match groups
 */
router.get(
  "/multi-match/groups",
  canView("bank_reconciliation"),
  validateSchema(multiMatchGroupQuerySchema),
  (req, res) =>
    bankReconciliationController.getReconciliationGroups(
      req as AuthenticatedQueryRequest,
      res,
    ),
);

/**
 * @route GET /api/v1/reconciliation/bank/multi-match/:groupId
 * @desc Get details of a multi-match group
 */
router.get(
  "/multi-match/:groupId",
  canView("bank_reconciliation"),
  (req, res) =>
    bankReconciliationController.getMultiMatchGroup(req as any, res),
);

export default router;
