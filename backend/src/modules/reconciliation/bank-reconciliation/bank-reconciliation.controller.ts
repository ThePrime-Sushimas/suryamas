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
}

export const bankReconciliationController = new BankReconciliationController(
  bankReconciliationService,
);
