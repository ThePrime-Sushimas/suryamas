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
      const dto: ManualReconcileRequestDto = req.body;
      const userId = (req as any).user?.id; // Assuming user info is attached to request

      const result = await this.service.reconcile(
        dto.aggregateId, 
        dto.statementId, 
        userId,
        dto.notes
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
      const dto: AutoMatchRequestDto = req.body;
      const userId = (req as any).user?.id;

      const result = await this.service.autoMatch(
        dto.companyId, 
        new Date(dto.startDate), 
        userId,
        dto.matchingCriteria
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
      const companyId = req.query.companyId as string;
      const date = new Date(req.query.date as string);
      
      const result = await this.service.getDiscrepancies(companyId, date);
      
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
      // TODO: Implement summary calculation in service
      res.status(200).json({
        success: true,
        data: { total: 0, matched: 0, unmatched: 0 }
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

