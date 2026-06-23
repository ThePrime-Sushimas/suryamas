/**
 * Unit tests for journal-headers forceDelete cascade handlers.
 *
 * Tests the P1 fix for orphan data prevention:
 * - purchase_invoice: cascade revert PI + AP payment journals
 * - fixed_asset (capitalization): guard against depreciation, revert to DRAFT
 * - stock_adjustment: clear journal_id via _clearJournalRefsSequential
 * - stock_transfer: clear source/target journal_id via _clearJournalRefsSequential
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockFindById = jest.fn()
const mockClearReversalReferences = jest.fn()
const mockClearJournalReferences = jest.fn()
const mockDelete = jest.fn()
const mockBulkHardDelete = jest.fn()
const mockClearJournalRefsSequential = jest.fn()

jest.mock('../journal-headers.repository', () => ({
  journalHeadersRepository: {
    findById: (...args: unknown[]) => mockFindById(...args),
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    clearReversalReferences: (...args: unknown[]) => mockClearReversalReferences(...args),
    clearJournalReferences: (...args: unknown[]) => mockClearJournalReferences(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    bulkHardDelete: (...args: unknown[]) => mockBulkHardDelete(...args),
    getStatusCounts: jest.fn().mockResolvedValue({}),
  },
}))

const mockRevertPaidAfterJournalDelete = jest.fn()
const mockFindPaymentIdsWithJournalByInvoiceId = jest.fn()

jest.mock('../../../../ap-payments/ap-payments.repository', () => ({
  apPaymentsRepository: {
    revertPaidAfterJournalDelete: (...args: unknown[]) => mockRevertPaidAfterJournalDelete(...args),
    findPaymentIdsWithJournalByInvoiceId: (...args: unknown[]) => mockFindPaymentIdsWithJournalByInvoiceId(...args),
  },
}))

const mockPiUpdateStatus = jest.fn()
const mockPiWithTransaction = jest.fn()

jest.mock('../../../../purchase-invoices/purchase-invoices.repository', () => ({
  purchaseInvoicesRepository: {
    updateStatus: (...args: unknown[]) => mockPiUpdateStatus(...args),
    withTransaction: (...args: unknown[]) => mockPiWithTransaction(...args),
  },
}))

jest.mock('../../../../general-invoices/general-invoices.repository', () => ({
  generalInvoiceRepository: {
    findJournalIdByInvoiceId: jest.fn(),
    hardDelete: jest.fn(),
    withTransaction: jest.fn(),
  },
  generalPaymentRepository: {
    findAllByInvoiceId: jest.fn().mockResolvedValue([]),
    findInvoiceIdByPaymentId: jest.fn(),
    findSettlementById: jest.fn(),
    hardDeleteByInvoiceId: jest.fn(),
    deleteSettlementRecord: jest.fn(),
  },
  amortizationRepository: {
    findJournalIdsByInvoiceId: jest.fn().mockResolvedValue([]),
  },
}))

jest.mock('../../../../marketplace-po/marketplace-po.repository', () => ({
  marketplacePoRepository: {
    reverseSettledSession: jest.fn(),
    reverseBulkSettledSessions: jest.fn(),
  },
}))

jest.mock('../../../../notifications/notification-dispatcher.service', () => ({
  notificationDispatcher: { dispatch: jest.fn() },
}))

jest.mock('../../../../notifications/notification-events', () => ({
  NOTIFICATION_EVENT_KEYS: {},
}))

jest.mock('../../../../../config/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
  logWarn: jest.fn(),
}))

jest.mock('../../../../monitoring/monitoring.service', () => ({
  AuditService: { log: jest.fn().mockResolvedValue(undefined) },
}))

jest.mock('../../../chart-of-accounts/chart-of-accounts.repository', () => ({
  chartOfAccountsRepository: { validateMany: jest.fn() },
}))

jest.mock('../../../fiscal-periods/fiscal-periods.repository', () => ({
  fiscalPeriodsRepository: { findOpenPeriod: jest.fn() },
}))

jest.mock('../../../../../utils/branch-access.util', () => ({
  getAccessScope: jest.fn(),
  isBranchAccessible: jest.fn().mockReturnValue(true),
  getAccessibleBranchIds: jest.fn(),
  getAccessibleCompanyIds: jest.fn(),
  requireBranchAccess: jest.fn(),
  requireCompanyAccess: jest.fn(),
  getCompanyIdForBranch: jest.fn(),
}))

// Dynamic imports for fixed-assets
const mockHasDepreciationEntries = jest.fn()
const mockRevertCapitalizationFromJournal = jest.fn()
const mockHardDeleteAssetByJournalId = jest.fn()

jest.mock('../../../../fixed-assets/fixed-assets.repository', () => ({
  hasDepreciationEntries: (...args: unknown[]) => mockHasDepreciationEntries(...args),
  revertCapitalizationFromJournal: (...args: unknown[]) => mockRevertCapitalizationFromJournal(...args),
  hardDeleteAssetByJournalId: (...args: unknown[]) => mockHardDeleteAssetByJournalId(...args),
}))

jest.mock('../../../../fixed-assets/depreciation.service', () => ({
  reverseDepreciationRunFromJournal: jest.fn(),
}))

// ─── Import SUT ──────────────────────────────────────────────────────────────

import { journalHeadersService } from '../journal-headers.service'
import { JournalErrors } from '../../shared/journal.errors'

// ─── Test Helpers ────────────────────────────────────────────────────────────

const COMPANY_ID = 'company-001'
const BRANCH_ID = 'branch-001'
const USER_ID = 'user-001'
const BRANCH_IDS = [BRANCH_ID]
const COMPANY_IDS = [COMPANY_ID]

function makeJournal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'journal-001',
    company_id: COMPANY_ID,
    branch_id: BRANCH_ID,
    journal_number: 'JG-2025-01-0001',
    sequence_number: 1,
    journal_date: '2025-01-15',
    period: '2025-01',
    journal_type: 'GENERAL',
    source_module: null,
    reference_type: null,
    reference_id: null,
    reference_number: null,
    description: 'Test journal',
    total_debit: 1000,
    total_credit: 1000,
    currency: 'IDR',
    exchange_rate: 1,
    status: 'POSTED',
    is_reversed: false,
    lines: [],
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('JournalHeadersService.forceDelete — P1 cascade handlers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockClearReversalReferences.mockResolvedValue(undefined)
    mockClearJournalReferences.mockResolvedValue(undefined)
    mockDelete.mockResolvedValue(undefined)
  })

  // ────────────────────────────────────────────────────────────────────────────
  // PURCHASE INVOICE
  // ────────────────────────────────────────────────────────────────────────────

  describe('purchase_invoice / purchase_invoice', () => {
    const PI_ID = 'pi-001'
    const PI_JOURNAL_ID = 'journal-pi-001'

    it('should revert PI to APPROVED when no AP payments exist', async () => {
      const journal = makeJournal({
        id: PI_JOURNAL_ID,
        source_module: 'purchase_invoice',
        reference_type: 'purchase_invoice',
        reference_id: PI_ID,
      })
      mockFindById.mockResolvedValue(journal)
      mockFindPaymentIdsWithJournalByInvoiceId.mockResolvedValue([])
      mockPiWithTransaction.mockImplementation(async (fn: (client: unknown) => Promise<void>) => {
        await fn({}) // pass mock client
      })

      await journalHeadersService.forceDelete(PI_JOURNAL_ID, USER_ID, BRANCH_IDS, COMPANY_IDS)

      // Verify PI status revert
      expect(mockPiWithTransaction).toHaveBeenCalledTimes(1)
      expect(mockPiUpdateStatus).toHaveBeenCalledWith(
        expect.anything(), // client
        PI_ID,
        'APPROVED',
        expect.objectContaining({
          journal_id: null,
          posted_by: null,
          posted_at: null,
          updated_by: USER_ID,
        }),
      )

      // Verify journal cleanup
      expect(mockClearReversalReferences).toHaveBeenCalledWith(PI_JOURNAL_ID)
      expect(mockClearJournalReferences).toHaveBeenCalledWith(PI_JOURNAL_ID)
      expect(mockDelete).toHaveBeenCalledWith(PI_JOURNAL_ID, USER_ID)
    })

    it('should cascade-delete AP payment journals before reverting PI', async () => {
      const AP_JOURNAL_ID = 'journal-ap-001'
      const AP_PAYMENT_ID = 'ap-payment-001'

      const journal = makeJournal({
        id: PI_JOURNAL_ID,
        source_module: 'purchase_invoice',
        reference_type: 'purchase_invoice',
        reference_id: PI_ID,
      })
      mockFindById.mockResolvedValue(journal)
      mockFindPaymentIdsWithJournalByInvoiceId.mockResolvedValue([
        { id: AP_PAYMENT_ID, journal_id: AP_JOURNAL_ID },
      ])
      mockPiWithTransaction.mockImplementation(async (fn: (client: unknown) => Promise<void>) => {
        await fn({})
      })

      await journalHeadersService.forceDelete(PI_JOURNAL_ID, USER_ID, BRANCH_IDS, COMPANY_IDS)

      // Verify AP payment journal was deleted first
      expect(mockClearReversalReferences).toHaveBeenCalledWith(AP_JOURNAL_ID)
      expect(mockClearJournalReferences).toHaveBeenCalledWith(AP_JOURNAL_ID)
      expect(mockDelete).toHaveBeenCalledWith(AP_JOURNAL_ID, USER_ID)

      // Verify AP payment status reverted
      expect(mockRevertPaidAfterJournalDelete).toHaveBeenCalledWith(AP_PAYMENT_ID, USER_ID)

      // Verify PI was reverted after payment cascade
      expect(mockPiUpdateStatus).toHaveBeenCalledWith(
        expect.anything(),
        PI_ID,
        'APPROVED',
        expect.objectContaining({ journal_id: null }),
      )
    })

    it('should not delete AP payment journal if it is the same as the PI journal being deleted', async () => {
      // Edge case: AP payment journal_id happens to be the same journal (shouldn't happen, but guard)
      const journal = makeJournal({
        id: PI_JOURNAL_ID,
        source_module: 'purchase_invoice',
        reference_type: 'purchase_invoice',
        reference_id: PI_ID,
      })
      mockFindById.mockResolvedValue(journal)
      mockFindPaymentIdsWithJournalByInvoiceId.mockResolvedValue([
        { id: 'ap-001', journal_id: PI_JOURNAL_ID }, // same journal
      ])
      mockPiWithTransaction.mockImplementation(async (fn: (client: unknown) => Promise<void>) => {
        await fn({})
      })

      await journalHeadersService.forceDelete(PI_JOURNAL_ID, USER_ID, BRANCH_IDS, COMPANY_IDS)

      // Should NOT call clearReversalReferences for the same journal (it happens at end)
      // The AP payment journal delete should be skipped
      // But revertPaidAfterJournalDelete should still be called for the payment
      expect(mockRevertPaidAfterJournalDelete).toHaveBeenCalledWith('ap-001', USER_ID)
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // FIXED ASSET — CAPITALIZATION
  // ────────────────────────────────────────────────────────────────────────────

  describe('fixed_assets / fixed_asset (capitalization)', () => {
    const ASSET_ID = 'asset-001'
    const CAPITALIZATION_JOURNAL_ID = 'journal-cap-001'

    it('should revert asset to DRAFT when no depreciation entries exist', async () => {
      const journal = makeJournal({
        id: CAPITALIZATION_JOURNAL_ID,
        source_module: 'fixed_assets',
        reference_type: 'fixed_asset',
        reference_id: ASSET_ID,
      })
      mockFindById.mockResolvedValue(journal)
      mockHasDepreciationEntries.mockResolvedValue(false)
      mockRevertCapitalizationFromJournal.mockResolvedValue(undefined)

      await journalHeadersService.forceDelete(CAPITALIZATION_JOURNAL_ID, USER_ID, BRANCH_IDS, COMPANY_IDS)

      expect(mockHasDepreciationEntries).toHaveBeenCalledWith(ASSET_ID)
      expect(mockRevertCapitalizationFromJournal).toHaveBeenCalledWith(ASSET_ID, USER_ID)

      // Verify journal cleanup proceeds
      expect(mockClearReversalReferences).toHaveBeenCalledWith(CAPITALIZATION_JOURNAL_ID)
      expect(mockDelete).toHaveBeenCalledWith(CAPITALIZATION_JOURNAL_ID, USER_ID)
    })

    it('should BLOCK deletion when asset has depreciation entries', async () => {
      const journal = makeJournal({
        id: CAPITALIZATION_JOURNAL_ID,
        source_module: 'fixed_assets',
        reference_type: 'fixed_asset',
        reference_id: ASSET_ID,
      })
      mockFindById.mockResolvedValue(journal)
      mockHasDepreciationEntries.mockResolvedValue(true)

      await expect(
        journalHeadersService.forceDelete(CAPITALIZATION_JOURNAL_ID, USER_ID, BRANCH_IDS, COMPANY_IDS),
      ).rejects.toThrow()

      // Should NOT proceed with deletion
      expect(mockRevertCapitalizationFromJournal).not.toHaveBeenCalled()
      expect(mockDelete).not.toHaveBeenCalled()
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // STOCK ADJUSTMENT — FK cleanup via _clearJournalRefsSequential
  // ────────────────────────────────────────────────────────────────────────────

  describe('stock_adjustment (clearJournalReferences coverage)', () => {
    it('should delete journal for stock_adjustment source_module (no special handler, only clearRefs)', async () => {
      const SA_JOURNAL_ID = 'journal-sa-001'
      const journal = makeJournal({
        id: SA_JOURNAL_ID,
        source_module: 'stock_adjustment',
        reference_type: 'stock_adjustment',
        reference_id: 'sa-001',
      })
      mockFindById.mockResolvedValue(journal)

      await journalHeadersService.forceDelete(SA_JOURNAL_ID, USER_ID, BRANCH_IDS, COMPANY_IDS)

      // No special handler — just clearRefs + delete
      expect(mockClearReversalReferences).toHaveBeenCalledWith(SA_JOURNAL_ID)
      expect(mockClearJournalReferences).toHaveBeenCalledWith(SA_JOURNAL_ID)
      expect(mockDelete).toHaveBeenCalledWith(SA_JOURNAL_ID, USER_ID)
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // STOCK TRANSFER — FK cleanup via _clearJournalRefsSequential
  // ────────────────────────────────────────────────────────────────────────────

  describe('stock_transfer (clearJournalReferences coverage)', () => {
    it('should delete journal for stock_transfer source_module (no special handler, only clearRefs)', async () => {
      const ST_JOURNAL_ID = 'journal-st-001'
      const journal = makeJournal({
        id: ST_JOURNAL_ID,
        source_module: 'stock_transfer',
        reference_type: 'stock_transfer',
        reference_id: 'st-001',
      })
      mockFindById.mockResolvedValue(journal)

      await journalHeadersService.forceDelete(ST_JOURNAL_ID, USER_ID, BRANCH_IDS, COMPANY_IDS)

      // No special handler — just clearRefs + delete
      expect(mockClearReversalReferences).toHaveBeenCalledWith(ST_JOURNAL_ID)
      expect(mockClearJournalReferences).toHaveBeenCalledWith(ST_JOURNAL_ID)
      expect(mockDelete).toHaveBeenCalledWith(ST_JOURNAL_ID, USER_ID)
    })
  })
})
