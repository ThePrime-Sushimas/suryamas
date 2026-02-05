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

export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

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
      
      if (error instanceof FetchStatementError || 
          error instanceof StatementNotFoundError ||
          error instanceof DatabaseConnectionError) {
        status = 503;
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

  async autoMatch(
    req: ValidatedAuthRequest<typeof autoMatchSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const validated = req.validated.body;
      const userId = req.user?.id;

      const result = await this.service.autoMatch(
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

  async getStatements(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const validated = (req as any).validated?.query || req.query;
      const { startDate, endDate, bankAccountId, status, search, isReconciled, limit: queryLimit } = validated;

      // Get sort params from query middleware
      const sortField = req.sort?.field || 'transaction_date';
      const sortOrder = req.sort?.order || 'desc';
      
      // Calculate offset from pagination - use a large limit if no pagination
      const page = req.pagination?.page || 1;
      const limit = req.pagination?.limit || 10000; // Large limit to get all data
      const offset = (page - 1) * limit;

      const result = await this.service.getStatements(
        startDate ? new Date(startDate) : undefined,
        endDate ? new Date(endDate) : undefined,
        bankAccountId ? parseInt(bankAccountId) : undefined,
        {
          status,
          search,
          isReconciled: isReconciled === 'true' ? true : isReconciled === 'false' ? false : undefined,
          sortField,
          sortOrder,
          limit,
          offset,
        },
      );

      res.status(200).json({
        success: true,
        data: result,
        pagination: {
          page,
          limit,
          total: result.length, // For now, return length as total
        },
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

  async getBankAccountsStatus(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const validated = (req as any).validated?.query || req.query;
      const { startDate, endDate } = validated;

      // Dates are optional - if not provided, return empty
      if (!startDate || !endDate) {
        res.status(200).json({
          success: true,
          data: [],
        });
        return;
      }

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

  async getAllBankAccounts(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const result = await this.service.getAllBankAccounts();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logError("Get all bank accounts error", { 
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

  async getSummary(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const validated = (req as any).validated?.query || req.query;
      const { startDate, endDate } = validated;

      // Dates are optional - if not provided, return empty summary
      if (!startDate || !endDate) {
        res.status(200).json({
          success: true,
          data: {
            period: { startDate: '', endDate: '' },
            totalAggregates: 0,
            totalStatements: 0,
            autoMatched: 0,
            manuallyMatched: 0,
            discrepancies: 0,
            unreconciled: 0,
            totalDifference: 0,
            percentageReconciled: 0,
          },
        });
        return;
      }

      const result = await this.service.getSummary(
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

  async getPotentialMatches(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const result = await this.service.getPotentialMatches(
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

  async createMultiMatch(
    req: ValidatedAuthRequest<typeof multiMatchSchema>,
    res: Response,
  ): Promise<void> {
    try {
      const validated = req.validated.body;
      const userId = req.user?.id;
      const companyId = (req as any).context?.company_id;

      const result = await this.service.createMultiMatch(
        validated.aggregateId,
        validated.statementIds,
        userId,
        companyId,
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

  async getSuggestedGroupStatements(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { aggregateId, tolerancePercent, dateToleranceDays, maxStatements } = req.query;

      if (!aggregateId) {
        throw new ReconciliationError("Aggregate ID wajib diisi", "MISSING_PARAMS");
      }

      const result = await this.service.getSuggestedGroupStatements(
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

  async getReconciliationGroups(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      // Dates are optional - if not provided, return empty
      if (!startDate || !endDate) {
        res.status(200).json({
          success: true,
          data: [],
        });
        return;
      }

      const result = await this.service.getReconciliationGroups(
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

  async getMultiMatchGroup(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;

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

  // =====================================================
  // REVERSE MATCHING ENDPOINTS
  // =====================================================

  async getUnreconciledStatements(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { bankAccountId } = req.query;

      // Get all bank accounts for the company
      const accounts = await this.service.getAllBankAccounts();
      
      // Get unreconciled statements - either for specific account or all accounts
      const statements = await this.service.getUnreconciledStatements(
        bankAccountId ? parseInt(bankAccountId as string) : undefined
      );

      res.status(200).json({
        success: true,
        data: statements,
      });
    } catch (error: any) {
      logError("Get unreconciled statements error", { 
        query: req.query,
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof DatabaseConnectionError) status = 503;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FETCH_UNRECONCILED_FAILED",
      });
    }
  }

  async findStatementsByAmount(
    req: AuthenticatedQueryRequest,
    res: Response,
  ): Promise<void> {
    try {
      const { amount, tolerance } = req.query;

      if (!amount) {
        res.status(400).json({
          success: false,
          message: "Amount parameter is required",
          code: "MISSING_AMOUNT",
        });
        return;
      }

      const amountNum = parseFloat(amount as string);
      const toleranceNum = tolerance ? parseFloat(tolerance as string) : undefined;

      if (isNaN(amountNum) || amountNum <= 0) {
        res.status(400).json({
          success: false,
          message: "Amount must be a valid positive number",
          code: "INVALID_AMOUNT",
        });
        return;
      }

      const statements = await this.service.findStatementsByAmount(
        amountNum,
        toleranceNum
      );

      res.status(200).json({
        success: true,
        data: statements,
      });
    } catch (error: any) {
      logError("Find statements by amount error", { 
        query: req.query,
        error: error.message,
        code: error.code 
      });
      
      let status = 400;
      if (error instanceof DatabaseConnectionError) status = 503;

      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || "FIND_BY_AMOUNT_FAILED",
      });
    }
  }
}

export const bankReconciliationController = new BankReconciliationController(
  bankReconciliationService
);
