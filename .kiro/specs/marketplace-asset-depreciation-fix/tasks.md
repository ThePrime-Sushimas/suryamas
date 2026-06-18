# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Marketplace Asset Capitalization Missing Journal
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case: a marketplace GR with asset product lines is confirmed, then assert the activated asset has a posted journal entry with `journal_id` populated
  - Bug Condition from design: `isBugCondition(input)` where `input.grSource = 'MARKETPLACE' AND input.hasAssetLines = true AND input.assetStatus = 'DRAFT' AND NOT capitalizationJournalCreated(input.assetId)`
  - Test that when `capitalizeMarketplaceAssets()` is called for a marketplace GR with draft fixed assets:
    - Asset reaches ACTIVE status (this part passes on unfixed code)
    - A journal_headers record exists with `reference_type = 'fixed_asset'` and `reference_id = asset.id` (FAILS on unfixed code)
    - Asset's `journal_id` is NOT NULL (FAILS on unfixed code)
    - Journal has debit line for Fixed Asset COA (from category's `asset_coa_id`) with amount = `asset.cost`
    - Journal has credit line for CC COA (from `owner_credit_cards.coa_code` via marketplace session) with amount = `asset.cost`
    - Journal status = 'POSTED'
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists because no journal is created)
  - Document counterexamples found (e.g., "asset.journal_id is NULL after capitalizeMarketplaceAssets completes")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.3, 2.1, 2.4_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - AP-Flow Capitalization and Depreciation Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (AP-flow assets and depreciation):
    - Observe: `capitalizeAssetsFromInvoice()` creates journal with Dr Fixed Asset COA / Cr AP (210101) and populates `journal_id`
    - Observe: `findDepreciableAssets()` returns ACTIVE/MAINTENANCE assets with `(cost - salvage_value) > accumulated_depreciation` regardless of `journal_id`
    - Observe: `calculateMonthlyDepreciation()` produces correct straight-line amounts for all asset configurations
    - Observe: `activateAsset()` (manual activation) works without creating a journal entry
    - Observe: Fully depreciated assets are excluded from depreciation runs
    - Observe: DRAFT and DISPOSED assets are excluded from depreciation runs
  - Write property-based tests capturing observed behavior patterns:
    - For all AP-sourced assets: capitalization creates Dr Asset / Cr AP journal with amount = unit_price
    - For all ACTIVE/MAINTENANCE assets with remaining depreciable value > 0: included in depreciation
    - For all fully-depreciated assets: excluded from depreciation regardless of source
    - For all DRAFT/DISPOSED assets: excluded from depreciation regardless of source
    - Manual activation continues to work without journal creation
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix marketplace asset capitalization to create journal entries

  - [ ] 3.1 Add repository helper `findMarketplaceCcCoaCode`
    - Add to `fixed-assets.repository.ts`
    - Query: resolve CC COA code from `marketplace_checkout_sessions` → `owner_credit_cards` by session_number and company_id
    - SQL: `SELECT occ.coa_code FROM marketplace_checkout_sessions mcs JOIN owner_credit_cards occ ON occ.id = mcs.cc_id AND occ.company_id = mcs.company_id WHERE mcs.session_number = $1 AND mcs.company_id = $2 AND mcs.deleted_at IS NULL`
    - Return the COA code string or null if not found
    - _Requirements: 2.1_

  - [ ] 3.2 Refactor `capitalizeMarketplaceAssets()` into two phases
    - **Phase 1** (inside GR transaction - existing behavior): Activate assets + create movements, return work items array containing asset details and category COA info
    - Change return type from `Promise<void>` to return the work items for Phase 2
    - Collect `categoryAssetCoaId` from each asset's category during Phase 1
    - _Bug_Condition: isBugCondition(input) where input.grSource = 'MARKETPLACE' AND input.hasAssetLines = true_
    - _Expected_Behavior: Phase 1 returns work items for journal creation in Phase 2_
    - _Preservation: Phase 1 behavior (activate + movement) is unchanged_
    - _Requirements: 2.1, 2.4_

  - [ ] 3.3 Add Phase 2 journal creation to `capitalizeMarketplaceAssets()`
    - **Phase 2** (outside GR transaction): For each work item, create and post capitalization journal
    - Resolve CC COA using `findMarketplaceCcCoaCode(client, companyId, sessionNumber)`
    - Create journal per asset: Dr `category.asset_coa_id` / Cr CC COA, amount = `asset.cost`
    - Journal description: `Kapitalisasi Aset Marketplace {asset_code} - {asset_name}`
    - Journal metadata: `source_module: 'fixed_assets'`, `reference_type: 'fixed_asset'`, `reference_id: asset.id`
    - After successful posting, call `repository.updateJournalId(asset.id, journalId)`
    - On failure: revert all previously capitalized assets back to DRAFT (same rollback pattern as `capitalizeAssetsFromInvoice`)
    - **NOTE (Code Review Issue #2)**: Move `AuditService.log` calls to Phase 2 (after GR transaction commits). Currently `AuditService.log` in the `capitalizeMarketplaceAssets` loop uses a pool connection (no client passed), so if the GR transaction rolls back, orphaned audit logs remain. By placing audit logging in Phase 2, it only executes after the GR transaction has successfully committed.
    - _Bug_Condition: isBugCondition(input) where capitalizeMarketplaceAssets previously left journal_id = NULL_
    - _Expected_Behavior: expectedBehavior(result) → result.journal_id IS NOT NULL AND journal is POSTED with correct Dr/Cr_
    - _Preservation: AP-flow capitalization and existing marketplace-po journal flows unchanged_
    - _Requirements: 2.1, 2.4, 3.1, 3.5_

  - [ ] 3.4 Update GR confirmation to split marketplace capitalization into two phases
    - In `goods-receipts.service.ts` `confirm()` method:
    - Pass additional context: GR's `invoice_number` (= marketplace session's `session_number`) to `capitalizeMarketplaceAssets`
    - Phase 1 call remains inside the GR transaction (activate + movement)
    - Phase 2 call (journal creation) happens AFTER the GR transaction commits
    - This ensures GR confirmation is not rolled back if journal posting fails
    - _Bug_Condition: The GR confirm flow previously only ran Phase 1 with no journal creation_
    - _Expected_Behavior: GR confirm now triggers both activation AND journal posting for marketplace assets_
    - _Preservation: Non-marketplace GR confirmation flow is unchanged_
    - _Requirements: 2.1, 2.4, 3.1_

  - [ ] 3.5 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Marketplace Asset Capitalization Creates Journal
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied:
      - Asset is ACTIVE with `journal_id` populated
      - Journal has Dr Fixed Asset COA / Cr CC COA with amount = asset.cost
      - Journal status = POSTED
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.4_

  - [ ] 3.6 Verify preservation tests still pass
    - **Property 2: Preservation** - AP-Flow and Depreciation Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions to AP-flow, depreciation, or manual activation)

- [ ] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to verify no regressions
  - Verify exploration test (Property 1) passes — marketplace assets now get journals
  - Verify preservation tests (Property 2) pass — AP flow, depreciation, manual activation unchanged
  - Ensure all tests pass, ask the user if questions arise

- [ ] 5. Fix `activateAsset` race condition (Code Review Issue #1)
  - **File**: `backend/src/modules/fixed-assets/fixed-assets.repository.ts`
  - **Problem**: `activateAsset()` does not check `rowCount` after UPDATE. If concurrent requests occur, one silently does nothing.
  - **Fix**: Capture the query result and check `result.rowCount === 0`
  - If no rows were updated, throw `FixedAssetNotFoundError(id)` or a descriptive error indicating the asset is no longer in DRAFT status (e.g., already activated or deleted)
  - Update function return type or add error throw after the UPDATE query
  - Example implementation:
    ```typescript
    const result = await db.query(...)
    if (result.rowCount === 0) {
      throw new FixedAssetNotFoundError(id)
    }
    ```
  - Verify existing callers handle the potential error gracefully
  - _Requirements: 2.1_

- [ ] 6. Fix frontend `handleActivate` generic error message (Code Review Issue #4)
  - **File**: `frontend/src/features/fixed-assets/pages/FixedAssetDetailPage.tsx`
  - **Problem**: Catch block uses `toast.error('Gagal mengaktifkan aset')` regardless of the actual backend error message
  - **Fix**: Extract error message from Axios response or Error object:
    ```typescript
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      const msg = axiosErr.response?.data?.error
        || (err instanceof Error ? err.message : 'Gagal mengaktifkan aset')
      toast.error(msg)
    }
    ```
  - Check `err.response?.data?.error` first (Axios error with backend message), then fallback to `err.message`, then to the generic string
  - This ensures users see meaningful error messages (e.g., "Asset is no longer in DRAFT status")

- [ ] 7. Add trailing newline to `FixedAssetDetailPage.tsx` (Code Review Issue #5)
  - **File**: `frontend/src/features/fixed-assets/pages/FixedAssetDetailPage.tsx`
  - **Fix**: Ensure file ends with a newline character (`\n`)
  - This is a code style fix to comply with POSIX standards and avoid diff noise

- [ ] 8. Use `ValidationError` instead of generic `Error` in `products.service.ts` (Code Review Issue #6)
  - **File**: `backend/src/modules/products/products.service.ts` (lines ~86 and ~151)
  - **Problem**: `throw new Error('asset_category_id is required when is_asset is true')` returns HTTP 500 instead of 400
  - **Fix**:
    - Import `ValidationError` from `../../utils/errors.base`
    - Replace both occurrences of `throw new Error('asset_category_id is required when is_asset is true')` with:
      ```typescript
      throw new ValidationError('asset_category_id is required when is_asset is true')
      ```
    - This ensures the error handler returns HTTP 400 (Bad Request) instead of 500 (Internal Server Error)
  - Two locations to update:
    1. In `create()` method: validation check for `is_asset && !asset_category_id`
    2. In `update()` method: validation check for `willBeAsset && !willHaveCategory`
