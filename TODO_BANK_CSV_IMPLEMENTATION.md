# TODO: Comprehensive Bank CSV Parser Implementation

## Task: Implement robust CSV parser untuk BCA Personal, BCA Bisnis, dan Bank Mandiri formats

---

## ✅ Step 1: Update Constants - Add Header Patterns
- [x] Add HEADER_MAPPING untuk BCA Personal, BCA Bisnis, Mandiri
- [x] Add COLUMN_INDEX_MAPPING untuk handle index-based parsing
- [x] Add AMOUNT_PATTERNS untuk handle embedded amounts
- [x] Add BANK_PARSING_CONFIG untuk format-specific parsing options

## ✅ Step 2: Update Types
- [x] Add CSVHeaderMapping interface
- [x] Add AmountParsingResult interface
- [x] Update CSVFormatDetectionResult dengan detectedColumns, columnIndexMapping, parsingConfig

## ✅ Step 3: Update Service - Enhanced Format Detection
- [x] Update detectCSVFormat() dengan content-based detection
- [x] Detect BCA Personal dari leading quote dan CR/DB column
- [x] Detect BCA Bisnis dari amount dengan indicator suffix
- [x] Add column count detection dan warnings

## ✅ Step 4: Update Service - Robust Column Mapping
- [x] Update buildColumnMapping() dengan better pattern matching
- [x] Use BANK_COLUMN_INDEX_MAPPING untuk fallback

## ✅ Step 5: Update Service - Enhanced BCA Personal Parser
- [x] Handle leading quote `'` di date column
- [x] Handle embedded amount di description field
- [x] Handle CR/DB indicator di column 4
- [x] Handle balance di column 5

## ✅ Step 6: Update Service - Enhanced BCA Business Parser
- [x] Handle quoted fields dengan embedded commas
- [x] Handle amount dengan "DB" / "CR" suffix
- [x] Handle description dengan reference numbers

## ✅ Step 7: Update Service - Enhanced Mandiri Parser
- [x] Handle Account No column di awal
- [x] Handle multiple date columns (Date, Val. Date)
- [x] Handle Transaction Code column
- [x] Handle double description columns
- [x] Handle Reference No dengan spaces

## ✅ Step 8: Add Helper Methods
- [x] parseAmountWithIndicator() - Parse "123,456.00 DB" format (inline)
- [x] extractAmountFromDescription() - Extract embedded amounts (inline)
- [x] cleanQuotePrefix() - Remove leading quotes (inline)

## ✅ Step 9: Testing
- [x] TypeScript compilation ✅
- [x] Build successful ✅

---

## Sample Data Analysis:

### BCA BISNIS:
Headers: Tanggal Transaksi, Keterangan, Cabang, Jumlah
Data: 01/01/2026, "TRSF E-BANKING...", "0000", "287,490.00 DB"
→ Expected columns: 5 (date, desc, branch, amount, balance?)

### BCA PRIBADI:
Headers: Date, Description, Branch, Amount, , Balance
Data: '02/01/2026, TRSF E-BANKING..., '0000, 72100000.00, DB, 20826599.94
→ Expected columns: 7 (date, desc, branch, amount, empty?, CR/DB, balance)

### MANDIRI CV:
Headers: Account No, Date, Val. Date, Transaction Code, Description, Description, Reference No., Debit, Credit
Data: 0060003911777, 01/01/26, 01/01/26, 6902, "DR 0000029511812...", "71831136319...", "", ".00", "453,684.00"
→ Expected columns: 9

---

## Files Modified:
1. ✅ `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.constants.ts`
2. ✅ `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.types.ts`
3. ✅ `backend/src/modules/reconciliation/bank-statement-import/bank-statement-import.service.ts`

## New Features:
- `BANK_COLUMN_INDEX_MAPPING` - Index-based column mapping untuk handle format variations
- `AMOUNT_PATTERNS` - Regex patterns untuk extract amounts dari berbagai format
- `BANK_PARSING_CONFIG` - Format-specific parsing configuration
- Enhanced format detection dengan content-based analysis
- Support untuk BCA Personal dengan leading quote
- Support untuk BCA Bisnis dengan quoted fields
- Support untuk Mandiri CV dengan banyak kolom

## Usage:
```typescript
// CSV files akan otomatis di-parse berdasarkan format
const result = await bankStatementImportService(repository).parseCSVFile(filePath)
console.log('Detected format:', result.formatDetection.format)
console.log('Total rows:', result.rows.length)
```

