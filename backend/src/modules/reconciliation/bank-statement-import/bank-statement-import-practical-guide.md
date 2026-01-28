# 🎯 Bank Statement Import - Practical Examples & Quick Reference

## 📋 Table of Contents

1. [Quick Start Guide](#quick-start-guide)
2. [Common Code Snippets](#common-code-snippets)
3. [Excel File Examples](#excel-file-examples)
4. [API Usage Examples](#api-usage-examples)
5. [Troubleshooting Guide](#troubleshooting-guide)
6. [Performance Optimization](#performance-optimization)
7. [Common Scenarios](#common-scenarios)

---

## 1. Quick Start Guide

### Installation & Setup

```bash
# Install dependencies
npm install xlsx multer crypto zod

# Run migrations
npm run migrate

# Start the application
npm run dev
```

### Minimum Viable Implementation

```typescript
// index.ts - Module entry point
import { Pool } from 'pg';
import { BankStatementImportRepository } from './bank-statement-import.repository';
import { BankStatementImportService } from './bank-statement-import.service';
import { BankStatementImportController } from './bank-statement-import.controller';
import { createBankStatementImportRoutes } from './bank-statement-import.routes';
import { JobsService } from '../jobs/jobs.service';
import { Logger } from '../../utils/logger';

export function setupBankStatementImport(pool: Pool, jobsService: JobsService) {
  const logger = new Logger('BankStatementImport');
  const repository = new BankStatementImportRepository(pool);
  const service = new BankStatementImportService(repository, jobsService, logger);
  const controller = new BankStatementImportController(service, logger);
  const routes = createBankStatementImportRoutes(controller);

  return { repository, service, controller, routes };
}
```

---

## 2. Common Code Snippets

### Upload File from Frontend

```typescript
// React/Next.js example
const uploadBankStatement = async (file: File, bankAccountId: number) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bank_account_id', bankAccountId.toString());

  const response = await fetch('/api/v1/bank-statement-imports/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  return response.json();
};

// Usage
const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const result = await uploadBankStatement(file, bankAccountId);
    console.log('Analysis:', result.data.analysis);
    // Show preview to user
  } catch (error) {
    console.error('Upload failed:', error);
  }
};
```

### Confirm Import with Options

```typescript
const confirmImport = async (importId: number, options = {}) => {
  const response = await fetch(
    `/api/v1/bank-statement-imports/${importId}/confirm`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        skip_duplicates: options.skipDuplicates ?? false,
        dry_run: options.dryRun ?? false,
      }),
    }
  );

  return response.json();
};
```

### Poll Import Status

```typescript
const pollImportStatus = async (importId: number, onProgress: (status: any) => void) => {
  const poll = async () => {
    const response = await fetch(`/api/v1/bank-statement-imports/${importId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    const data = await response.json();
    onProgress(data.data);

    if (data.data.status === 'IMPORTING') {
      setTimeout(poll, 2000); // Poll every 2 seconds
    }
  };

  await poll();
};

// Usage
await pollImportStatus(importId, (status) => {
  console.log(`Progress: ${status.processed_rows}/${status.total_rows}`);
  if (status.status === 'COMPLETED') {
    console.log('Import completed!');
  }
});
```

### Custom Excel Column Mapping

```typescript
// If you need to support custom column mappings
interface CustomColumnMapping {
  [excelColumn: string]: string; // Maps Excel column to our field
}

const customMapping: CustomColumnMapping = {
  'TGL': 'transaction_date',
  'JAM': 'transaction_time',
  'NO REF': 'reference_number',
  'KETERANGAN': 'description',
  'DEBET': 'debit_amount',
  'KREDIT': 'credit_amount',
  'SALDO': 'balance',
};

// Apply custom mapping during parsing
const applyCustomMapping = (row: any, mapping: CustomColumnMapping) => {
  const mapped: any = {};
  
  Object.entries(mapping).forEach(([excelCol, ourField]) => {
    if (row[excelCol] !== undefined) {
      mapped[ourField] = row[excelCol];
    }
  });
  
  return mapped;
};
```

---

## 3. Excel File Examples

### Standard Format (BCA)

```
| Tanggal    | Jam      | Referensi | Keterangan                    | Debit      | Kredit     | Saldo       |
|------------|----------|-----------|-------------------------------|------------|------------|-------------|
| 15/01/2024 | 10:30:00 | TRX001    | SETORAN TUNAI                 | 0          | 5,000,000  | 15,000,000  |
| 15/01/2024 | 11:45:00 | TRX002    | BIAYA ADMIN                   | 5,000      | 0          | 14,995,000  |
| 16/01/2024 | 09:15:00 | TRX003    | TRANSFER KE 1234567890        | 1,000,000  | 0          | 13,995,000  |
```

### Alternative Format (Mandiri)

```
| Date       | Time     | Transaction Description        | Amount     | Balance    |
|------------|----------|--------------------------------|------------|------------|
| 2024-01-15 | 10:30    | Cash Deposit                   | 5,000,000  | 15,000,000 |
| 2024-01-15 | 11:45    | Admin Fee                      | -5,000     | 14,995,000 |
| 2024-01-16 | 09:15    | Transfer to 1234567890         | -1,000,000 | 13,995,000 |
```

### Generate Sample Excel Programmatically

```typescript
import * as XLSX from 'xlsx';

function generateSampleExcel(outputPath: string) {
  const data = [
    {
      'Tanggal': '2024-01-15',
      'Waktu': '10:30:00',
      'Referensi': 'TRX001',
      'Keterangan': 'Setoran Tunai',
      'Debit': 0,
      'Kredit': 5000000,
      'Saldo': 15000000,
    },
    {
      'Tanggal': '2024-01-15',
      'Waktu': '11:45:00',
      'Referensi': 'TRX002',
      'Keterangan': 'Biaya Admin',
      'Debit': 5000,
      'Kredit': 0,
      'Saldo': 14995000,
    },
    {
      'Tanggal': '2024-01-16',
      'Waktu': '09:15:00',
      'Referensi': 'TRX003',
      'Keterangan': 'Transfer ke 1234567890',
      'Debit': 1000000,
      'Kredit': 0,
      'Saldo': 13995000,
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Mutasi');
  
  XLSX.writeFile(workbook, outputPath);
}

// Generate sample
generateSampleExcel('sample-bank-statement.xlsx');
```

---

## 4. API Usage Examples

### Complete Import Flow

```typescript
async function completeImportFlow(file: File, bankAccountId: number) {
  try {
    // Step 1: Upload and analyze
    console.log('Step 1: Uploading file...');
    const uploadResult = await uploadBankStatement(file, bankAccountId);
    const { import: importRecord, analysis } = uploadResult.data;
    
    console.log(`File analyzed: ${analysis.total_rows} rows found`);
    console.log(`Valid: ${analysis.valid_rows}, Invalid: ${analysis.invalid_rows}`);
    console.log(`Duplicates: ${analysis.duplicates.length}`);

    // Step 2: Show preview to user (in UI)
    displayPreview(analysis.preview);

    // Step 3: Confirm import
    const userConfirmed = await askUserConfirmation(analysis);
    
    if (!userConfirmed) {
      console.log('Import cancelled by user');
      return;
    }

    console.log('Step 2: Starting import...');
    const confirmResult = await confirmImport(importRecord.id, {
      skipDuplicates: analysis.duplicates.length > 0,
    });

    console.log(`Job created: ${confirmResult.data.job_id}`);

    // Step 4: Poll for completion
    console.log('Step 3: Processing...');
    await pollImportStatus(importRecord.id, (status) => {
      const progress = (status.processed_rows / status.total_rows * 100).toFixed(1);
      console.log(`Progress: ${progress}% (${status.processed_rows}/${status.total_rows})`);
      
      if (status.status === 'COMPLETED') {
        console.log('✅ Import completed successfully!');
      } else if (status.status === 'FAILED') {
        console.error('❌ Import failed:', status.error_message);
      }
    });

  } catch (error) {
    console.error('Import flow failed:', error);
    throw error;
  }
}
```

### Batch Processing Multiple Files

```typescript
async function batchImportFiles(files: File[], bankAccountId: number) {
  const results = [];

  for (const file of files) {
    try {
      console.log(`Processing ${file.name}...`);
      const result = await uploadBankStatement(file, bankAccountId);
      
      // Auto-confirm if no duplicates
      if (result.data.analysis.duplicates.length === 0) {
        await confirmImport(result.data.import.id, { skipDuplicates: false });
        results.push({ file: file.name, status: 'queued' });
      } else {
        results.push({ 
          file: file.name, 
          status: 'requires_review',
          duplicates: result.data.analysis.duplicates.length,
        });
      }
    } catch (error) {
      results.push({ file: file.name, status: 'failed', error });
    }
  }

  return results;
}
```

### Export Import Results

```typescript
async function exportImportResults(importId: number) {
  const response = await fetch(
    `/api/v1/bank-statement-imports/${importId}/statements?limit=10000`,
    {
      headers: { 'Authorization': `Bearer ${token}` },
    }
  );

  const data = await response.json();
  const statements = data.data;

  // Convert to CSV
  const csv = convertToCSV(statements);
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-${importId}-results.csv`;
  a.click();
}

function convertToCSV(statements: any[]): string {
  const headers = [
    'Date',
    'Time',
    'Reference',
    'Description',
    'Debit',
    'Credit',
    'Balance',
  ];

  const rows = statements.map(s => [
    s.transaction_date,
    s.transaction_time || '',
    s.reference_number || '',
    s.description,
    s.debit_amount,
    s.credit_amount,
    s.balance || '',
  ]);

  return [
    headers.join(','),
    ...rows.map(r => r.join(',')),
  ].join('\n');
}
```

---

## 5. Troubleshooting Guide

### Common Issues & Solutions

#### Issue 1: "Missing required columns"

**Error:**
```json
{
  "error": {
    "code": "BS003",
    "message": "Missing required columns: transaction_date, description"
  }
}
```

**Solution:**
```typescript
// Check Excel headers - they must match one of these variations:
const acceptedHeaders = {
  transaction_date: ['tanggal', 'date', 'tgl'],
  description: ['keterangan', 'description', 'desc'],
  debit_amount: ['debit', 'debet', 'keluar'],
  credit_amount: ['kredit', 'credit', 'masuk'],
};

// Ensure your Excel file has at least these columns with matching names
```

#### Issue 2: "Invalid date format"

**Error:**
```json
{
  "error": {
    "code": "BS004",
    "details": {
      "row_number": 5,
      "value": "15-Jan-2024"
    }
  }
}
```

**Solution:**
```typescript
// Supported date formats:
// - YYYY-MM-DD (recommended)
// - DD/MM/YYYY
// - DD-MM-YYYY
// - Excel date serial numbers

// Fix in Excel:
// 1. Select date column
// 2. Format → Date → YYYY-MM-DD
// 3. Save and re-upload
```

#### Issue 3: "File already imported"

**Error:**
```json
{
  "error": {
    "code": "BS010",
    "message": "This file has already been imported (Import ID: 123)"
  }
}
```

**Solution:**
```typescript
// The system detects duplicate files using hash
// To force re-import:
// 1. Delete the previous import
// 2. Or modify the file slightly (add a comment cell)
// 3. Re-upload

// Check previous import:
const previousImport = await fetch(
  `/api/v1/bank-statement-imports/123`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);
```

#### Issue 4: Duplicate transactions detected

**Scenario:** Import shows 50 duplicates

**Solution:**
```typescript
// Option 1: Skip duplicates
await confirmImport(importId, { skipDuplicates: true });

// Option 2: Review duplicates manually
const { duplicates } = analysis;
duplicates.forEach(dup => {
  console.log(`Duplicate: ${dup.reference_number} - ${dup.transaction_date}`);
  console.log(`Existing Import: ${dup.existing_import_id}`);
  console.log(`Match Score: ${dup.match_score}%`);
});

// Option 3: Delete old import first
await deleteImport(dup.existing_import_id);
await confirmImport(importId, { skipDuplicates: false });
```

#### Issue 5: Job stuck in "IMPORTING"

**Symptoms:** Import status stays at "IMPORTING" for too long

**Diagnosis:**
```typescript
// Check job status
const job = await fetch(`/api/v1/jobs/${jobId}`, {
  headers: { 'Authorization': `Bearer ${token}` },
});

console.log(job.data.status); // Should show current status
console.log(job.data.error); // Check for errors
```

**Solution:**
```sql
-- Check job queue
SELECT * FROM jobs WHERE id = {job_id};

-- Check import status
SELECT * FROM bank_statement_imports WHERE id = {import_id};

-- If stuck, manually update (use with caution)
UPDATE bank_statement_imports 
SET status = 'FAILED', 
    error_message = 'Manually reset - investigate logs'
WHERE id = {import_id};
```

---

## 6. Performance Optimization

### Optimize Large File Imports

```typescript
// For files with 10k+ rows, use streaming
import { Transform } from 'stream';
import * as XLSX from 'xlsx';

class ExcelStreamProcessor extends Transform {
  private batch: any[] = [];
  private readonly batchSize = 1000;

  constructor(private readonly processor: (rows: any[]) => Promise<void>) {
    super({ objectMode: true });
  }

  async _transform(chunk: any, encoding: string, callback: Function) {
    this.batch.push(chunk);

    if (this.batch.length >= this.batchSize) {
      await this.processBatch();
    }

    callback();
  }

  async _flush(callback: Function) {
    if (this.batch.length > 0) {
      await this.processBatch();
    }
    callback();
  }

  private async processBatch() {
    await this.processor(this.batch);
    this.batch = [];
  }
}

// Usage
async function processLargeFile(filePath: string, importId: number) {
  const processor = new ExcelStreamProcessor(async (batch) => {
    // Process batch
    await repository.bulkInsertStatements(batch);
    await updateProgress(importId, batch.length);
  });

  // Stream through file
  const stream = XLSX.stream.to_json(filePath);
  stream.pipe(processor);
}
```

### Database Index Optimization

```sql
-- Add composite indexes for common queries
CREATE INDEX idx_bank_statements_lookup 
  ON bank_statements(company_id, bank_account_id, transaction_date DESC)
  INCLUDE (debit_amount, credit_amount, description)
  WHERE deleted_at IS NULL;

-- Index for duplicate detection
CREATE INDEX idx_bank_statements_duplicate_check
  ON bank_statements(bank_account_id, transaction_date, reference_number)
  WHERE deleted_at IS NULL AND reference_number IS NOT NULL;

-- Partial index for unreconciled statements
CREATE INDEX idx_bank_statements_unreconciled
  ON bank_statements(bank_account_id, transaction_date)
  WHERE is_reconciled = FALSE AND deleted_at IS NULL;
```

### Batch Size Tuning

```typescript
// Test different batch sizes for your database
const BATCH_SIZES = [500, 1000, 2000, 5000];

async function findOptimalBatchSize(statements: any[]) {
  for (const batchSize of BATCH_SIZES) {
    const startTime = Date.now();
    
    for (let i = 0; i < statements.length; i += batchSize) {
      const batch = statements.slice(i, i + batchSize);
      await repository.bulkInsertStatements(batch);
    }
    
    const duration = Date.now() - startTime;
    console.log(`Batch size ${batchSize}: ${duration}ms`);
  }
}
```

### Caching Strategy

```typescript
import { LRUCache } from 'lru-cache';

class BankStatementImportServiceWithCache extends BankStatementImportService {
  private importCache = new LRUCache<number, BankStatementImport>({
    max: 500,
    ttl: 1000 * 60 * 5, // 5 minutes
  });

  async getImportById(importId: number, companyId: string) {
    // Check cache first
    const cached = this.importCache.get(importId);
    if (cached && cached.company_id === companyId) {
      return cached;
    }

    // Fetch from database
    const importRecord = await super.getImportById(importId, companyId);
    
    if (importRecord) {
      this.importCache.set(importId, importRecord);
    }

    return importRecord;
  }
}
```

---

## 7. Common Scenarios

### Scenario 1: Monthly Bank Statement Import

```typescript
async function importMonthlyStatement(
  month: string, // "2024-01"
  bankAccountId: number
) {
  // Download statement from bank (implementation varies)
  const file = await downloadBankStatement(month);

  // Upload and process
  const result = await uploadBankStatement(file, bankAccountId);
  
  // Auto-confirm if date range matches
  const analysis = result.data.analysis;
  const expectedStart = `${month}-01`;
  const expectedEnd = `${month}-31`;

  if (
    analysis.date_range_start === expectedStart &&
    analysis.date_range_end <= expectedEnd &&
    analysis.duplicates.length === 0
  ) {
    await confirmImport(result.data.import.id, { skipDuplicates: false });
    console.log(`✅ ${month} statement imported automatically`);
  } else {
    console.log(`⚠️ ${month} statement requires manual review`);
  }
}
```

### Scenario 2: Reconciliation Integration

```typescript
async function reconcileImportedStatements(importId: number) {
  // Get all statements from import
  const statements = await fetchAllStatements(importId);

  // Match with POS transactions
  for (const statement of statements) {
    // Find matching POS transaction
    const matchingTransaction = await findMatchingPOSTransaction({
      date: statement.transaction_date,
      amount: statement.credit_amount || statement.debit_amount,
      reference: statement.reference_number,
    });

    if (matchingTransaction) {
      // Mark as reconciled
      await markAsReconciled(statement.id, matchingTransaction.id);
      console.log(`✅ Reconciled: ${statement.reference_number}`);
    } else {
      console.log(`⚠️ No match: ${statement.reference_number}`);
    }
  }
}
```

### Scenario 3: Multi-Branch Import

```typescript
async function importForMultipleBranches(
  file: File,
  branchMappings: Map<string, number> // description pattern -> bank_account_id
) {
  // Analyze file once
  const analysis = await analyzeFile(file);

  // Group statements by branch
  const statementsByBranch = new Map<number, any[]>();

  analysis.preview.forEach(row => {
    for (const [pattern, bankAccountId] of branchMappings) {
      if (row.description.includes(pattern)) {
        if (!statementsByBranch.has(bankAccountId)) {
          statementsByBranch.set(bankAccountId, []);
        }
        statementsByBranch.get(bankAccountId)!.push(row);
        break;
      }
    }
  });

  // Import for each branch
  for (const [bankAccountId, statements] of statementsByBranch) {
    const branchFile = createExcelForStatements(statements);
    await uploadBankStatement(branchFile, bankAccountId);
  }
}
```

---

## 📚 Additional Tools

### CLI Tool for Testing

```typescript
#!/usr/bin/env node
import { program } from 'commander';
import { readFileSync } from 'fs';

program
  .command('analyze <file>')
  .description('Analyze Excel file locally')
  .action(async (file) => {
    const parser = new ExcelParser();
    const { rows, mapping } = parser.parseExcelFile(file);
    
    console.log(`Total rows: ${rows.length}`);
    console.log(`Column mapping:`, mapping);
    console.log(`Preview:`, rows.slice(0, 5));
  });

program
  .command('upload <file> <bank-account-id>')
  .description('Upload file to API')
  .action(async (file, bankAccountId) => {
    const fileBuffer = readFileSync(file);
    // Upload to API...
  });

program.parse();
```

### Monitoring Dashboard Query

```sql
-- Import statistics
SELECT 
  DATE(created_at) as date,
  COUNT(*) as total_imports,
  SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed,
  SUM(total_rows) as total_rows_processed,
  AVG(processed_rows::float / NULLIF(total_rows, 0) * 100) as avg_success_rate
FROM bank_statement_imports
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

---

**End of Practical Guide**

This guide provides ready-to-use code snippets and solutions for common scenarios. Refer to the main implementation guide for architectural details.
