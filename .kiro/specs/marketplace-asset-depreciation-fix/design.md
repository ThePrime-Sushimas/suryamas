# Marketplace Asset Depreciation Fix - Bugfix Design

## Overview

Marketplace-sourced fixed assets (purchased via Tokopedia/Shopee using owner credit cards) are activated without creating a capitalization journal entry. This results in:
1. Incomplete general ledger — no Dr Fixed Asset / Cr Credit Card entry exists for these assets
2. `journal_id` remains NULL on the asset record, which may cause confusion in reporting

The fix adds journal creation to `capitalizeMarketplaceAssets()` using the owner credit card's COA as the credit account (mirroring how the marketplace-po module records the payment). No changes to `findDepreciableAssets()` are needed — the current query already includes all ACTIVE/MAINTENANCE assets regardless of `journal_id`.

## Glossary

- **Bug_Condition (C)**: A marketplace-sourced fixed asset is activated via `capitalizeMarketplaceAssets()` without a capitalization journal entry being created
- **Property (P)**: When a marketplace asset is capitalized, a journal entry (Dr Fixed Asset COA / Cr CC COA) SHALL be created and posted, and the asset's `journal_id` SHALL be updated
- **Preservation**: AP-flow capitalization (`capitalizeAssetsFromInvoice`), depreciation runs, manual activation, and all existing marketplace-po journal flows must remain unchanged
- **capitalizeMarketplaceAssets()**: Function in `fixed-assets.service.ts` that activates marketplace assets during GR confirmation
- **capitalizeAssetsFromInvoice()**: Function in `asset-lifecycle.service.ts` that capitalizes assets from Purchase Invoice (Dr Asset / Cr AP)
- **CC COA**: The chart-of-account code associated with an `owner_credit_cards` record, representing the credit card liability account used for marketplace purchases
- **110598**: Persediaan Transit (Transit Inventory) account used in marketplace checkout/receive flows

## Bug Details

### Bug Condition

The bug manifests when a goods receipt with `source = 'MARKETPLACE'` is confirmed and the GR contains asset product lines. The `capitalizeMarketplaceAssets()` function activates these assets (DRAFT → ACTIVE) and records a CAPITALIZE movement, but does NOT create a capitalization journal entry, leaving the general ledger incomplete.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { grSource: string, hasAssetLines: boolean, assetStatus: string }
  OUTPUT: boolean
  
  RETURN input.grSource = 'MARKETPLACE'
         AND input.hasAssetLines = true
         AND input.assetStatus = 'DRAFT'  -- asset about to be activated
         AND NOT capitalizationJournalCreated(input.assetId)
END FUNCTION
```

### Examples

- **Example 1**: Marketplace GR for a POS tablet (cost 5,000,000 IDR) confirmed → asset activated to ACTIVE with `journal_id = NULL`, no debit to Fixed Asset account, no credit to CC account
- **Example 2**: Marketplace GR for a fridge (cost 8,000,000 IDR) confirmed → asset status becomes ACTIVE but general ledger has no trace of the acquisition
- **Example 3**: AP-flow asset (same tablet purchased via supplier invoice) → works correctly: Dr Fixed Asset / Cr AP journal is created, `journal_id` is populated
- **Edge case**: Marketplace GR with mixed lines (some asset products, some inventory) → only asset lines should get capitalization journal; inventory lines follow normal 110598 transit flow

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- AP-flow capitalization (`capitalizeAssetsFromInvoice`) must continue to create Dr Fixed Asset / Cr AP (210101) journals
- Depreciation runs must continue to include all ACTIVE/MAINTENANCE assets with remaining depreciable value (current behavior is already correct — no `journal_id` gate exists)
- Manual activation via `activateAsset()` must continue to work without requiring a journal
- Marketplace-po module's existing journal flows (order journal: Dr 110598 / Cr CC, receive journal: Dr 110501 / Cr 110598) must remain unchanged
- `findDepreciableAssets()` must continue to use status + remaining value as sole eligibility criteria

**Scope:**
All inputs that do NOT involve marketplace asset capitalization should be completely unaffected by this fix. This includes:
- Non-asset GR lines (inventory products)
- AP-sourced assets going through invoice flow
- Existing depreciation calculations
- Asset transfers, maintenance, disposals

## Hypothesized Root Cause

Based on the code analysis, the root cause is clear:

1. **Missing Journal Creation in `capitalizeMarketplaceAssets()`**: The function in `fixed-assets.service.ts` (line 326) only calls `repository.activateAsset()` and `repository.createMovement()`. It does not create any journal entry. This was likely an intentional simplification during initial implementation, deferring accounting to a later phase that was never completed.

2. **No Credit Account Context Available**: Unlike `capitalizeAssetsFromInvoice()` which always credits AP (210101), marketplace assets are paid via owner credit cards. The `capitalizeMarketplaceAssets()` function currently receives only `(client, companyId, grLineIds, capitalizedDate, userId)` — it has no reference to the marketplace session or credit card that funded the purchase.

3. **Transaction Boundary Constraint**: `capitalizeMarketplaceAssets()` runs inside the GR confirmation transaction. Journal creation via `journalHeadersService` (create → submit → approve → post) performs multiple DB operations. The journal posting should happen OUTSIDE the GR transaction (same pattern as `capitalizeAssetsFromInvoice`), with rollback logic if journal posting fails.

4. **Note on `findDepreciableAssets()`**: The requirements document mentions a `journal_id IS NOT NULL` gate, but the current code at line 434 of `fixed-assets.repository.ts` does NOT have this gate. The eligibility query already uses only `status IN ('ACTIVE', 'MAINTENANCE') AND (cost - salvage_value) > accumulated_depreciation`. This means marketplace assets ARE being deprecated if they reach ACTIVE status — the real issue is purely the missing journal.

## Correctness Properties

Property 1: Bug Condition - Marketplace Asset Capitalization Creates Journal

_For any_ marketplace goods receipt containing asset product lines that is confirmed, the fixed `capitalizeMarketplaceAssets` function SHALL create a posted journal entry with: Dr Fixed Asset Account (from asset category's `asset_coa_id`) / Cr Credit Card COA (from the marketplace session's `owner_credit_cards.coa_code`), and SHALL update the asset's `journal_id` with the created journal header ID.

**Validates: Requirements 2.1, 2.4**

Property 2: Preservation - AP-Flow and Depreciation Unchanged

_For any_ asset capitalized through the Purchase Invoice flow, or any depreciation run executed against ACTIVE/MAINTENANCE assets, the fixed code SHALL produce exactly the same behavior as the original code, preserving AP journal creation (Dr Asset / Cr AP), depreciation calculations, and eligibility determination unchanged.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `backend/src/modules/fixed-assets/fixed-assets.service.ts`

**Function**: `capitalizeMarketplaceAssets()`

**Specific Changes**:

1. **Add parameters**: Pass `grId` (or the GR's `invoice_number`) so the function can look up the marketplace session and its `cc_id` to resolve the credit account COA.

2. **Restructure into two phases** (matching `capitalizeAssetsFromInvoice` pattern):
   - **Phase 1** (inside GR transaction): Activate assets + create movements (current behavior, unchanged)
   - **Phase 2** (outside GR transaction): Create and post capitalization journals, update `journal_id`. If journal posting fails, revert asset status back to DRAFT.

3. **Resolve credit account**: Query the marketplace session's `cc_id` from `marketplace_checkout_sessions` (joined via `goods_receipts.invoice_number = mcs.session_number`), then get the `coa_code` from `owner_credit_cards`.

4. **Create journal per asset**: For each activated asset, post a journal:
   - Dr: `category.asset_coa_id` (Fixed Asset account from asset's category)
   - Cr: CC COA (resolved from `owner_credit_cards.coa_code` via the session)
   - Amount: `asset.cost`
   - Description: `Kapitalisasi Aset Marketplace {asset_code} - {asset_name}`
   - source_module: `fixed_assets`
   - reference_type: `fixed_asset`

5. **Update `journal_id`**: After successful journal posting, call `repository.updateJournalId(asset.id, journalId)`.

6. **Rollback on failure**: If journal posting fails for any asset, revert all previously capitalized assets back to DRAFT status (same pattern as `capitalizeAssetsFromInvoice`).

---

**File**: `backend/src/modules/goods-receipts/goods-receipts.service.ts`

**Function**: `confirm()` (GR confirmation)

**Specific Changes**:

1. **Split marketplace capitalization into two phases**: Move the `capitalizeMarketplaceAssets()` call to return work items from Phase 1 (inside transaction), then run Phase 2 (journal posting) after the transaction commits.

2. **Pass additional context**: Provide the GR's `invoice_number` (which is the marketplace session's `session_number`) to enable credit account resolution.

---

**File**: `backend/src/modules/fixed-assets/fixed-assets.repository.ts`

**Specific Changes**:

1. **Add helper query**: `findMarketplaceCcCoaCode(client, companyId, sessionNumber)` — resolves the credit card COA code from the marketplace session linked to the GR.

```sql
SELECT occ.coa_code
FROM marketplace_checkout_sessions mcs
JOIN owner_credit_cards occ ON occ.id = mcs.cc_id AND occ.company_id = mcs.company_id
WHERE mcs.session_number = $1
  AND mcs.company_id = $2
  AND mcs.deleted_at IS NULL
```

---

**No migration needed**: The `fixed_assets.journal_id` column already exists and is nullable. No schema changes are required.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, verify that marketplace assets currently lack journals (confirming the bug), then verify the fix creates journals correctly and preserves all existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that create a marketplace GR with asset product lines, confirm it, and assert that (a) the asset reaches ACTIVE status, (b) no journal entry exists, and (c) `journal_id` is NULL. Run these tests on the UNFIXED code to observe that the bug condition holds.

**Test Cases**:
1. **Marketplace GR with single asset**: Confirm GR → verify asset is ACTIVE but `journal_id` is NULL (will pass on unfixed code, confirming the bug)
2. **Marketplace GR with multiple assets**: Confirm GR → verify all assets are ACTIVE but all have `journal_id = NULL`
3. **Compare with AP flow**: Create same asset via PI → verify `journal_id` IS populated (demonstrates AP flow works correctly)
4. **Depreciation includes marketplace asset**: Run depreciation after marketplace capitalization → verify asset IS included (confirming no `journal_id` gate)

**Expected Counterexamples**:
- Marketplace assets have `journal_id = NULL` after capitalization
- No journal_headers record exists with reference_id = marketplace asset ID and reference_type = 'fixed_asset'
- The general ledger is missing the debit to fixed asset account for marketplace acquisitions

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := capitalizeMarketplaceAssets_fixed(input)
  ASSERT result.journal_id IS NOT NULL
  ASSERT journalExists(result.journal_id)
  ASSERT journalHasDebit(result.journal_id, category.asset_coa_id, asset.cost)
  ASSERT journalHasCredit(result.journal_id, ccCoaId, asset.cost)
  ASSERT journalStatus(result.journal_id) = 'POSTED'
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT capitalizeAssetsFromInvoice_original(input) = capitalizeAssetsFromInvoice_fixed(input)
  ASSERT findDepreciableAssets_original(input) = findDepreciableAssets_fixed(input)
  ASSERT executeDepreciationRun_original(input) = executeDepreciationRun_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for AP-flow capitalization and depreciation runs, then write property-based tests capturing that behavior.

**Test Cases**:
1. **AP Capitalization Preservation**: Verify that `capitalizeAssetsFromInvoice` still creates Dr Asset / Cr AP journals with correct amounts
2. **Depreciation Calculation Preservation**: Verify that `calculateMonthlyDepreciation` produces identical results for all asset configurations
3. **Depreciation Eligibility Preservation**: Verify that `findDepreciableAssets` returns the same set of assets before and after the fix
4. **Manual Activation Preservation**: Verify that `activateAsset` continues to work without creating a journal

### Unit Tests

- Test `capitalizeMarketplaceAssets` creates journal with correct debit/credit accounts and amounts
- Test `capitalizeMarketplaceAssets` updates `journal_id` on asset after journal posting
- Test `capitalizeMarketplaceAssets` reverts assets to DRAFT if journal posting fails
- Test `capitalizeMarketplaceAssets` handles multiple assets in one GR (one journal per asset)
- Test credit account resolution from marketplace session → owner credit card COA
- Test fallback behavior when marketplace session or CC not found (graceful error or skip journal)

### Property-Based Tests

- Generate random asset costs and verify journal debit = credit = asset.cost for marketplace capitalization
- Generate random combinations of marketplace and AP assets and verify each uses the correct credit account
- Generate random depreciation scenarios and verify marketplace assets with `journal_id` populated are treated identically to AP assets in depreciation runs

### Integration Tests

- Full flow: Create marketplace PO → checkout → ship → GR confirm → verify asset is ACTIVE with journal
- Full flow: Marketplace asset capitalized → run depreciation → verify asset is included and depreciated correctly
- Mixed GR: Marketplace GR with both asset and inventory lines → verify only asset lines get capitalization journal
- Rollback scenario: Simulate journal posting failure → verify assets revert to DRAFT
