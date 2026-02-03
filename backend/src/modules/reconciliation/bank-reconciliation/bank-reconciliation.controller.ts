import { Request, Response } from "express";
import {
  bankReconciliationService,
  BankReconciliationService,
} from "./bank-reconciliation.service";
import type {
  AuthenticatedRequest,
  AuthenticatedQueryRequest,
} from "../../../types/request.types";
import type { ValidatedAuthRequest } from "../../../middleware/validation.middleware";
import {
  manualReconcileSchema,
  autoMatchSchema,
  multiMatchSchema,
  multiMatchGroupQuerySchema,
  multiMatchSuggestionsQuerySchema,
} from "./bank-reconciliation.schema";
import {
  AlreadyReconciledError,
  DifferenceThresholdExceededError,
  NoMatchFoundError,
  FetchStatementError,
  StatementNotFoundError,
  DatabaseConnectionError,
  ReconciliationError,
} from "./bank-reconciliation.errors";
import { logError } from "../../../config/logger";
import { getPaginationParams } from "../../../utils/pagination.util";

export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  /**
   * Reconcile a single POS aggregate with bank statement
   */
  async reconcile(
    req: ValidatedAuthRequest<typeof manualReconcileSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const validated = req.validated.body;
      const userId = req.user?.id;

      const result = await this.service.reconcile(
        validated.aggregateId,
        validated.statementId,
        userId,
        validated.notes,
        validated.overrideDifference,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      let status = 400;
      if (error instanceof AlreadyReconciledError) status = 409;
      if (error instanceof DifferenceThresholdExceededError) status = 422;
      
      // Handle fetch/statement errors
      if (error instanceof FetchStatementError || 
          error instanceof StatementNotFoundError ||
          error instanceof DatabaseConnectionError) {
        status = 503; // Service unavailable for database issues
      }

      logError("Reconciliation error", { 
        endpoint: '/reconcile', 
        error: error.message,
        code: error.code 
      });

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "RECONCILIATION_FAILED",
      });
    }
  }

  /**
   * Undo reconciliation
   */
  async undo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { statementId } = req.params;
      const userId = req.user?.id;

      await this.service.undo(statementId as string, userId);

      res.status(200).json({
        success: true,
        message: "Reconciliation undone successfully",
      });
    } catch (error: any) {
      logError("Undo reconciliation error", { 
        statementId: req.params?.statementId,
        error: error.message 
      });
      
      let status = 400;
      if (error instanceof StatementNotFoundError) status = 404;
      if (error instanceof DatabaseConnectionError) status = 503;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "UNDO_FAILED",
      });
    }
  }

  /**
   * Run auto-matching for all unreconciled items
   */
  async autoMatch(
    req: ValidatedAuthRequest<typeof autoMatchSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const validated = req.validated.body;
      const userId = req.user?.id;

      const result = await this.service.autoMatch(
        validated.companyId,
        new Date(validated.startDate),
        new Date(validated.endDate),
        validated.bankAccountId,
        userId,
        validated.matchingCriteria,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Auto-match error", { 
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof DatabaseConnectionError) status = 503;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "AUTO_MATCH_FAILED",
      });
    }
  }

  /**
   * Get all bank statements with reconciliation info
   */
  async getStatements(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const validated = (req as any).validated?.query || req.query;
      const { companyId, startDate, endDate, bankAccountId } = validated;

      // Get pagination params from middleware or query
      const pagination = (req as any).pagination || getPaginationParams(req.query);
      const { limit, offset } = pagination;

      const result = await this.service.getStatements(
        companyId,
        new Date(startDate),
        new Date(endDate),
        bankAccountId ? parseInt(bankAccountId) : undefined,
        limit,
        offset,
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      logError("Get statements error", { 
        query: req.query,
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof FetchStatementError || error instanceof DatabaseConnectionError) {
        status = 503;
      }

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_STATEMENTS_FAILED",
      });
    }
  }

  /**
   * Get reconciliation status per bank account
   */
  async getBankAccountsStatus(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const validated = (req as any).validated?.query || req.query;
      const { companyId, startDate, endDate } = validated;

      const result = await this.service.getBankAccountsStatus(
        new Date(startDate),
        new Date(endDate),
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get bank accounts status error", { 
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof DatabaseConnectionError) status = 503;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_ACCOUNTS_FAILED",
      });
    }
  }

  /**
   * Get reconciliation summary
   */
  async getSummary(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const validated = (req as any).validated?.query || req.query;
      const { companyId, startDate, endDate } = validated;

      const result = await this.service.getSummary(
        companyId,
        new Date(startDate),
        new Date(endDate),
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get reconciliation summary error", { 
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof DatabaseConnectionError || error instanceof FetchStatementError) {
        status = 503;
      }

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_SUMMARY_FAILED",
      });
    }
  }

  /**
   * Get potential matches for a specific bank statement
   */
  async getPotentialMatches(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { companyId } = req.query;

      if (!companyId) {
        throw new ReconciliationError("Company ID is required", "MISSING_COMPANY_ID");
      }

      const result = await this.service.getPotentialMatches(
        companyId as string,
        id as string,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get potential matches error", { 
        statementId: req.params?.id,
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof StatementNotFoundError) status = 404;
      if (error instanceof FetchStatementError || error instanceof DatabaseConnectionError) {
        status = 503;
      }

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_MATCHES_FAILED",
      });
    }
  }

  // =====================================================
  // MULTI-MATCH CONTROLLER METHODS
  // =====================================================

  /**
   * Create multi-match (1 POS = N Bank Statements)
   */
  async createMultiMatch(
    req: ValidatedAuthRequest<typeof multiMatchSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const validated = req.validated.body;
      const userId = req.user?.id;

      const result = await this.service.createMultiMatch(
        validated.companyId,
        validated.aggregateId,
        validated.statementIds,
        userId,
        validated.notes,
        validated.overrideDifference,
      );

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Create multi-match error", { 
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof DatabaseConnectionError) status = 503;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "MULTI_MATCH_FAILED",
      });
    }
  }

  /**
   * Undo multi-match
   */
  async undoMultiMatch(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const userId = req.user?.id;

      await this.service.undoMultiMatch(groupId as string, userId);

      res.status(200).json({
        success: true,
        message: "Multi-match berhasil dibatalkan",
      });
    } catch (error: any) {
      logError("Undo multi-match error", { 
        groupId: req.params?.groupId,
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof DatabaseConnectionError) status = 503;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "UNDO_MULTI_MATCH_FAILED",
      });
    }
  }

  /**
   * Get suggested statements for grouping
   */
  async getSuggestedGroupStatements(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { companyId, aggregateId, tolerancePercent, dateToleranceDays, maxStatements } = req.query;

      if (!companyId || !aggregateId) {
        throw new ReconciliationError("Company ID dan Aggregate ID wajib diisi", "MISSING_PARAMS");
      }

      const result = await this.service.getSuggestedGroupStatements(
        companyId as string,
        aggregateId as string,
        tolerancePercent ? parseFloat(tolerancePercent as string) : undefined,
        dateToleranceDays ? parseInt(dateToleranceDays as string) : undefined,
        maxStatements ? parseInt(maxStatements as string) : undefined,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get suggested group statements error", { 
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof FetchStatementError || error instanceof DatabaseConnectionError) {
        status = 503;
      }

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_SUGGESTIONS_FAILED",
      });
    }
  }

  /**
   * Get all multi-match groups
   */
  async getReconciliationGroups(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { companyId, startDate, endDate } = req.query;

      const result = await this.service.getReconciliationGroups(
        companyId as string,
        new Date(startDate as string),
        new Date(endDate as string),
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get reconciliation groups error", { 
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof DatabaseConnectionError) status = 503;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_GROUPS_FAILED",
      });
    }
  }

  /**
   * Get details of a multi-match group
   */
  async getMultiMatchGroup(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const { companyId } = req.query;

      if (!companyId) {
        throw new ReconciliationError("Company ID wajib diisi", "MISSING_COMPANY_ID");
      }

      const result = await this.service.getMultiMatchGroup(groupId as string);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get multi-match group error", { 
        groupId: req.params?.groupId,
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof DatabaseConnectionError) status = 503;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_GROUP_FAILED",
      });
    }
  }
}

export const bankReconciliationController = new BankReconciliationController(
  bankReconciliationService
);
