import { Request, Response } from "express";
import { handleError } from "../../../utils/error-handler.util";
import {
  bankReconciliationService,
  BankReconciliationService,
} from "./bank-reconciliation.service";
import type { ValidatedAuthRequest } from "../../../middleware/validation.middleware";
import {
  manualReconcileSchema,
  manualReconcileCashDepositSchema,
  autoMatchSchema,
  autoMatchPreviewSchema,
  autoMatchConfirmSchema,
  multiMatchSchema,
} from "./bank-reconciliation.schema";
import {
  ReconciliationError,
} from "./bank-reconciliation.errors";

export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  async reconcileCashDeposit(req: Request, res: Response): Promise<void> {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof manualReconcileCashDepositSchema>).validated;
      const userId = req.user?.id;
      const companyId = req.context?.company_id;

      const result = await this.service.reconcileCashDeposit(
        body.cashDepositId,
        body.statementId,
        userId,
        companyId,
        body.notes,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'reconcile_cash_deposit' });
    }
  }

  async reconcile(req: Request, res: Response): Promise<void> {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof manualReconcileSchema>).validated;
      const userId = req.user?.id;
      const companyId = req.context?.company_id;

      const result = await this.service.reconcile(
        body.aggregateId,
        body.statementId,
        userId,
        companyId,
        body.notes,
        body.overrideDifference,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'reconcile' });
    }
  }

  async undo(req: Request, res: Response): Promise<void> {
    try {
      const { statementId } = req.params;
      const userId = req.user?.id;
      const companyId = req.context?.company_id;

      await this.service.undo(statementId as string, userId, companyId);

      res.status(200).json({
        success: true,
        message: "Reconciliation undone successfully",
      });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'undo_reconcile', statementId: req.params.statementId });
    }
  }

  async autoMatch(req: Request, res: Response): Promise<void> {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof autoMatchSchema>).validated;
      const userId = req.user?.id;
      const companyId = req.context?.company_id;

      const result = await this.service.autoMatch(
        new Date(body.startDate),
        new Date(body.endDate),
        body.bankAccountId,
        userId,
        companyId,
        body.matchingCriteria,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'auto_match' });
    }
  }

  async previewAutoMatch(req: Request, res: Response): Promise<void> {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof autoMatchPreviewSchema>).validated;

      const result = await this.service.previewAutoMatch(
        new Date(body.startDate),
        new Date(body.endDate),
        body.bankAccountId,
        body.matchingCriteria,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'preview_auto_match' });
    }
  }

  async confirmAutoMatch(req: Request, res: Response): Promise<void> {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof autoMatchConfirmSchema>).validated;
      const userId = req.user?.id;
      const companyId = req.context?.company_id;

      const result = await this.service.confirmAutoMatch(
        body.statementIds,
        userId,
        companyId,
        body.matchingCriteria,
        body.matches,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'confirm_auto_match' });
    }
  }

  async getStatements(req: Request, res: Response): Promise<void> {
    try {
      const query = (req.validated as { query: Record<string, unknown> })?.query as Record<string, unknown> || req.query;
      const { startDate, endDate, bankAccountId, status, search, isReconciled, creditOnly } = query;

      // Get sort params from query middleware
      const sortField = req.sort?.field || 'transaction_date';
      const sortOrder = req.sort?.order || 'desc';
      
      // Calculate offset from pagination - use a large limit if no pagination
      const page = req.pagination?.page || 1;
      const limit = req.pagination?.limit || 10000; // Large limit to get all data
      const offset = (page - 1) * limit;

      const result = await this.service.getStatements(
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        bankAccountId as number[] | undefined,
        {
          status: status as "RECONCILED" | "UNRECONCILED" | undefined,
          search: search as string | undefined,
          isReconciled: isReconciled === 'true' ? true : isReconciled === 'false' ? false : undefined,
          creditOnly: (creditOnly as boolean | undefined) || undefined,
          sortField,
          sortOrder,
          limit,
          offset,
        },
      );

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'get_statements', query: req.query });
    }
  }

  async getBankAccountsStatus(req: Request, res: Response): Promise<void> {
    try {
      const query = (req.validated as { query: Record<string, unknown> })?.query as Record<string, unknown> || req.query;
      const { startDate, endDate } = query;

      // Dates are optional - if not provided, return empty
      if (!startDate || !endDate) {
        res.status(200).json({
          success: true,
          data: [],
        });
        return;
      }

      const result = await this.service.getBankAccountsStatus(
        new Date(startDate as string),
        new Date(endDate as string),
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'get_bank_accounts_status', 
        startDate: req.query?.startDate, 
        endDate: req.query?.endDate 
      });
    }
  }

  async getAllBankAccounts(req: Request, res: Response): Promise<void> {
    try {
      const result = await this.service.getAllBankAccounts();

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'get_unmatched_statements' });
    }
  }

  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const query = (req.validated as { query: Record<string, unknown> })?.query as Record<string, unknown> || req.query;
      const { startDate, endDate } = query;

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
        new Date(startDate as string),
        new Date(endDate as string),
      );

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'get_summary', 
        startDate: req.query?.startDate, 
        endDate: req.query?.endDate 
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
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'get_potential_matches', statementId: req.params.id });
    }
  }

  async createMultiMatch(req: Request, res: Response): Promise<void> {
    try {
      const { body } = (req as ValidatedAuthRequest<typeof multiMatchSchema>).validated;
      const userId = req.user?.id;
      const companyId = req.context?.company_id;

      const result = await this.service.createMultiMatch(
        body.aggregateId,
        body.statementIds,
        userId,
        companyId,
        body.notes,
        body.overrideDifference,
      );

      res.status(201).json({ success: true, data: result });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'create_multi_match' });
    }
  }

  async undoMultiMatch(req: Request, res: Response): Promise<void> {
    try {
      const { groupId } = req.params;
      const userId = req.user?.id;
      const companyId = req.context?.company_id;

      await this.service.undoMultiMatch(groupId as string, userId, companyId);

      res.status(200).json({
        success: true,
        message: "Multi-match berhasil dibatalkan",
      });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'undo_multi_match', groupId: req.params.groupId });
    }
  }

  async getSuggestedGroupStatements(req: Request, res: Response): Promise<void> {
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
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'get_suggested_group', aggregateId: req.query.aggregateId });
    }
  }

  async getReconciliationGroups(req: Request, res: Response): Promise<void> {
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
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'get_reconciliation_groups', startDate: req.query.startDate, endDate: req.query.endDate });
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
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'get_multi_match_group', groupId: req.params.groupId });
    }
  }

  // =====================================================
  // REVERSE MATCHING ENDPOINTS
  // =====================================================

  async getUnreconciledStatements(req: Request, res: Response): Promise<void> {
    try {
      const { bankAccountId, search, limit, offset, startDate, endDate } = req.query;

      // Get unreconciled statements - either for specific account or all accounts
      const result = await this.service.getUnreconciledStatements(
        bankAccountId ? parseInt(bankAccountId as string) : undefined,
        search as string | undefined,
        limit ? parseInt(limit as string) : 50,
        offset ? parseInt(offset as string) : 0,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.status(200).json({
        success: true,
        data: result.data,
        total: result.total,
      });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'get_unreconciled_statements', query: req.query });
    }
  }

  async findStatementsByAmount(req: Request, res: Response): Promise<void> {
    try {
      const { amount, tolerance, startDate, endDate } = req.query;

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
        toleranceNum,
        startDate ? new Date (startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined
      );

      res.status(200).json({
        success: true,
        data: statements,
      });
    } catch (error: unknown) {
      return await handleError(res, error, req, { action: 'find_statements_by_amount', query: req.query });
    }
  }
}

export const bankReconciliationController = new BankReconciliationController(
  bankReconciliationService
);
