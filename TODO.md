# Bank Statement Import Temp Data Error Fix - TODO

## Approved Plan Steps (3 Main Changes)

### ✅ 1. Service Layer: Status-based Fallback Logic
**File**: `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.service.ts`

**Status**: ✅ COMPLETED

**Changes**:
- `getImportSummary()`: Status-based logic + `data_source` field
- `retrieveTemporaryData()`: Graceful StorageUnknownError → `[]`
- `getImportPreview()`: Same fallback logic
- Added `logInfo`/`logWarn` for data source tracking

**Tasks**:
- [ ] Modify `getImportSummary()`: Check import.status first
  - COMPLETED/IMPORTING/FAILED → Use DB statements (new `getStatementsPreview()` helper)
  - PENDING/ANALYZED → Try temp data → Fallback to `analysis_data.preview`
- [ ] Create `getStatementsPreview(importId, limit=10)` helper method
- [ ] Update return type: Add `data_source: 'db' | 'temp' | 'analysis'`
- [ ] Test both ANALYZED and COMPLETED imports

**Expected Impact**: Detail page `/198` will work for COMPLETED imports

---

### ✅ 2. Graceful Error Handling
**File**: `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.service.ts`

**Status**: [ ] Not Started

**Tasks**:
- [ ] Wrap `retrieveTemporaryData()`: Catch StorageUnknownError → return `[]`
- [ ] Log data source used: `logInfo('Summary using DB data', {importId, status})`
- [ ] Update `getImportPreview()`: Same status-based logic as summary

**Expected Impact**: No more crashes, always returns data

---

### ✅ 3. Reliable Temp Data Cleanup
**File**: `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.repository.ts`

**Status**: ✅ COMPLETED

**Changes**:
- `removeTemporaryData()`: 3x retry + exponential backoff
- Returns `boolean` success flag
- Comprehensive logging (success/failure per attempt)
- Non-blocking (never throws)

**Tasks**:
- [ ] Strengthen `removeTemporaryData()`: 3x retry + log success/failure
- [ ] Call cleanup in `processImport()` completion (already there, make robust)
- [ ] Add `temp_file_cleanup: boolean` field to import record on completion

**Expected Impact**: Prevents future temp file leaks

---

## Testing Steps (After All Changes)
```
1. npm run dev (backend)
2. Visit http://localhost:5173/bank-statement-import/198 → ✅ No crash
3. Upload new CSV → ANALYZED → View detail → ✅ Shows preview from temp
4. Confirm import → COMPLETED → View detail → ✅ Shows DB statements
5. Check logs: 'Summary using DB data' for completed imports
```

## Completion Criteria
- [ ] Import #198 detail page loads without StorageUnknownError
- [ ] New imports: ANALYZED shows temp preview, COMPLETED shows DB preview
- [ ] No regressions in upload/confirm flow
- [ ] Logs show proper data_source usage

**Next**: Mark steps as completed → `attempt_completion`

