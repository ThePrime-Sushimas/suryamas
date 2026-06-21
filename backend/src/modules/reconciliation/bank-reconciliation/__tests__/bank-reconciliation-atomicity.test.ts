/**
 * Transaction Atomicity Tests — Bank Reconciliation Module (Phase 3)
 *
 * These tests verify the real service methods execute all writes inside
 * withTransaction callback, and that failures inside that callback trigger
 * full rollback (no partial state).
 *
 * Key design:
 * - mockRepo.withTransaction EXECUTES the callback (like real implementation)
 * - This allows us to validate the exact sequence of calls inside the tx
 * - All service dependencies (orchestrator, feeService) are mocked
 * - Tests assert both success path AND failure-injection rollback behavior
 *
 * NOTE: jest.mock() factories must NOT reference outer module-level variables
 * (Jest hoisting issue). The factory uses inline jest.fn() which is safe
 * because `jest` is a global available at hoist time.
 */

import type { PoolClient } from 'pg'
import { AlreadyReconciledError } from '../bank-reconciliation.errors'

// ─── Mocks ──────────────────────────────────────────────────────────────────
// jest.mock() calls are hoisted by Jest. Factories use inline jest.fn() to
// avoid "Cannot access before initialization" errors from outer variable refs.

jest.mock('../../../../config/db', () => {
  const queryFn = jest.fn().mockResolvedValue({ rows: [] })
  const connectFn = jest.fn().mockResolvedValue({ query: jest.fn(), release: jest.fn() })
  return {
    pool: { connect: connectFn, query: queryFn },
  }
})

jest.mock('../../../../config/logger', () => ({
  logError: jest.fn(),
  logInfo: jest.fn(),
  logWarn: jest.fn(),
}))

jest.mock('../../../monitoring/monitoring.service', () => ({
  AuditService: { log: jest.fn().mockResolvedValue(undefined) },
}))

// Mock cashCountsRepository to prevent confirmAutoMatch/undo from hitting real pool.query
jest.mock('../../../cash-counts/cash-counts.repository', () => ({
  cashCountsRepository: {
    getDepositedForMatch: jest.fn().mockResolvedValue([]),
    findDepositById: jest.fn().mockRejectedValue(new Error('not mocked — use for specific tests')),
    reconcileDeposit: jest.fn(),
    unreconciledDeposit: jest.fn(),
  },
}))

// ─── Imports (must be after jest.mock() to ensure hoisted mocks win) ───
import { BankReconciliationService } from '../bank-reconciliation.service'

// ─── Shared mock factories ──────────────────────────────────────────────────

function createMockRepo(mockClient: PoolClient) {
  return {
    withTransaction: jest.fn().mockImplementation(
      async (fn: (client: PoolClient) => Promise<any>) => fn(mockClient)
    ),
    findById: jest.fn(),
    findByIdForUpdate: jest.fn(),
    findByIdsForUpdate: jest.fn(),
    markAsReconciled: jest.fn(),
    markAsReconciledCashDeposit: jest.fn(),
    markStatementsAsReconciledWithGroup: jest.fn(),
    createReconciliationGroup: jest.fn().mockResolvedValue('group-123'),
    addStatementsToGroup: jest.fn(),
    logAction: jest.fn(),
    isAggregateInGroup: jest.fn(),
    undoReconciliation: jest.fn(),
    undoReconciliationGroup: jest.fn(),
    undoCashDepositReconciliation: jest.fn(),
    countReconciledStatementsInGroup: jest.fn(),
    softDeleteGroup: jest.fn(),
    getReconciliationGroupById: jest.fn(),
    getUnreconciledBatch: jest.fn(),
    getByDateRange: jest.fn(),
  }
}

function createMockOrchestrator() {
  return {
    getAggregateById: jest.fn(),
    getAggregatesByDateRange: jest.fn(),
    updateReconciliationStatus: jest.fn(),
    bulkUpdateReconciliationStatus: jest.fn(),
    findPotentialAggregatesForStatement: jest.fn(),
    getReconciliationSummary: jest.fn(),
  }
}

function createMockFeeService() {
  return {
    calculateAndSaveFeeDiscrepancy: jest.fn(),
    calculateAndSaveFeeDiscrepancyMultiMatch: jest.fn(),
    resetFeeDiscrepancy: jest.fn(),
  }
}

// ─── Test Data ──────────────────────────────────────────────────────────────

const MOCK_STATEMENT = {
  id: 'stmt-1',
  company_id: 'c1',
  credit_amount: 100000,
  debit_amount: 0,
  transaction_date: new Date('2026-06-01'),
  description: 'Test statement',
  reference_number: 'REF001',
  is_reconciled: false,
  reconciliation_id: null,
  reconciliation_group_id: null,
  cash_deposit_id: null,
  bank_mutation_entry_id: null,
}

const MOCK_AGGREGATE = {
  id: 'agg-1',
  company_id: 'c1',
  nett_amount: 100000,
  transaction_date: new Date('2026-06-01'),
  reference_number: 'AGGREF001',
  reconciliation_status: 'PENDING',
}

// ============================================================================
// REPOSITORY UNIT TESTS
// ============================================================================

import { BankReconciliationRepository } from '../bank-reconciliation.repository'

describe('BankReconciliationRepository', () => {
  let repo: BankReconciliationRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new BankReconciliationRepository()
  })

  describe('withTransaction', () => {
    function getPool() {
      return (jest.requireMock('../../../../config/db') as any).pool
    }

    it('should COMMIT on success', async () => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() }
      getPool().connect.mockResolvedValue(client)

      await repo.withTransaction(async (c) => { await c.query('SELECT 1') })

      expect(client.query).toHaveBeenCalledWith('BEGIN')
      expect(client.query).toHaveBeenCalledWith('COMMIT')
      expect(client.release).toHaveBeenCalled()
    })

    it('should ROLLBACK on error and re-throw', async () => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() }
      getPool().connect.mockResolvedValue(client)

      await expect(repo.withTransaction(async () => { throw new Error('simulated failure') }))
        .rejects.toThrow('simulated failure')

      expect(client.query).toHaveBeenCalledWith('BEGIN')
      expect(client.query).toHaveBeenCalledWith('ROLLBACK')
      expect(client.query).not.toHaveBeenCalledWith('COMMIT')
      expect(client.release).toHaveBeenCalled()
    })

    it('should release client even if ROLLBACK throws', async () => {
      const client = {
        query: jest.fn().mockImplementation((sql: string) => {
          if (sql === 'ROLLBACK') throw new Error('rollback failed')
          return { rows: [] }
        }),
        release: jest.fn(),
      }
      getPool().connect.mockResolvedValue(client)

      await expect(repo.withTransaction(async () => { throw new Error('original error') }))
        .rejects.toThrow()

      expect(client.release).toHaveBeenCalled()
    })
  })

  describe('findByIdForUpdate', () => {
    it('should SELECT FOR UPDATE with the provided client', async () => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'stmt-1', is_reconciled: false }] }) } as unknown as PoolClient
      const result = await repo.findByIdForUpdate('stmt-1', client)
      expect(client.query).toHaveBeenCalledWith(expect.stringContaining('FOR UPDATE'), ['stmt-1'])
      expect(result.id).toBe('stmt-1')
    })

    it('should throw StatementNotFoundError if row not found', async () => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [] }) } as unknown as PoolClient
      await expect(repo.findByIdForUpdate('missing-id', client)).rejects.toThrow()
    })
  })

  describe('findByIdsForUpdate', () => {
    it('should SELECT FOR UPDATE with ORDER BY id for consistent lock ordering', async () => {
      const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'aaa', is_reconciled: false }, { id: 'bbb', is_reconciled: false }] }) } as unknown as PoolClient
      const result = await repo.findByIdsForUpdate(['bbb', 'aaa'], client)
      const queryCall = (client.query as jest.Mock).mock.calls[0][0] as string
      expect(queryCall).toContain('ORDER BY id')
      expect(queryCall).toContain('FOR UPDATE')
      expect(result).toHaveLength(2)
    })

    it('should return empty array for empty input', async () => {
      const client = { query: jest.fn() } as unknown as PoolClient
      const result = await repo.findByIdsForUpdate([], client)
      expect(result).toEqual([])
      expect(client.query).not.toHaveBeenCalled()
    })
  })
})

// ============================================================================
// SERVICE ATOMICITY TESTS
// ============================================================================

describe('BankReconciliationService — Transaction Atomicity', () => {
  let mockClient: PoolClient
  let mockRepo: ReturnType<typeof createMockRepo>
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>
  let mockFeeService: ReturnType<typeof createMockFeeService>
  let service: BankReconciliationService

  beforeEach(() => {
    jest.clearAllMocks()
    mockClient = { query: jest.fn() } as unknown as PoolClient
    mockRepo = createMockRepo(mockClient)
    mockOrchestrator = createMockOrchestrator()
    mockFeeService = createMockFeeService()
    service = new BankReconciliationService(mockRepo as any, mockOrchestrator as any, mockFeeService as any)
  })

  // ── reconcile() — HIGH ────────────────────────────────────────────────────
  describe('reconcile()', () => {
    const aggregateId = 'agg-1', statementId = 'stmt-1', userId = 'user-1', companyId = 'c1'

    function setupHappyPath() {
      mockRepo.findByIdForUpdate.mockResolvedValue({ ...MOCK_STATEMENT })
      mockRepo.markAsReconciled.mockResolvedValue(undefined)
      mockFeeService.calculateAndSaveFeeDiscrepancy.mockResolvedValue(undefined)
      mockOrchestrator.updateReconciliationStatus.mockResolvedValue(undefined)
      mockRepo.logAction.mockResolvedValue(undefined)
    }

    it('should call all writes inside withTransaction in the correct order on success', async () => {
      setupHappyPath()
      await service.reconcile(aggregateId, statementId, userId, companyId)
      expect(mockRepo.withTransaction).toHaveBeenCalledTimes(1)
      expect(mockRepo.findByIdForUpdate).toHaveBeenCalledWith(statementId, mockClient)
      expect(mockRepo.markAsReconciled).toHaveBeenCalledWith(statementId, aggregateId, userId, mockClient)
      expect(mockFeeService.calculateAndSaveFeeDiscrepancy).toHaveBeenCalledWith(aggregateId, statementId, mockClient)
      expect(mockOrchestrator.updateReconciliationStatus).toHaveBeenCalledWith(aggregateId, 'RECONCILED', statementId, userId, mockClient)
      expect(mockRepo.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'MANUAL_RECONCILE' }), mockClient)
    })

    it('should throw AlreadyReconciledError if statement already reconciled', async () => {
      mockRepo.findByIdForUpdate.mockResolvedValue({ ...MOCK_STATEMENT, is_reconciled: true })
      await expect(service.reconcile(aggregateId, statementId, userId, companyId)).rejects.toThrow(AlreadyReconciledError)
      expect(mockRepo.markAsReconciled).not.toHaveBeenCalled()
      expect(mockFeeService.calculateAndSaveFeeDiscrepancy).not.toHaveBeenCalled()
      expect(mockRepo.logAction).not.toHaveBeenCalled()
    })

    it('should FAILURE-INJECTION: fee throws after markAsReconciled → logAction NOT called (rollback boundary)', async () => {
      setupHappyPath()
      mockFeeService.calculateAndSaveFeeDiscrepancy.mockRejectedValueOnce(new Error('Fee calculation DB error'))
      await expect(service.reconcile(aggregateId, statementId, userId, companyId)).rejects.toThrow('Fee calculation DB error')
      expect(mockRepo.markAsReconciled).toHaveBeenCalled()
      expect(mockRepo.logAction).not.toHaveBeenCalled()
      expect(mockOrchestrator.updateReconciliationStatus).not.toHaveBeenCalled()
    })
  })

  // ── createMultiMatch() — HIGH ─────────────────────────────────────────────
  describe('createMultiMatch()', () => {
    const companyId = 'c1', aggregateId = 'agg-1', statementIds = ['stmt-1', 'stmt-2'], userId = 'user-1'

    function setupHappyPath() {
      mockOrchestrator.getAggregateById.mockResolvedValue({ ...MOCK_AGGREGATE })
      mockRepo.isAggregateInGroup.mockResolvedValue(null)
      mockRepo.findByIdsForUpdate.mockResolvedValue([
        { id: 'stmt-1', company_id: 'c1', credit_amount: 50000, debit_amount: 0, is_reconciled: false },
        { id: 'stmt-2', company_id: 'c1', credit_amount: 50000, debit_amount: 0, is_reconciled: false },
      ])
      mockRepo.createReconciliationGroup.mockResolvedValue('group-123')
      mockRepo.addStatementsToGroup.mockResolvedValue(undefined)
      mockRepo.markStatementsAsReconciledWithGroup.mockResolvedValue(undefined)
      mockFeeService.calculateAndSaveFeeDiscrepancyMultiMatch.mockResolvedValue(undefined)
      mockOrchestrator.updateReconciliationStatus.mockResolvedValue(undefined)
      mockRepo.logAction.mockResolvedValue(undefined)
    }

    it('should call all writes inside withTransaction in the correct order on success', async () => {
      setupHappyPath()
      const result = await service.createMultiMatch(companyId, aggregateId, statementIds, userId)
      expect(mockRepo.withTransaction).toHaveBeenCalledTimes(1)
      expect(mockRepo.findByIdsForUpdate).toHaveBeenCalledWith(expect.arrayContaining(statementIds), mockClient)
      expect(mockRepo.createReconciliationGroup).toHaveBeenCalled()
      expect(mockRepo.addStatementsToGroup).toHaveBeenCalled()
      expect(mockRepo.markStatementsAsReconciledWithGroup).toHaveBeenCalled()
      expect(mockFeeService.calculateAndSaveFeeDiscrepancyMultiMatch).toHaveBeenCalledWith(aggregateId, 100000, mockClient)
      expect(mockOrchestrator.updateReconciliationStatus).toHaveBeenCalledWith(aggregateId, 'RECONCILED', undefined, userId, mockClient)
      expect(mockRepo.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'CREATE_MULTI_MATCH' }), mockClient)
      expect(result.success).toBe(true)
      expect(result.groupId).toBe('group-123')
    })

    it('should FAILURE-INJECTION: fee throws after group+statements → logAction NOT called', async () => {
      setupHappyPath()
      mockFeeService.calculateAndSaveFeeDiscrepancyMultiMatch.mockRejectedValueOnce(new Error('Fee multi-match DB error'))
      await expect(service.createMultiMatch(companyId, aggregateId, statementIds, userId)).rejects.toThrow('Fee multi-match DB error')
      expect(mockRepo.createReconciliationGroup).toHaveBeenCalled()
      expect(mockRepo.addStatementsToGroup).toHaveBeenCalled()
      expect(mockRepo.markStatementsAsReconciledWithGroup).toHaveBeenCalled()
      expect(mockOrchestrator.updateReconciliationStatus).not.toHaveBeenCalled()
      expect(mockRepo.logAction).not.toHaveBeenCalled()
    })

    it('should throw if aggregate not found (pre-validation, outside tx)', async () => {
      mockOrchestrator.getAggregateById.mockResolvedValue(null)
      await expect(service.createMultiMatch(companyId, aggregateId, statementIds, userId)).rejects.toThrow('Aggregate tidak ditemukan')
      expect(mockRepo.withTransaction).not.toHaveBeenCalled()
    })

    it('should throw if aggregate already in a group (pre-validation)', async () => {
      mockOrchestrator.getAggregateById.mockResolvedValue({ ...MOCK_AGGREGATE })
      mockRepo.isAggregateInGroup.mockResolvedValue({ id: 'existing-group' })
      await expect(service.createMultiMatch(companyId, aggregateId, statementIds, userId)).rejects.toThrow('Aggregate sudah menjadi bagian dari group')
      expect(mockRepo.withTransaction).not.toHaveBeenCalled()
    })

    it('should throw if statement is already reconciled (inside tx, after FOR UPDATE lock)', async () => {
      mockOrchestrator.getAggregateById.mockResolvedValue({ ...MOCK_AGGREGATE })
      mockRepo.isAggregateInGroup.mockResolvedValue(null)
      mockRepo.findByIdsForUpdate.mockResolvedValue([
        { id: 'stmt-1', company_id: 'c1', credit_amount: 50000, debit_amount: 0, is_reconciled: true },
        { id: 'stmt-2', company_id: 'c1', credit_amount: 50000, debit_amount: 0, is_reconciled: false },
      ])
      await expect(service.createMultiMatch(companyId, aggregateId, statementIds, userId)).rejects.toThrow('Beberapa statement tidak valid atau sudah dicocokkan')
      expect(mockRepo.withTransaction).toHaveBeenCalled()
      expect(mockRepo.findByIdsForUpdate).toHaveBeenCalled()
      expect(mockRepo.createReconciliationGroup).not.toHaveBeenCalled()
      expect(mockRepo.logAction).not.toHaveBeenCalled()
    })
  })

  // ── confirmAutoMatch() — partial-success ──────────────────────────────────
  describe('confirmAutoMatch()', () => {
    const userId = 'user-1', companyId = 'c1'
    const pair = (sid: string, aid: string) => ({ statementId: sid, aggregateId: aid, matchCriteria: 'EXACT_AMOUNT_DATE' })

    it('should succeed all matches when no failures occur', async () => {
      mockRepo.findById.mockResolvedValueOnce({ id: 'stmt-1', is_reconciled: false, credit_amount: 50000, debit_amount: 0, transaction_date: new Date('2026-06-01') })
        .mockResolvedValueOnce({ id: 'stmt-2', is_reconciled: false, credit_amount: 50000, debit_amount: 0, transaction_date: new Date('2026-06-01') })
      mockRepo.findByIdForUpdate.mockResolvedValueOnce({ id: 'stmt-1', is_reconciled: false }).mockResolvedValueOnce({ id: 'stmt-2', is_reconciled: false })
      mockRepo.markAsReconciled.mockResolvedValue(undefined)
      mockFeeService.calculateAndSaveFeeDiscrepancy.mockResolvedValue(undefined)
      mockOrchestrator.updateReconciliationStatus.mockResolvedValue(undefined)
      mockRepo.logAction.mockResolvedValue(undefined)

      const result = await service.confirmAutoMatch(['stmt-1', 'stmt-2'], userId, companyId, undefined, [pair('stmt-1', 'agg-1'), pair('stmt-2', 'agg-2')])
      expect(mockRepo.withTransaction).toHaveBeenCalledTimes(2)
      expect(result.matched).toBe(2)
      expect(result.failed).toBe(0)
      expect(result.matches).toHaveLength(2)
    })

    it('should partially succeed: failed matches skip, successful preserved', async () => {
      mockRepo.findById.mockResolvedValueOnce({ id: 'stmt-1', is_reconciled: false, credit_amount: 50000, debit_amount: 0, transaction_date: new Date('2026-06-01') })
        .mockResolvedValueOnce({ id: 'stmt-2', is_reconciled: false, credit_amount: 50000, debit_amount: 0, transaction_date: new Date('2026-06-01') })
      mockRepo.findByIdForUpdate.mockResolvedValueOnce({ id: 'stmt-1', is_reconciled: false }).mockResolvedValueOnce({ id: 'stmt-2', is_reconciled: false })
      mockRepo.markAsReconciled.mockResolvedValue(undefined)
      mockFeeService.calculateAndSaveFeeDiscrepancy.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Fee failed'))
      mockOrchestrator.updateReconciliationStatus.mockResolvedValue(undefined)
      mockRepo.logAction.mockResolvedValue(undefined)

      const result = await service.confirmAutoMatch(['stmt-1', 'stmt-2'], userId, companyId, undefined, [pair('stmt-1', 'agg-1'), pair('stmt-2', 'agg-2')])
      expect(result.matched).toBe(1)
      expect(result.failed).toBe(1)
      expect(result.matches).toHaveLength(1)
      expect(result.matches[0].statementId).toBe('stmt-1')
      const logCalls = mockRepo.logAction.mock.calls
      expect(logCalls).toHaveLength(1)
      expect(logCalls[0][0]).toMatchObject({ statementId: 'stmt-1' })
    })

    it('should handle already-reconciled (simulate concurrent) — skip gracefully', async () => {
      mockRepo.findById.mockResolvedValueOnce({ id: 'stmt-1', is_reconciled: false, credit_amount: 50000, debit_amount: 0, transaction_date: new Date('2026-06-01') })
      mockRepo.findByIdForUpdate.mockResolvedValueOnce({ id: 'stmt-1', is_reconciled: true })
      const result = await service.confirmAutoMatch(['stmt-1'], userId, companyId, undefined, [pair('stmt-1', 'agg-1')])
      expect(result.matched).toBe(0)
      expect(result.failed).toBe(1)
      expect(result.matches).toHaveLength(0)
      expect(mockRepo.markAsReconciled).not.toHaveBeenCalled()
    })
  })

  // ── undoMultiMatch() — MEDIUM ─────────────────────────────────────────────
  describe('undoMultiMatch()', () => {
    const groupId = 'group-123', aggregateId = 'agg-1', userId = 'user-1', companyId = 'c1'

    function setupHappyPath() {
      mockRepo.getReconciliationGroupById.mockResolvedValue({ id: groupId, aggregate_id: aggregateId, deleted_at: null })
      mockRepo.undoReconciliationGroup.mockResolvedValue(undefined)
      mockFeeService.resetFeeDiscrepancy.mockResolvedValue(undefined)
      mockOrchestrator.updateReconciliationStatus.mockResolvedValue(undefined)
      mockRepo.logAction.mockResolvedValue(undefined)
    }

    it('should call all writes inside withTransaction in the correct order on success', async () => {
      setupHappyPath()
      await service.undoMultiMatch(groupId, userId, companyId)
      expect(mockRepo.withTransaction).toHaveBeenCalledTimes(1)
      expect(mockRepo.undoReconciliationGroup).toHaveBeenCalledWith(groupId, userId, mockClient)
      expect(mockFeeService.resetFeeDiscrepancy).toHaveBeenCalledWith(aggregateId, mockClient)
      expect(mockOrchestrator.updateReconciliationStatus).toHaveBeenCalledWith(aggregateId, 'PENDING', undefined, undefined, mockClient)
      expect(mockRepo.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'UNDO_MULTI_MATCH' }), mockClient)
    })

    it('should FAILURE-INJECTION: undoReconciliationGroup throws → logAction NOT called', async () => {
      setupHappyPath()
      mockRepo.undoReconciliationGroup.mockRejectedValueOnce(new Error('Undo group DB error'))
      await expect(service.undoMultiMatch(groupId, userId, companyId)).rejects.toThrow('Undo group DB error')
      expect(mockFeeService.resetFeeDiscrepancy).not.toHaveBeenCalled()
      expect(mockRepo.logAction).not.toHaveBeenCalled()
    })
  })

  // ── undo() — standard aggregate path (MEDIUM) ─────────────────────────────
  describe('undo() — standard aggregate path', () => {
    const statementId = 'stmt-1', aggregateId = 'agg-1', userId = 'user-1', companyId = 'c1'

    function setupStandardPath() {
      mockRepo.findById.mockResolvedValue({ ...MOCK_STATEMENT, is_reconciled: true, reconciliation_id: aggregateId, reconciliation_group_id: null, cash_deposit_id: null, bank_mutation_entry_id: null })
      mockRepo.findByIdForUpdate.mockResolvedValue({ ...MOCK_STATEMENT })
      mockRepo.undoReconciliation.mockResolvedValue(undefined)
      mockFeeService.resetFeeDiscrepancy.mockResolvedValue(undefined)
      mockOrchestrator.updateReconciliationStatus.mockResolvedValue(undefined)
      mockRepo.logAction.mockResolvedValue(undefined)
    }

    it('should call all writes inside withTransaction for aggregate path', async () => {
      setupStandardPath()
      await service.undo(statementId, userId, companyId)
      expect(mockRepo.withTransaction).toHaveBeenCalledTimes(1)
      expect(mockRepo.findByIdForUpdate).toHaveBeenCalledWith(statementId, mockClient)
      expect(mockRepo.undoReconciliation).toHaveBeenCalledWith(statementId, userId, mockClient)
      expect(mockFeeService.resetFeeDiscrepancy).toHaveBeenCalledWith(aggregateId, mockClient)
      expect(mockOrchestrator.updateReconciliationStatus).toHaveBeenCalledWith(aggregateId, 'PENDING', undefined, undefined, mockClient)
      expect(mockRepo.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'UNDO', aggregateId }), mockClient)
    })

    it('should FAILURE-INJECTION: undoReconciliation throws inside tx → logAction NOT called', async () => {
      setupStandardPath()
      mockRepo.undoReconciliation.mockRejectedValueOnce(new Error('Undo reconciliation DB error'))
      await expect(service.undo(statementId, userId, companyId)).rejects.toThrow('Undo reconciliation DB error')
      expect(mockFeeService.resetFeeDiscrepancy).not.toHaveBeenCalled()
      expect(mockRepo.logAction).not.toHaveBeenCalled()
    })
  })

  // ── undo() — cash deposit path (MEDIUM) ───────────────────────────────────
  describe('undo() — cash deposit path', () => {
    const statementId = 'stmt-1', cashDepositId = 'cd-1', userId = 'user-1', companyId = 'c1'

    it('should call all writes inside withTransaction for cash deposit path', async () => {
      mockRepo.findById.mockResolvedValue({ ...MOCK_STATEMENT, is_reconciled: true, cash_deposit_id: cashDepositId, reconciliation_id: null, reconciliation_group_id: null, bank_mutation_entry_id: null })
      mockRepo.findByIdForUpdate.mockResolvedValue({ ...MOCK_STATEMENT, cash_deposit_id: cashDepositId })
      mockRepo.undoCashDepositReconciliation.mockResolvedValue(undefined)
      mockRepo.logAction.mockResolvedValue(undefined)

      await service.undo(statementId, userId, companyId)
      expect(mockRepo.withTransaction).toHaveBeenCalledTimes(1)
      expect(mockRepo.findByIdForUpdate).toHaveBeenCalledWith(statementId, mockClient)
      expect(mockRepo.undoCashDepositReconciliation).toHaveBeenCalledWith(statementId, cashDepositId, userId, mockClient)
      expect(mockRepo.logAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'UNDO_CASH_DEPOSIT' }), mockClient)
    })
  })

  // ── reconcileCashDeposit() — MEDIUM ───────────────────────────────────────
  describe('reconcileCashDeposit()', () => {
    const cashDepositId = 'cd-1', statementId = 'stmt-1', userId = 'user-1', companyId = 'c1'

    // cashCountsRepository is imported as a module-level singleton (not constructor-injected),
    // but it's already mocked via jest.mock('../../../cash-counts/cash-counts.repository')
    // at the top of this file. We import the mock to override per-test behavior.
    let mockCashCountsRepo: { findDepositById: jest.Mock; reconcileDeposit: jest.Mock }

    beforeEach(() => {
      mockCashCountsRepo = jest.requireMock('../../../cash-counts/cash-counts.repository').cashCountsRepository
    })

    function setupHappyPath() {
      mockRepo.findByIdForUpdate.mockResolvedValue({ ...MOCK_STATEMENT, is_reconciled: false })
      mockCashCountsRepo.findDepositById.mockResolvedValue({
        id: cashDepositId,
        status: 'DEPOSITED',
        deposit_amount: 100000,
      })
      mockRepo.markAsReconciledCashDeposit.mockResolvedValue(undefined)
      mockCashCountsRepo.reconcileDeposit.mockResolvedValue(undefined)
      mockRepo.logAction.mockResolvedValue(undefined)
    }

    it('should call all writes inside withTransaction in the correct order on success', async () => {
      setupHappyPath()
      await service.reconcileCashDeposit(cashDepositId, statementId, userId, companyId)

      expect(mockRepo.withTransaction).toHaveBeenCalledTimes(1)
      expect(mockRepo.findByIdForUpdate).toHaveBeenCalledWith(statementId, mockClient)
      expect(mockRepo.markAsReconciledCashDeposit).toHaveBeenCalledWith(statementId, cashDepositId, userId, mockClient)
      expect(mockCashCountsRepo.reconcileDeposit).toHaveBeenCalledWith(cashDepositId, statementId, mockClient)
      expect(mockRepo.logAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'AUTO_MATCH_CASH_DEPOSIT' }),
        mockClient,
      )
    })

    it('should FAILURE-INJECTION: reconcileDeposit throws after markAsReconciledCashDeposit → logAction NOT called', async () => {
      setupHappyPath()
      mockCashCountsRepo.reconcileDeposit.mockRejectedValueOnce(new Error('Reconcile deposit DB error'))

      await expect(
        service.reconcileCashDeposit(cashDepositId, statementId, userId, companyId)
      ).rejects.toThrow('Reconcile deposit DB error')

      // markAsReconciledCashDeposit was called (before reconcileDeposit in sequence)
      expect(mockRepo.markAsReconciledCashDeposit).toHaveBeenCalled()
      // logAction happens AFTER reconcileDeposit — should NOT be called
      expect(mockRepo.logAction).not.toHaveBeenCalled()
    })

    it('should throw AlreadyReconciledError if statement already reconciled', async () => {
      mockRepo.findByIdForUpdate.mockResolvedValue({ ...MOCK_STATEMENT, is_reconciled: true })

      await expect(
        service.reconcileCashDeposit(cashDepositId, statementId, userId, companyId)
      ).rejects.toThrow(AlreadyReconciledError)

      expect(mockCashCountsRepo.findDepositById).not.toHaveBeenCalled()
      expect(mockRepo.markAsReconciledCashDeposit).not.toHaveBeenCalled()
      expect(mockRepo.logAction).not.toHaveBeenCalled()
    })

    it('should throw if cash deposit not found', async () => {
      mockRepo.findByIdForUpdate.mockResolvedValue({ ...MOCK_STATEMENT, is_reconciled: false })
      mockCashCountsRepo.findDepositById.mockResolvedValue(null)

      await expect(
        service.reconcileCashDeposit(cashDepositId, statementId, userId, companyId)
      ).rejects.toThrow('Cash deposit not found')

      expect(mockRepo.markAsReconciledCashDeposit).not.toHaveBeenCalled()
      expect(mockRepo.logAction).not.toHaveBeenCalled()
    })

    it('should throw if cash deposit status is already RECONCILED', async () => {
      mockRepo.findByIdForUpdate.mockResolvedValue({ ...MOCK_STATEMENT, is_reconciled: false })
      mockCashCountsRepo.findDepositById.mockResolvedValue({ id: cashDepositId, status: 'RECONCILED', deposit_amount: 100000 })

      await expect(
        service.reconcileCashDeposit(cashDepositId, statementId, userId, companyId)
      ).rejects.toThrow('Cash deposit sudah reconciled')

      expect(mockRepo.markAsReconciledCashDeposit).not.toHaveBeenCalled()
      expect(mockRepo.logAction).not.toHaveBeenCalled()
    })

    it('should throw if cash deposit status is not DEPOSITED', async () => {
      mockRepo.findByIdForUpdate.mockResolvedValue({ ...MOCK_STATEMENT, is_reconciled: false })
      mockCashCountsRepo.findDepositById.mockResolvedValue({ id: cashDepositId, status: 'PENDING', deposit_amount: 100000 })

      await expect(
        service.reconcileCashDeposit(cashDepositId, statementId, userId, companyId)
      ).rejects.toThrow('harus DEPOSITED')

      expect(mockRepo.markAsReconciledCashDeposit).not.toHaveBeenCalled()
      expect(mockRepo.logAction).not.toHaveBeenCalled()
    })
  })
})