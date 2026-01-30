import { Request, Response } from 'express';
import { BankReconciliationService } from './bank-reconciliation.service';
import { 
  ManualReconcileRequestDto, 
  AutoMatchRequestDto 
} from './bank-reconciliation.types';

export class BankReconciliationController {
  constructor(private readonly service: BankReconciliationService) {}

  /**
   * Reconcile a single POS aggregate with bank statement
   */
  async reconcile(req: Request, res: Response): Promise<void> {
    try {
      const dto: ManualReconcileRequestDto = req.body;
      const result = await this.service.reconcile(
        dto.aggregateId, 
        dto.statementId, 
        dto.notes
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

  /**
   * Run auto-matching for all unreconciled items
   */
  async autoMatch(req: Request, res: Response): Promise<void> {
    try {
      const dto: AutoMatchRequestDto = req.body;
      const result = await this.service.autoMatch(
        dto.companyId, 
        new Date(dto.startDate), 
        dto.matchingCriteria
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

