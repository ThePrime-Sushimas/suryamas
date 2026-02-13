/**
 * Settlement Group Controller
 * API endpoints for bulk settlement reconciliation
 */

import { Response } from "express";
import {
  settlementGroupService,
  SettlementGroupService,
} from "./bank-settlement-group.service";
import type { AuthenticatedRequest, AuthenticatedQueryRequest } from "../../../types/request.types";
import { ValidatedAuthRequest } from "../../../middleware/validation.middleware";
import {
  createSettlementGroupSchema,
  getSettlementGroupByIdSchema,
  getSettlementGroupListSchema,
  undoSettlementGroupSchema,
  getSettlementGroupAggregatesSchema,
  getAvailableAggregatesSchema,
  getSuggestionsSchema,
  getDeletedSettlementGroupsSchema,
  restoreSettlementGroupSchema,
  CreateSettlementGroupInput,
  GetSettlementGroupListInput,
  UndoSettlementGroupInput,
  GetSettlementGroupByIdInput,
  GetSettlementGroupAggregatesInput,
  GetAvailableAggregatesInput,
  GetSuggestionsInput,
  GetDeletedSettlementGroupsInput,
  RestoreSettlementGroupInput,
} from "./bank-settlement-group.schema";
import {
  SettlementGroupNotFoundError,
  DuplicateAggregateError,
  AggregateAlreadyReconciledError,
  StatementAlreadyReconciledError,
  DifferenceThresholdExceededError,
  SettlementAlreadyConfirmedError,
} from "./bank-settlement-group.errors";
import { logError, logInfo } from "../../../config/logger";

/**
 * Settlement Group Controller
 * API endpoints for bulk settlement reconciliation
 */
export class SettlementGroupController {
  constructor(private readonly service: SettlementGroupService) {}

  /**
   * Create a new settlement group (BULK SETTLEMENT)
   * POST /api/v1/settlement-group/create
   *
   * @param req Validated request with settlement group data
   * @param res Express response object
   * @returns Promise<void>
   */
  async create(
    req: ValidatedAuthRequest<typeof createSettlementGroupSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const { bankStatementId, aggregateIds, notes, overrideDifference } = req.validated.body;
      const userId = req.user?.id as string | undefined;
      const companyId = (req as any).context?.company_id as string | undefined;

      const result = await this.service.createSettlementGroup({
        companyId: companyId || '',
        bankStatementId,
        aggregateIds,
        notes,
        overrideDifference,
        userId,
      });

      logInfo("Settlement group created", { groupId: result.groupId });

      res.status(201).json({
        success: true,
        data: result,
        message: "Settlement group berhasil dibuat",
      });
    } catch (error: any) {
      logError("Create settlement group error", {
        error: error.message,
        code: error.code,
      });

      let status = 400;
      if (error instanceof SettlementGroupNotFoundError) status = 404;
      if (error instanceof StatementAlreadyReconciledError) status = 409;
      if (error instanceof AggregateAlreadyReconciledError) status = 409;
      if (error instanceof DuplicateAggregateError) status = 409;
      if (error instanceof DifferenceThresholdExceededError) status = 422;

      // Add correlation ID to logs for better tracing
      const correlationId = req.headers['x-correlation-id'] || 'unknown';
      logError("Create settlement group error", {
        correlationId,
        error: error.message,
        code: error.code,
        userId: req.user?.id,
        companyId: req.context?.company_id,
      });

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "CREATE_SETTLEMENT_GROUP_FAILED",
      });
    }
  }

  /**
   * Get settlement group by ID
   * GET /api/v1/settlement-group/:id
   *
   * @param req Validated request with settlement group ID
   * @param res Express response object
   * @returns Promise<void>
   */
  async getById(req: ValidatedAuthRequest<typeof getSettlementGroupByIdSchema>, res: Response): Promise<void> {
    try {
      const { id } = req.validated.params;

      const result = await this.service.getSettlementGroup(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      const correlationId = req.headers['x-correlation-id'] || 'unknown';
      logError("Get settlement group error", {
        correlationId,
        id: req.validated.params.id,
        error: error.message,
        code: error.code,
        userId: req.user?.id,
        companyId: req.context?.company_id,
      });

      let status = 400;
      if (error instanceof SettlementGroupNotFoundError) status = 404;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_SETTLEMENT_GROUP_FAILED",
      });
    }
  }

  /**
   * List settlement groups with filters
   * GET /api/v1/settlement-group/list
   *
   * @param req Validated request with query parameters
   * @param res Express response object
   * @returns Promise<void>
   */
  async getList(
    req: ValidatedAuthRequest<typeof getSettlementGroupListSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const { startDate, endDate, status, search, limit, offset } = req.validated.query;

      const result = await this.service.listSettlementGroups({
        startDate,
        endDate,
        status: status as any,
        search,
        limit,
        offset,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (error: any) {
      logError("List settlement groups error", {
        query: req.validated.query,
        error: error.message,
        code: error.code,
      });

      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "LIST_SETTLEMENT_GROUPS_FAILED",
      });
    }
  }

  /**
   * Delete a settlement group (HARD DELETE)
   * DELETE /api/v1/settlement-group/:id/delete
   *
   * @param req Validated request with settlement group ID
   * @param res Express response object
   * @returns Promise<void>
   */
  async delete(
    req: ValidatedAuthRequest<typeof undoSettlementGroupSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.validated.params;

      await this.service.deleteSettlementGroup(id);

      logInfo("Settlement group deleted", { groupId: id });

      res.status(200).json({
        success: true,
        message: "Settlement group berhasil dihapus",
      });
    } catch (error: any) {
      const correlationId = req.headers['x-correlation-id'] || 'unknown';
      logError("Delete settlement group error", {
        correlationId,
        id: req.validated.params.id,
        error: error.message,
        code: error.code,
      });

      let status = 400;
      if (error instanceof SettlementGroupNotFoundError) status = 404;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "DELETE_SETTLEMENT_GROUP_FAILED",
      });
    }
  }

  /**
   * Get available aggregates for settlement
   * GET /api/v1/settlement-group/aggregates/available
   *
   * @param req Validated request with query parameters
   * @param res Express response object
   * @returns Promise<void>
   */
  async getAvailableAggregates(
    req: ValidatedAuthRequest<typeof getAvailableAggregatesSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const { startDate, endDate, bankAccountId, search, limit, offset } = req.validated.query;

      const result = await this.service.getAvailableAggregates({
        startDate,
        endDate,
        bankAccountId,
        search,
        limit,
        offset,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: Math.floor((offset || 0) / (limit || 100)) + 1,
          pageSize: limit || 100,
          totalPages: Math.ceil(result.total / (limit || 100))
        }
      });
    } catch (error: any) {
      logError("Get available aggregates error", {
        query: req.validated.query,
        error: error.message,
        code: error.code,
      });

      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_AVAILABLE_AGGREGATES_FAILED",
      });
    }
  }

  /**
   * Get aggregates for a specific settlement group
   * GET /api/v1/settlement-group/:id/aggregates
   *
   * @param req Validated request with settlement group ID
   * @param res Express response object
   * @returns Promise<void>
   */
  async getSettlementAggregates(req: ValidatedAuthRequest<typeof getSettlementGroupAggregatesSchema>, res: Response): Promise<void> {
    try {
      const { id } = req.validated.params;

      const result = await this.service.getSettlementAggregates(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get settlement aggregates error", {
        id: req.validated.params.id,
        error: error.message,
        code: error.code,
      });

      let status = 400;
      if (error instanceof SettlementGroupNotFoundError) status = 404;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_SETTLEMENT_AGGREGATES_FAILED",
      });
    }
  }

  /**
   * Get suggested aggregates for a target amount
   * GET /api/v1/settlement-group/suggestions
   */
  async getSuggestedAggregates(
    req: ValidatedAuthRequest<typeof getSuggestionsSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const { targetAmount, tolerancePercent, dateToleranceDays, maxResults } = req.validated.query;

      const result = await this.service.getSuggestedAggregates(targetAmount, {
        tolerancePercent,
        maxAggregates: maxResults,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get suggested aggregates error", {
        query: req.validated.query,
        error: error.message,
        code: error.code,
      });

      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_SUGGESTIONS_FAILED",
      });
    }
  }
}

export const settlementGroupController = new SettlementGroupController(
  settlementGroupService
);

