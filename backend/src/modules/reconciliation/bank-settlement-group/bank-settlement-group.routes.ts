import { Router } from "express";
import { settlementGroupController } from "./bank-settlement-group.controller";
import { authenticate } from "../../../middleware/auth.middleware";
import { resolveBranchContext } from "../../../middleware/branch-context.middleware";
import { canView, canInsert } from "../../../middleware/permission.middleware";
import { queryMiddleware } from "../../../middleware/query.middleware";
import {
  createRateLimit,
  updateRateLimit,
} from "../../../middleware/rateLimiter.middleware";
import { PermissionService } from "../../../services/permission.service";
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
  (req, res) =>
    settlementGroupController.create(
      req as AuthenticatedRequest,
      res,
    ),
);

/**
 * @route GET /api/v1/settlement-group/:id
 * @desc Get settlement group by ID
 */
router.get(
  "/:id",
  canView("bank_settlement_group"),
  (req, res) =>
    settlementGroupController.getById(req as any, res),
);

/**
 * @route GET /api/v1/settlement-group/list
 * @desc List all settlement groups
 */
router.get(
  "/list",
  canView("bank_settlement_group"),
  (req, res) =>
    settlementGroupController.getList(req as AuthenticatedQueryRequest, res),
);

/**
 * @route DELETE /api/v1/settlement-group/:id/undo
 * @desc Undo a settlement group
 */
router.delete(
  "/:id/undo",
  canInsert("bank_settlement_group"),
  updateRateLimit,
  (req, res) =>
    settlementGroupController.undo(req as AuthenticatedRequest, res),
);

/**
 * @route GET /api/v1/settlement-group/aggregates/available
 * @desc Get available aggregates for settlement
 */
router.get(
  "/aggregates/available",
  canView("bank_settlement_group"),
  (req, res) =>
    settlementGroupController.getAvailableAggregates(
      req as AuthenticatedQueryRequest,
      res,
    ),
);

/**
 * @route GET /api/v1/settlement-group/:id/aggregates
 * @desc Get aggregates in a settlement group
 */
router.get(
  "/:id/aggregates",
  canView("bank_settlement_group"),
  (req, res) =>
    settlementGroupController.getSettlementAggregates(req as any, res),
);

/**
 * @route GET /api/v1/settlement-group/suggestions
 * @desc Get suggested aggregates for a target amount
 */
router.get(
  "/suggestions",
  canView("bank_settlement_group"),
  (req, res) =>
    settlementGroupController.getSuggestedAggregates(req as AuthenticatedQueryRequest, res),
);

export default router;

