/**
 * Settlement Group Controller
 * API endpoints for bulk settlement reconciliation
 */

import { Request, Response } from "express";
import {
  settlementGroupService,
  SettlementGroupService,
} from "./bank-settlement-group.service";
import type { AuthenticatedRequest, AuthenticatedQueryRequest } from "../../../types/request.types";
import {
  SettlementGroupNotFoundError,
  DuplicateAggregateError,
  AggregateAlreadyReconciledError,
  StatementAlreadyReconciledError,
  DifferenceThresholdExceededError,
  SettlementAlreadyConfirmedError,
} from "./bank-settlement-group.errors";
import { logError, logInfo } from "../../../config/logger";

export class SettlementGroupController {
  constructor(private readonly service: SettlementGroupService) {}

/**
 * Create a new settlement group (BULK SETTLEMENT)
 * POST /api/v1/settlement-group/create
 */
  async create(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const body = req.body as {
        bankStatementId: string;
        aggregateIds: string[];
        notes?: string;
        overrideDifference?: boolean;
      };
      const userId = req.user?.id as string | undefined;
      const companyId = (req as any).context?.company_id as string | undefined;

      const { bankStatementId, aggregateIds, notes, overrideDifference } = body;

      if (!bankStatementId || !aggregateIds || !Array.isArray(aggregateIds)) {
        res.status(400).json({
          success: false,
          message: "bankStatementId dan aggregateIds wajib diisi",
          code: "VALIDATION_ERROR",
        });
        return;
      }

      if (aggregateIds.length === 0) {
        res.status(400).json({
          success: false,
          message: "Minimal harus ada 1 aggregate",
          code: "VALIDATION_ERROR",
        });
        return;
      }

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
      if (error instanceof StatementAlreadyReconciledError) status = 409;
      if (error instanceof AggregateAlreadyReconciledError) status = 409;
      if (error instanceof DuplicateAggregateError) status = 409;
      if (error instanceof DifferenceThresholdExceededError) status = 422;
      if (error instanceof SettlementGroupNotFoundError) status = 404;

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
 */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const result = await this.service.getSettlementGroup(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get settlement group error", {
        id: req.params?.id,
        error: error.message,
        code: error.code,
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
   */
  async getList(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const query = req.query;
      const startDate = query.startDate as string | undefined;
      const endDate = query.endDate as string | undefined;
      const status = query.status as string | undefined;
      const search = query.search as string | undefined;
      const limit = query.limit ? parseInt(query.limit as string) : 50;
      const offset = query.offset ? parseInt(query.offset as string) : 0;

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
        query: req.query,
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
 * Undo/rollback a settlement group
 * DELETE /api/v1/settlement-group/:id/undo
 */
  async undo(
    req: AuthenticatedRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const userId = req.user?.id as string | null | undefined;
      const companyId = (req as any).context?.company_id as string | null | undefined;

      await this.service.undoSettlementGroup(
        id, 
        userId ?? undefined, 
        companyId ?? undefined
      );

      logInfo("Settlement group undone", { groupId: id });

      res.status(200).json({
        success: true,
        message: "Settlement group berhasil dibatalkan",
      });
    } catch (error: any) {
      logError("Undo settlement group error", {
        id: req.params?.id,
        error: error.message,
        code: error.code,
      });

      let status = 400;
      if (error instanceof SettlementGroupNotFoundError) status = 404;
      if (error instanceof SettlementAlreadyConfirmedError) status = 409;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "UNDO_SETTLEMENT_GROUP_FAILED",
      });
    }
  }

  /**
   * Get available aggregates for settlement
   * GET /api/v1/settlement-group/aggregates/available
   */
  async getAvailableAggregates(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const query = req.query;
      const startDate = query.startDate as string | undefined;
      const endDate = query.endDate as string | undefined;
      const paymentMethodId = query.paymentMethodId as string | undefined;
      const limit = query.limit ? parseInt(query.limit as string) : 100;
      const offset = query.offset ? parseInt(query.offset as string) : 0;

      const result = await this.service.getAvailableAggregates({
        startDate,
        endDate,
        paymentMethodId,
        limit,
        offset,
      });

      res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (error: any) {
      logError("Get available aggregates error", {
        query: req.query,
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
   */
  async getSettlementAggregates(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      const result = await this.service.getSettlementAggregates(id);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get settlement aggregates error", {
        id: req.params?.id,
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
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const query = req.query;
      const targetAmount = query.targetAmount as string | undefined;
      const startDate = query.startDate as string | undefined;
      const endDate = query.endDate as string | undefined;
      const tolerancePercent = query.tolerancePercent as string | undefined;
      const maxAggregates = query.maxAggregates as string | undefined;

      if (!targetAmount) {
        res.status(400).json({
          success: false,
          message: "targetAmount parameter is required",
          code: "MISSING_PARAMS",
        });
        return;
      }

      const amountNum = parseFloat(targetAmount);
      if (isNaN(amountNum) || amountNum <= 0) {
        res.status(400).json({
          success: false,
          message: "targetAmount must be a valid positive number",
          code: "INVALID_PARAMS",
        });
        return;
      }

      const result = await this.service.getSuggestedAggregates(amountNum, {
        startDate,
        endDate,
        tolerancePercent: tolerancePercent ? parseFloat(tolerancePercent) : undefined,
        maxAggregates: maxAggregates ? parseInt(maxAggregates) : undefined,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get suggested aggregates error", {
        query: req.query,
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

