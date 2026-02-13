import { Router } from "express";
import { settlementGroupController } from "./bank-settlement-group.controller";
import { authenticate } from "../../../middleware/auth.middleware";
import { resolveBranchContext } from "../../../middleware/branch-context.middleware";
import { canView, canInsert, canUpdate } from "../../../middleware/permission.middleware";
import { queryMiddleware } from "../../../middleware/query.middleware";
import { validateSchema, ValidatedAuthRequest } from "../../../middleware/validation.middleware";
import {
  createRateLimit,
  updateRateLimit,
} from "../../../middleware/rateLimiter.middleware";
import { PermissionService } from "../../../services/permission.service";
import {
  createSettlementGroupSchema,
  getSettlementGroupListSchema,
  getSettlementGroupByIdSchema,
  undoSettlementGroupSchema,
  getSettlementGroupAggregatesSchema,
  getAvailableAggregatesSchema,
  getSuggestionsSchema,
} from "./bank-settlement-group.schema";
import type {
  AuthenticatedQueryRequest,
  AuthenticatedRequest,
} from "../../../types/request.types";

// Register module in permission system
PermissionService.registerModule(
  "bank_settlement_group",
  "Bank Settlement Group Management",
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
      "settlement_date",
      "total_statement_amount",
      "status",
    ],
  }),
);

/**
 * @route POST /api/v1/settlement-group/create
 * @desc Create settlement group (BULK SETTLEMENT - 1 Bank Statement → Many Aggregates)
 */
router.post(
  "/create",
  canInsert("bank_settlement_group"),
  createRateLimit,
  validateSchema(createSettlementGroupSchema),
  (req, res) =>
    settlementGroupController.create(req as ValidatedAuthRequest<typeof createSettlementGroupSchema>, res),
);

/**
 * @route GET /api/v1/settlement-group/list
 * @desc List all settlement groups
 * NOTE: This route must be defined BEFORE /:id to avoid route conflict
 */
router.get(
  "/list",
  canView("bank_settlement_group"),
  validateSchema(getSettlementGroupListSchema),
  (req, res) =>
    settlementGroupController.getList(req as ValidatedAuthRequest<typeof getSettlementGroupListSchema>, res),
);

/**
 * @route GET /api/v1/settlement-group/:id
 * @desc Get settlement group by ID
 */
router.get(
  "/:id",
  canView("bank_settlement_group"),
  validateSchema(getSettlementGroupByIdSchema),
  (req, res) =>
    settlementGroupController.getById(req as ValidatedAuthRequest<typeof getSettlementGroupByIdSchema>, res),
);

/**
 * @route DELETE /api/v1/settlement-group/:id
 * @desc Hard delete a settlement group (permanently removes and reverts reconciliation)
 */
router.delete(
  "/:id",
  canInsert("bank_settlement_group"),
  updateRateLimit,
  validateSchema(undoSettlementGroupSchema),
  (req, res) =>
    settlementGroupController.delete(req as ValidatedAuthRequest<typeof undoSettlementGroupSchema>, res),
);

/**
 * @route GET /api/v1/settlement-group/aggregates/available
 * @desc Get available aggregates for settlement
 */
router.get(
  "/aggregates/available",
  canView("bank_settlement_group"),
  validateSchema(getAvailableAggregatesSchema),
  (req, res) =>
    settlementGroupController.getAvailableAggregates(req as ValidatedAuthRequest<typeof getAvailableAggregatesSchema>, res),
);

/**
 * @route GET /api/v1/settlement-group/:id/aggregates
 * @desc Get aggregates in a settlement group
 */
router.get(
  "/:id/aggregates",
  canView("bank_settlement_group"),
  validateSchema(getSettlementGroupAggregatesSchema),
  (req, res) =>
    settlementGroupController.getSettlementAggregates(req as ValidatedAuthRequest<typeof getSettlementGroupAggregatesSchema>, res),
);

/**
 * @route GET /api/v1/settlement-group/suggestions
 * @desc Get suggested aggregates for a target amount
 */
router.get(
  "/suggestions",
  canView("bank_settlement_group"),
  validateSchema(getSuggestionsSchema),
  (req, res) =>
    settlementGroupController.getSuggestedAggregates(req as ValidatedAuthRequest<typeof getSuggestionsSchema>, res),
);

export default router;

