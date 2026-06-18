/**
 * Bug Condition Exploration Test
 * Property 1: Marketplace Asset Capitalization Missing Journal
 *
 * Validates: Requirements 1.1, 1.3, 2.1, 2.4
 *
 * Bug Condition: When capitalizeMarketplaceAssets() is called for a marketplace GR
 * with draft fixed assets, the function activates assets but does NOT create a
 * capitalization journal entry (Dr Fixed Asset / Cr CC COA), leaving journal_id = NULL.
 *
 * EXPECTED: This test FAILS on unfixed code (confirming the bug exists).
 * When the fix is applied, this test should PASS.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals'

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../fixed-assets.repository', () => ({
  activateAsset: jest.fn(),
  createMovement: jest.fn(),
  findCategoryById: jest.fn(),
  updateJournalId: jest.fn(),
}))

jest.mock('../../monitoring/monitoring.service', () => ({
  AuditService: { log: jest.fn() },
}))

import * as repository from '../fixed-assets.repository'
import { capitalizeMarketplaceAssets } from '../fixed-assets.service'

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createMockClient() {
  return {
    query: jest.fn(),
  } as any
}

const COMPANY_ID = 'company-001'
const USER_ID = 'user-001'
const CAPITALIZED_DATE = '2024-06-15'

const MOCK_DRAFT_ASSET = {
  id: 'asset-001',
  company_id: COMPANY_ID,
  branch_id: 'branch-001',
  asset_code: 'PRL-001-0001',
  asset_name: 'POS Tablet',
  asset_category_id: 'cat-001',
  product_id: 'prod-001',
  status: 'DRAFT' as const,
  acquisition_date: '2024-06-01',
  cost: 5000000,
  salvage_value: 0,
  useful_life_months: 60,
  depreciation_method: 'STRAIGHT_LINE',
  capitalized_date: null,
  accumulated_depreciation: 0,
  gr_line_id: 'gr-line-001',
  purchase_invoice_id: null,
  journal_id: null,
  qr_code_url: null,
  photo_url: null,
  description: null,
  serial_number: null,
  location_note: null,
  created_by: USER_ID,
  updated_by: null,
  created_at: '2024-06-01T00:00:00Z',
  updated_at: '2024-06-01T00:00:00Z',
  deleted_at: null,
}

const MOCK_CATEGORY = {
  id: 'cat-001',
  company_id: COMPANY_ID,
  category_code: 'PRL',
  category_name: 'Peralatan',
  asset_coa_id: 'coa-fixed-asset-001',
  depreciation_expense_coa_id: 'coa-depr-expense-001',
  accumulated_depreciation_coa_id: 'coa-accum-depr-001',
  default_useful_life_months: 60,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  deleted_at: null,
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Bug Condition: Marketplace Asset Capitalization Missing Journal', () => {
  let mockClient: ReturnType<typeof createMockClient>

  beforeEach(() => {
    jest.resetAllMocks()
    mockClient = createMockClient()
  })

  it('should create a posted journal entry when capitalizing marketplace asset (BUG: currently does NOT)', async () => {
    // Arrange: Mock the client.query to return a draft asset (simulating marketplace GR with asset lines)
    mockClient.query.mockResolvedValueOnce({
      rows: [MOCK_DRAFT_ASSET],
    })

    // Mock repository.activateAsset succeeds
    ;(repository.activateAsset as any).mockResolvedValue(undefined)

    // Mock repository.createMovement succeeds
    ;(repository.createMovement as any).mockResolvedValue({
      id: 'movement-001',
      company_id: COMPANY_ID,
      fixed_asset_id: MOCK_DRAFT_ASSET.id,
      movement_type: 'CAPITALIZE',
    })

    // Mock repository.findCategoryById (needed for journal creation in fixed code)
    ;(repository.findCategoryById as any).mockResolvedValue(MOCK_CATEGORY)

    // Act: Call capitalizeMarketplaceAssets (the buggy function)
    const grLineIds = ['gr-line-001']
    await capitalizeMarketplaceAssets(mockClient, COMPANY_ID, grLineIds, CAPITALIZED_DATE, USER_ID)

    // ─── Assertions ──────────────────────────────────────────────────────────

    // Assert 1: Asset reaches ACTIVE status (this PASSES on unfixed code)
    expect(repository.activateAsset).toHaveBeenCalledWith(
      MOCK_DRAFT_ASSET.id,
      COMPANY_ID,
      { capitalized_date: CAPITALIZED_DATE, updated_by: USER_ID },
      mockClient,
    )

    // Assert 2: A journal_id is updated on the asset (FAILS on unfixed code - the bug)
    // The fixed code should call repository.updateJournalId after posting the journal
    expect(repository.updateJournalId).toHaveBeenCalledWith(
      MOCK_DRAFT_ASSET.id,
      expect.any(String), // journal ID should be populated
    )
  })

  it('should create journal with Dr Fixed Asset COA and Cr CC COA (BUG: no journal created)', async () => {
    // Arrange: Same setup as above
    mockClient.query.mockResolvedValueOnce({
      rows: [MOCK_DRAFT_ASSET],
    })
    ;(repository.activateAsset as any).mockResolvedValue(undefined)
    ;(repository.createMovement as any).mockResolvedValue({
      id: 'movement-001',
      company_id: COMPANY_ID,
      fixed_asset_id: MOCK_DRAFT_ASSET.id,
      movement_type: 'CAPITALIZE',
    })
    ;(repository.findCategoryById as any).mockResolvedValue(MOCK_CATEGORY)

    // Act
    const grLineIds = ['gr-line-001']
    await capitalizeMarketplaceAssets(mockClient, COMPANY_ID, grLineIds, CAPITALIZED_DATE, USER_ID)

    // Assert: The function should have called updateJournalId, meaning a journal was created
    // On unfixed code, updateJournalId is NEVER called because no journal is created
    const updateJournalCalls = (repository.updateJournalId as any).mock.calls
    expect(updateJournalCalls.length).toBeGreaterThan(0)

    // The journal should have been posted with:
    // - reference_type: 'fixed_asset'
    // - reference_id: asset.id
    // - Debit line: category.asset_coa_id with amount = asset.cost
    // - Credit line: CC COA with amount = asset.cost
    // - Status: POSTED
    //
    // Since the current code does NOT create any journal, repository.updateJournalId
    // is never called. This assertion will FAIL, confirming the bug.
    expect(repository.updateJournalId).toHaveBeenCalledWith(
      MOCK_DRAFT_ASSET.id,
      expect.any(String),
    )
  })

  it('should handle multiple assets in a single marketplace GR (BUG: no journals for any)', async () => {
    // Arrange: Multiple draft assets from same GR
    const asset2 = {
      ...MOCK_DRAFT_ASSET,
      id: 'asset-002',
      asset_code: 'PRL-001-0002',
      asset_name: 'Kitchen Fridge',
      cost: 8000000,
      gr_line_id: 'gr-line-002',
    }

    mockClient.query.mockResolvedValueOnce({
      rows: [MOCK_DRAFT_ASSET, asset2],
    })
    ;(repository.activateAsset as any).mockResolvedValue(undefined)
    ;(repository.createMovement as any).mockResolvedValue({
      id: 'movement-001',
      company_id: COMPANY_ID,
      fixed_asset_id: MOCK_DRAFT_ASSET.id,
      movement_type: 'CAPITALIZE',
    })
    ;(repository.findCategoryById as any).mockResolvedValue(MOCK_CATEGORY)

    // Act
    const grLineIds = ['gr-line-001', 'gr-line-002']
    await capitalizeMarketplaceAssets(mockClient, COMPANY_ID, grLineIds, CAPITALIZED_DATE, USER_ID)

    // Assert: Both assets should have journal_id updated
    // On unfixed code, updateJournalId is NEVER called for either asset
    expect(repository.updateJournalId).toHaveBeenCalledTimes(2)
    expect(repository.updateJournalId).toHaveBeenCalledWith(
      'asset-001',
      expect.any(String),
    )
    expect(repository.updateJournalId).toHaveBeenCalledWith(
      'asset-002',
      expect.any(String),
    )
  })
})
