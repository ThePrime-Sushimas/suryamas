import { BankReconciliationService } from '../bank-reconciliation.service';
import { BankReconciliationRepository } from '../bank-reconciliation.repository';
import { 
  AlreadyReconciledError, 
  DifferenceThresholdExceededError 
} from '../bank-reconciliation.errors';

describe('BankReconciliationService', () => {
  let service: BankReconciliationService;
  let mockRepository: jest.Mocked<BankReconciliationRepository>;
  
  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      getUnreconciled: jest.fn(),
      getUnreconciledBatch: jest.fn(),
      markAsReconciled: jest.fn(),
      bulkUpdateReconciliationStatus: jest.fn(),
      getByDateRange: jest.fn(),
      updateStatus: jest.fn()
    } as any;
    
    // Create service with a fake orchestrator for tests
    service = new BankReconciliationService(mockRepository, {
      getAggregatesForDate: jest.fn()
    });
  });
  
  describe('calculateDifference', () => {
    it('should calculate absolute and percentage difference correctly', () => {
      const result = service.calculateDifference(1000, 990);
      expect(result.absolute).toBe(10);
      expect(result.percentage).toBe(1);
    });
    
    it('should handle zero aggregate amount', () => {
      const result = service.calculateDifference(0, 100);
      expect(result.absolute).toBe(100);
      expect(result.percentage).toBe(0);
    });
  });
  
  describe('reconcile', () => {
    it('should throw error if statement not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      
      await expect(service.reconcile('agg1', 'stmt1'))
        .rejects.toThrow('Bank statement not found');
    });
    
    it('should throw AlreadyReconciledError if already reconciled', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'stmt1',
        is_reconciled: true
      });
      
      await expect(service.reconcile('agg1', 'stmt1'))
        .rejects.toThrow(AlreadyReconciledError);
    });
    
    it('should mark as reconciled if validation passes', async () => {
      mockRepository.findById.mockResolvedValue({
        id: 'stmt1',
        is_reconciled: false,
        credit_amount: 100,
        debit_amount: 0
      });
      
      const result = await service.reconcile('agg1', 'stmt1');
      
      expect(result.success).toBe(true);
      expect(mockRepository.markAsReconciled).toHaveBeenCalledWith('stmt1', 'agg1');
    });
  });

  describe('autoMatch', () => {
    it('should perform exact matching successfully', async () => {
      const mockStatements = [
        { id: 's1', credit_amount: 100, debit_amount: 0, transaction_date: '2024-01-01', reference_number: 'REF1' }
      ];
      const mockAggregates = [
        { id: 'a1', nett_amount: 100, transaction_date: '2024-01-01', reference_number: 'REF1' }
      ];

      mockRepository.getUnreconciledBatch.mockResolvedValue(mockStatements);
      (service as any).orchestratorService.getAggregatesForDate.mockResolvedValue(mockAggregates);

      const result = await service.autoMatch('comp1', new Date('2024-01-01'));
      
      expect(result.matched).toBe(1);
      expect(mockRepository.markAsReconciled).toHaveBeenCalledWith('s1', 'a1');
    });

    it('should handle fuzzy matching within date buffer', async () => {
      const mockStatements = [
        { id: 's1', credit_amount: 100, debit_amount: 0, transaction_date: '2024-01-02' }
      ];
      const mockAggregates = [
        { id: 'a1', nett_amount: 100, transaction_date: '2024-01-01' }
      ];

      mockRepository.getUnreconciledBatch.mockResolvedValue(mockStatements);
      (service as any).orchestratorService.getAggregatesForDate.mockResolvedValue(mockAggregates);

      const result = await service.autoMatch('comp1', new Date('2024-01-01'), { dateBufferDays: 3 });
      
      expect(result.matched).toBe(1);
    });
  });

  describe('undo', () => {
    it('should throw error if statement not found', async () => {
      mockRepository.findById.mockResolvedValue(null);
      await expect(service.undo('stmt1')).rejects.toThrow('Bank statement not found');
    });

    it('should call undoReconciliation and logAction', async () => {
      mockRepository.findById.mockResolvedValue({ id: 'stmt1', company_id: 'comp1', aggregate_id: 'agg1' });
      
      await service.undo('stmt1', 'user1');
      
      expect(mockRepository.undoReconciliation).toHaveBeenCalledWith('stmt1');
      expect(mockRepository.logAction).toHaveBeenCalledWith(expect.objectContaining({
        action: 'UNDO',
        statementId: 'stmt1',
        userId: 'user1'
      }));
    });
  });
});
