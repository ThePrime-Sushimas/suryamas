import { Request, Response } from 'express';
import { BankReconciliationService } from './bank-reconciliation.service';
import { 
  ManualReconcileRequestDto, 
  AutoMatchRequestDto 
} from './bank-reconciliation.types';
import { 
  AlreadyReconciledError, 
  DifferenceThresholdExceededError,
  NoMatchFoundError
} from './bank-reconciliation.errors';

export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  /**
   * Reconcile a single POS aggregate with bank statement
   */
  async reconcile(req: Request, res: Response): Promise<void> {
    try {
      const validated = (req as any).validated.body;
      const userId = (req as any).user?.id;

      const result = await this.service.reconcile(
        validated.aggregateId, 
        validated.statementId, 
        userId,
        validated.notes
      );
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      let status = 400;
      if (error instanceof AlreadyReconciledError) status = 409;
      if (error instanceof DifferenceThresholdExceededError) status = 422;
      
      res.status(status).json({
        success: false,
        message: error.message,
        code: error.code || 'RECONCILIATION_FAILED'
      });
    }
  }

  /**
   * Undo reconciliation
   */
  async undo(req: Request, res: Response): Promise<void> {
    try {
      const { statementId } = req.params;
      const userId = (req as any).user?.id;

      await this.service.undo(statementId as string, userId);
      
      res.status(200).json({
        success: true,
        message: 'Reconciliation undone successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'UNDO_FAILED'
      });
    }
  }

  /**
   * Run auto-matching for all unreconciled items
   */
  async autoMatch(req: Request, res: Response): Promise<void> {
    try {
      const validated = (req as any).validated.body;
      const userId = (req as any).user?.id;

      const result = await this.service.autoMatch(
        validated.companyId, 
        new Date(validated.startDate), 
        userId,
        validated.matchingCriteria
      );
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
        code: error.code || 'AUTO_MATCH_FAILED'
      });
    }
  }

  /**
   * Get reconciliation discrepancies
   */
  async getDiscrepancies(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, date } = (req as any).validated.query;
      
      const result = await this.service.getDiscrepancies(companyId, new Date(date));
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get reconciliation summary
   */
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, startDate, endDate } = (req as any).validated.query;

      const result = await this.service.getSummary(
        companyId, 
        new Date(startDate), 
        new Date(endDate)
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

