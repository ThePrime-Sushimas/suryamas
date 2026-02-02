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
} from "./bank-reconciliation.errors";

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
      res.status(400).json({
        success: false,
        message: error.message,
        code: "UNDO_FAILED",
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
      res.status(400).json({
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

      const result = await this.service.getStatements(
        companyId,
        new Date(startDate),
        new Date(endDate),
        bankAccountId ? parseInt(bankAccountId) : undefined,
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
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
        companyId,
        new Date(startDate),
        new Date(endDate),
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
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
      res.status(400).json({
        success: false,
        message: error.message,
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
        throw new Error("Company ID is required");
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
      res.status(400).json({
        success: false,
        message: error.message,
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
      res.status(400).json({
        success: false,
        message: error.message,
        code: "MULTI_MATCH_FAILED",
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
      res.status(400).json({
        success: false,
        message: error.message,
        code: "UNDO_MULTI_MATCH_FAILED",
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
        throw new Error("Company ID dan Aggregate ID wajib diisi");
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
      res.status(400).json({
        success: false,
        message: error.message,
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
      res.status(400).json({
        success: false,
        message: error.message,
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
        throw new Error("Company ID wajib diisi");
      }

      const result = await this.service.getMultiMatchGroup(groupId as string);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

export const bankReconciliationController = new BankReconciliationController(
  bankReconciliationService,
);
