/**
 * Bank Statement Import Service
 * Handles business logic untuk bank statement import operations
 */

import { logInfo, logError, logWarn } from "../../../config/logger";
import { BankStatementImportRepository } from "./bank-statement-import.repository";
import {
  BankStatementImport,
  BankStatement,
  CreateBankStatementImportDto,
  BankStatementAnalysis,
  BankStatementImportStatus,
  BankStatementImportFilterParams,
  UploadAnalysisResult,
  ConfirmImportResult,
  BankStatementPreviewRow,
  BankStatementDuplicate,
  BankStatementColumnMapping,
  CSVFormatDetectionResult,
  ParsedCSVRow,
  BankCSVFormat,
} from "./bank-statement-import.types";
import {
  BankStatementImportErrors,
  BankStatementImportConfig,
} from "./bank-statement-import.errors";
import {
  IMPORT_STATUS,
  BANK_CSV_FORMAT,
  BANK_CSV_FORMATS,
  BANK_HEADER_PATTERNS,
  BANK_COLUMN_INDEX_MAPPING,
  AMOUNT_PATTERNS,
  BANK_PARSING_CONFIG,
  PENDING_TRANSACTION,
} from "./bank-statement-import.constants";
import { AuditService } from "../../monitoring/monitoring.service";
import * as XLSX from "xlsx";
import fs from "fs/promises";
import path from "path";

// Pagination interface
interface PaginationParams {
  page: number;
  limit: number;
}

// Sort interface
interface SortParams {
  field: string;
  order: "asc" | "desc";
}

// Paginated response interface
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// File upload interface
interface FileUploadResult {
  file_name: string;
  file_size: number;
  file_path: string;
  file_hash: string;
  mime_type: string;
}

// Parsed row from Excel
interface ParsedRow {
  row_number: number;
  transaction_date: string;
  transaction_time?: string;
  reference_number?: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  balance?: number;
  raw_data: Record<string, any>;
  is_pending?: boolean;
  transaction_type?: string;
}

export class BankStatementImportService {
  private readonly TEMP_DIR = "/tmp/bank-imports";

  constructor(private readonly repository: BankStatementImportRepository) {
    this.ensureTempDir();
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.TEMP_DIR, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  /**
   * Analyze uploaded file - parse, validate, and generate preview
   */
  async analyzeFile(
    fileResult: FileUploadResult,
    bankAccountId: number,
    companyId: string,
    userId?: string,
  ): Promise<UploadAnalysisResult> {
    logInfo("BankStatementImport: Starting file analysis", {
      file_name: fileResult.file_name,
      bank_account_id: bankAccountId,
      company_id: companyId,
    });

    try {
      // Check for duplicate file - first check active records
      const activeImport = await this.repository.checkFileHashExists(
        fileResult.file_hash,
        companyId,
      );

      if (activeImport) {
        // File exists and is active - throw duplicate error
        throw BankStatementImportErrors.DUPLICATE_FILE(fileResult.file_name);
      }

      // Check if file exists but was deleted (for re-upload)
      const existingImport =
        await this.repository.checkFileHashExistsIncludingDeleted(
          fileResult.file_hash,
          companyId,
        );

      if (existingImport && existingImport.deleted_at !== null) {
        logInfo("BankStatementImport: Re-uploading previously deleted file", {
          file_hash: fileResult.file_hash,
          previous_import_id: existingImport.id,
        });

        // Hard delete the old record to allow new upload
        await this.repository.hardDelete(existingImport.id)

        logInfo(
          "BankStatementImport: Successfully deleted old import, allowing new upload",
          {
            previous_import_id: existingImport.id,
          },
        );
      }

      // Check file extension and parse accordingly
      const isCSV = fileResult.file_name.toLowerCase().endsWith(".csv");
      let rows: any[];
      let columnMapping: BankStatementColumnMapping;

      if (isCSV) {
        // Parse CSV file with format detection
        logInfo("BankStatementImport: Parsing CSV file", {
          file_name: fileResult.file_name,
        });
        const csvResult = await this.parseCSVFile(fileResult.file_path);
        rows = csvResult.rows.map((row) => ({
          row_number: row.row_number,
          transaction_date: row.transaction_date,
          transaction_time: row.transaction_time,
          reference_number: row.reference_number,
          description: row.description,
          debit_amount: row.debit_amount,
          credit_amount: row.credit_amount,
          balance: row.balance,
          raw_data: row.raw_data,
          is_pending: row.is_pending,
        }));
        columnMapping = csvResult.formatDetection.columnMapping;

        logInfo("BankStatementImport: CSV parsed successfully", {
          format: csvResult.formatDetection.format,
          total_rows: rows.length,
        });
      } else {
        // Parse Excel file
        const excelResult = await this.parseExcelFile(fileResult.file_path);
        rows = excelResult.rows;
        columnMapping = excelResult.columnMapping;
      }

      if (rows.length === 0) {
        throw BankStatementImportErrors.EMPTY_FILE();
      }

      // Validate and transform rows
      const { validRows, invalidRows, validationErrors } =
        await this.validateRows(rows, companyId, bankAccountId);

      // Calculate date range FIRST for overlap check
      const dates = validRows.map((r) => new Date(r.transaction_date));
      const dateRangeStart = dates.length > 0 
        ? new Date(Math.min(...dates.map((d) => d.getTime()))).toISOString().split("T")[0]
        : null;
      const dateRangeEnd = dates.length > 0 
        ? new Date(Math.max(...dates.map((d) => d.getTime()))).toISOString().split("T")[0]
        : null;

      // ✅ OVERLAP WARNING: Alert user about existing data
      let overlapWarning = '';
      if (dateRangeStart && dateRangeEnd) {
        try {
          const count = await this.repository.countExistingStatements(
            companyId,
            bankAccountId,
            dateRangeStart,
            dateRangeEnd,
          )
          if (count > 0) {
            overlapWarning = `⚠️ Found ${count} existing statements (${dateRangeStart} to ${dateRangeEnd}). Duplicates will be filtered if skip_duplicates=true.`
          }
        } catch (error: any) {
          logError("BankStatementImport: Failed to count overlap statements", {
            company_id: companyId,
            bank_account_id: bankAccountId,
            date_range_start: dateRangeStart,
            date_range_end: dateRangeEnd,
            error: error?.message || String(error),
          });
        }
      }

// ✅ FIXED: Single analysis declaration + proper typing
      const analysis: BankStatementAnalysis = {
        total_rows: rows.length,
        valid_rows: validRows.length,
        invalid_rows: invalidRows.length,
        date_range_start: dateRangeStart || '',
        date_range_end: dateRangeEnd || '',
        preview: this.generatePreview(validRows, 10),
        duplicates: [],
        duplicate_count: 0,
        column_mapping: columnMapping,
        errors: validationErrors,
        warnings: [],
      };

      logInfo("Checking for duplicates against database...", {
        valid_rows: validRows.length,
        company_id: companyId,
        bank_account_id: bankAccountId,
      });

      // Check for duplicates against existing database records
      const existingDuplicates = await this.detectDuplicates(
        validRows,
        companyId,
        bankAccountId,
      );

      // Remove intra-file check per user request - focus DB vs import only
      const duplicates = [...existingDuplicates];

      // Populate analysis with duplicates
      analysis.duplicates = duplicates;
      analysis.duplicate_count = duplicates.length;

      // ✅ FIXED: Safe warnings push
      if (overlapWarning) {
        analysis.warnings = analysis.warnings || [];
        analysis.warnings.push(overlapWarning);
      }

// ✅ Date range (post-overlap check - simplified since calculated above)
      const simplifiedDateRangeStart = dateRangeStart || '';
      const simplifiedDateRangeEnd = dateRangeEnd || '';

      // Generate preview
      // Create import record  
      const createDto: CreateBankStatementImportDto = {
        company_id: companyId,
        bank_account_id: bankAccountId,
        file_name: fileResult.file_name,
        file_size: fileResult.file_size,
        file_hash: fileResult.file_hash,
        created_by: userId,
      };

      const importRecord = await this.repository.create(createDto);

      if (!importRecord) {
        throw BankStatementImportErrors.CREATE_FAILED();
      }

      // ✅ FIXED: Use the existing analysis object (no duplicate declaration)
      analysis.warnings = this.generateWarnings(duplicates, invalidRows);

      // Update import with analysis data
      await this.repository.update(importRecord.id, {
        status: IMPORT_STATUS.ANALYZED,
        total_rows: rows.length,
        date_range_start: simplifiedDateRangeStart || undefined,
        date_range_end: simplifiedDateRangeEnd || undefined,
        analysis_data: {
          preview: analysis.preview,
          duplicates: analysis.duplicates,
          duplicate_count: analysis.duplicate_count,
          invalid_count: invalidRows.length,
          column_mapping: columnMapping,
          date_range: {
            start: simplifiedDateRangeStart,
            end: simplifiedDateRangeEnd,
          },
          warnings: analysis.warnings || [],
          analyzed_at: new Date().toISOString(),
        } as any,
      });

      // Store parsed data in Supabase Storage for later processing
      await this.storeTemporaryData(importRecord.id, rows);

      logInfo("BankStatementImport: File analysis completed", {
        import_id: importRecord.id,
        total_rows: rows.length,
        valid_rows: validRows.length,
        duplicates: duplicates.length,
      });

      // Audit log for file analysis
      await AuditService.log(
        "CREATE",
        "bank_statement_import",
        String(importRecord.id),
        userId || null,
        null,
        {
          file_name: importRecord.file_name,
          status: IMPORT_STATUS.ANALYZED,
          total_rows: rows.length,
          valid_rows: validRows.length,
          duplicate_count: duplicates.length,
        },
      );

      return {
        import: importRecord,
        analysis,
      };
    } catch (error: any) {
      logError("BankStatementImport: File analysis failed", {
        error: error.message,
        file_name: fileResult.file_name,
      });
      throw error;
    }
  }

  /**
   * Confirm import and create job for async processing
   */
  async confirmImport(
    importId: number,
    companyId: string,
    skipDuplicates: boolean,
    userId?: string,
  ): Promise<ConfirmImportResult> {
    logInfo("BankStatementImport: Confirming import", {
      import_id: importId,
      skip_duplicates: skipDuplicates,
    });

    const importRecord = await this.repository.findById(importId);

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId);
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId);
    }

    if (importRecord.status !== IMPORT_STATUS.ANALYZED) {
      throw BankStatementImportErrors.INVALID_STATUS_TRANSITION(
        importRecord.status,
        IMPORT_STATUS.IMPORTING,
      );
    }

    // Create job
    const jobId = await this.repository.createImportJob({
      importId,
      fileName: importRecord.file_name,
      bankAccountId: importRecord.bank_account_id,
      companyId,
      skipDuplicates,
      totalRows: importRecord.total_rows,
      userId,
    })

    // Update import status and job_id
    await this.repository.update(importId, {
      status: IMPORT_STATUS.IMPORTING,
      job_id: String(jobId),
    });

    logInfo("BankStatementImport: Job created", {
      import_id: importId,
      job_id: jobId,
    });

    // Audit log for confirmation
    await AuditService.log(
      "UPDATE",
      "bank_statement_import",
      String(importId),
      userId || null,
      { status: importRecord.status },
      { status: IMPORT_STATUS.IMPORTING, job_id: String(jobId) },
    );

    return {
      import: importRecord,
      job_id: String(jobId),
    };
  }

  /**
   * Process import (called by job worker)
   */
  async processImport(
    jobId: string,
    importId: number,
    companyId: string,
    skipDuplicates: boolean,
  ): Promise<{ processed_count: number }> {
    logInfo("BankStatementImport: Starting import processing", {
      job_id: jobId,
      import_id: importId,
    });

    const importRecord = await this.repository.findById(importId);

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId);
    }

    // Retrieve temporary data
    const rows = await this.retrieveTemporaryData(importId);

    // Validate rows
    const { validRows, invalidRows } = await this.validateRows(
      rows,
      companyId,
      importRecord.bank_account_id,
      importId,
    );

    let rowsToInsert = validRows;

    // STEP 1: Delete/handle PEND records before duplicate detection
    const allSettledRows = validRows.filter((r: any) => !r.is_pending);
    let handledSettledKeys = new Set<string>();

    if (allSettledRows.length > 0) {
      const dates = allSettledRows.map((r: any) => new Date(r.transaction_date));
      const dateRangeStart = dates.length > 0 
        ? new Date(Math.min(...dates.map((d: any) => d.getTime()))).toISOString().split("T")[0]
        : null;
      const dateRangeEnd = dates.length > 0 
        ? new Date(Math.max(...dates.map((d: any) => d.getTime()))).toISOString().split("T")[0]
        : null;

      if (dateRangeStart && dateRangeEnd) {
        const pendingInDb = await this.repository.findPendingByDateRange(
          companyId,
          importRecord.bank_account_id,
          dateRangeStart,
          dateRangeEnd
        );

        if (pendingInDb.length > 0) {
          const result = await this.repository.replacePendingWithSettled(
            companyId,
            importRecord.bank_account_id,
            allSettledRows.map((r: any) => ({
              transaction_date: r.transaction_date,
              transaction_time: r.transaction_time,
              reference_number: r.reference_number,
              description: r.description || '',
              debit_amount: r.debit_amount || 0,
              credit_amount: r.credit_amount || 0,
              balance: r.balance,
              company_id: r.company_id,
              bank_account_id: r.bank_account_id,
              import_id: r.import_id,
              row_number: r.row_number,
              source_file: r.source_file,
            }))
          );

          handledSettledKeys = result.handledSettledKeys;

          if (result.replacedCount > 0) {
            logInfo('BankStatementImport: Replaced PEND records with settled', {
              import_id: importId,
              replaced_count: result.replacedCount,
              kasus_b_count: handledSettledKeys.size,
            });
          }
        }
      }
    }

    // STEP 2: Detect duplicates AFTER PEND cleanup
    const existingDuplicates = await this.detectDuplicates(
      validRows,
      companyId,
      importRecord.bank_account_id,
    );

    if (existingDuplicates.length > 0) {
      // Build duplicate lookup keys
      const normalizeDesc = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

      // Key 1 (PRIMARY): balance — unique per row in bank statement
      const duplicateBalanceKeys = new Set(
        existingDuplicates
          .filter((d: any) => d.balance != null && Number(d.balance) !== 0)
          .map((d: any) => Number(d.balance).toFixed(2)),
      );
      // Key 2: description + amount (fallback for rows without balance)
      const duplicateDescKeys = new Set(
        existingDuplicates.map(
          (d) => `${normalizeDesc((d as any).description || '')}-${d.debit_amount}-${d.credit_amount}`,
        ),
      );
      // Key 3: date + amount (general fallback)
      const duplicateDateKeys = new Set(
        existingDuplicates.map(
          (d) => `${d.transaction_date}-${d.debit_amount}-${d.credit_amount}`,
        ),
      );

      // ALWAYS filter duplicates
      rowsToInsert = validRows.filter((r) => {
        // Balance check first
        if (r.balance != null && Number(r.balance) !== 0) {
          if (duplicateBalanceKeys.has(Number(r.balance).toFixed(2))) return false;
        }
        const descKey = `${normalizeDesc(r.description || '')}-${r.debit_amount}-${r.credit_amount}`;
        if (duplicateDescKeys.has(descKey)) return false;
        const dateKey = `${r.transaction_date}-${r.debit_amount}-${r.credit_amount}`;
        if (duplicateDateKeys.has(dateKey)) return false;
        return true;
      });

      logInfo("BankStatementImport: Duplicates filtered", {
        import_id: importId,
        original_count: validRows.length,
        after_filter: rowsToInsert.length,
        skipped: validRows.length - rowsToInsert.length,
        existing_duplicates: existingDuplicates.length,
        skip_duplicates_flag: skipDuplicates,
      });
    }

    // STEP 3: Exclude Kasus B rows (already inserted by replacePendingWithSettled)
    if (handledSettledKeys.size > 0) {
      rowsToInsert = rowsToInsert.filter((r: any) => {
        const key = `${r.transaction_date}-${r.debit_amount}-${r.credit_amount}`;
        return !handledSettledKeys.has(key);
      });
    }

    // Bulk insert in batches
    const batchSize = BankStatementImportConfig.BATCH_SIZE;
    let processedCount = 0;

    for (let i = 0; i < rowsToInsert.length; i += batchSize) {
      const batch = rowsToInsert.slice(i, i + batchSize);

      const insertedCount = await this.repository.bulkInsert(batch);
      processedCount += insertedCount;

      // Update progress
      await this.repository.updateProgress(
        importId,
        processedCount,
        invalidRows.length,
      );

      // Update job progress
      await this.repository.updateJobProgress(jobId, {
        processed_rows: processedCount,
        total_rows: rowsToInsert.length,
        percentage: Math.round((processedCount / rowsToInsert.length) * 100),
      })

      logInfo("BankStatementImport: Batch processed", {
        import_id: importId,
        batch_number: Math.ceil(i / batchSize) + 1,
        processed: processedCount,
        total: rowsToInsert.length,
      });
    }

    // Update import to completed
    await this.repository.update(importId, {
      status: IMPORT_STATUS.COMPLETED,
      processed_rows: processedCount,
      failed_rows: invalidRows.length,
    });

    // Cleanup stale PEND records (non-critical, fire and forget)
    this.repository.cleanupStalePendingRecords(3).then((cleaned) => {
      if (cleaned > 0) {
        logInfo('BankStatementImport: Cleaned up stale PEND records', { cleaned })
      }
    }).catch(() => {
      // Non-critical, ignore error
    })

    // Clean up temporary data
    await this.cleanupTemporaryData(importId);

    logInfo("BankStatementImport: Processing completed", {
      import_id: importId,
      processed_count: processedCount,
      failed_count: invalidRows.length,
    });

    // Audit log for processing completion
    await AuditService.log(
      "UPDATE",
      "bank_statement_import",
      String(importId),
      null,
      { status: IMPORT_STATUS.IMPORTING },
      {
        status: IMPORT_STATUS.COMPLETED,
        processed_rows: processedCount,
        failed_rows: invalidRows.length,
      },
    );

    return { processed_count: processedCount };
  }

  /**
   * List imports with pagination
   */
  async listImports(
    companyId: string,
    pagination: PaginationParams,
    _sort: SortParams,
    filter?: BankStatementImportFilterParams,
  ): Promise<PaginatedResponse<BankStatementImport>> {
    const result = await this.repository.findAll(companyId, pagination, filter);

    const totalPages = Math.ceil(result.total / pagination.limit);

    return {
      data: result.data,
      total: result.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      hasNext: pagination.page * pagination.limit < result.total,
      hasPrev: pagination.page > 1,
    };
  }

  /**
   * Get import by ID
   */
  async getImportById(
    importId: number,
    companyId: string,
  ): Promise<BankStatementImport | null> {
    const importRecord = await this.repository.findById(importId);

    if (!importRecord) {
      return null;
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId);
    }

    return importRecord;
  }

  /**
   * Get statements for an import
   */
  async getImportStatements(
    importId: number,
    companyId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResponse<BankStatement>> {
    const importRecord = await this.repository.findById(importId);

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId);
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId);
    }

    const result = await this.repository.findByImportId(importId, pagination);
    const totalPages = Math.ceil(result.total / pagination.limit);

    return {
      data: result.data,
      total: result.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      hasNext: pagination.page * pagination.limit < result.total,
      hasPrev: pagination.page > 1,
    };
  }

  /**
   * Get import summary with status-based data source selection
   * - COMPLETED/IMPORTING/FAILED: Use DB statements (primary)
   * - ANALYZED/PENDING: Use temp storage or analysis_data
   */
  async getImportSummary(
    importId: number,
    companyId: string,
  ): Promise<{
    import: BankStatementImport;
    summary: {
      total_statements: number;
      total_credit: number;
      total_debit: number;
      reconciled_count: number;
      duplicate_count: number;
      preview?: BankStatementPreviewRow[];
    } & { data_source: 'db' | 'temp' | 'analysis' };
  }> {
    const importRecord = await this.getImportById(importId, companyId);

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId);
    }

    const summary = await this.repository.getSummaryByImportId(importId);

    // Status-based data source selection
    let duplicateCount = 0;
    let preview: BankStatementPreviewRow[] | undefined;
    let dataSource: 'db' | 'temp' | 'analysis' = 'db';

    const completedStatuses = ['COMPLETED', 'IMPORTING', 'FAILED'] as const;
    const analyzedStatuses = ['PENDING', 'ANALYZED'] as const;

    if (completedStatuses.includes(importRecord.status as any)) {
      // Primary: Use DB statements for completed imports
      dataSource = 'db';
      const statementsResult = await this.repository.findByImportId(
        importId,
        { page: 1, limit: 10 }
      );
      if (statementsResult.data.length > 0) {
        preview = statementsResult.data.map((stmt: any) => ({
          row_number: stmt.row_number || 0,
          transaction_date: stmt.transaction_date,
          transaction_time: stmt.transaction_time || '',
          description: stmt.description || '',
          debit_amount: stmt.debit_amount || 0,
          credit_amount: stmt.credit_amount || 0,
          balance: stmt.balance,
          reference_number: stmt.reference_number || '',
          is_valid: true,
          errors: [],
          warnings: [],
        }));
        logInfo('Summary using DB statements', { importId, status: importRecord.status, previewCount: preview.length });
      }
    } else if (analyzedStatuses.includes(importRecord.status as any)) {
      // Secondary: Try temp data for analyzed imports
      try {
        dataSource = 'temp';
        const rows = await this.retrieveTemporaryData(importId);
        preview = this.generatePreview(
          rows.slice(0, 10).map((r: any) => ({
            ...r,
            is_valid: true,
            errors: [],
            warnings: [],
          })),
          10
        );

        // Calculate duplicates only for ANALYZED
        if (importRecord.status === 'ANALYZED') {
          const { validRows } = await this.validateRows(
            rows,
            companyId,
            importRecord.bank_account_id,
            importId
          );
          const duplicates = await this.detectDuplicates(validRows, companyId, importRecord.bank_account_id);
          duplicateCount = duplicates.length;
        }

        logInfo('Summary using temp data', { importId, status: importRecord.status, previewCount: preview?.length || 0 });
      } catch (tempError) {
        logWarn('Temp data unavailable, falling back to analysis_data', { 
          importId, 
          status: importRecord.status,
          error: String(tempError).substring(0, 200)
        });

        // Fallback: Use stored analysis_data
        dataSource = 'analysis';
        const analysisPreview = (importRecord.analysis_data as any)?.preview;
        if (Array.isArray(analysisPreview) && analysisPreview.length > 0) {
          preview = analysisPreview.slice(0, 10);
        }
      }
    }

    return {
      import: importRecord,
      summary: {
        total_statements: summary.total_statements,
        total_credit: summary.total_credit,
        total_debit: summary.total_debit,
        reconciled_count: summary.reconciled_count,
        duplicate_count: duplicateCount,
        preview,
        data_source: dataSource,
      },
    };
  }

  /**
   * Cancel an ongoing import
   */
  async cancelImport(
    importId: number,
    companyId: string,
    _userId?: string,
  ): Promise<void> {
    const importRecord = await this.repository.findById(importId);

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId);
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId);
    }

    if (importRecord.status !== IMPORT_STATUS.IMPORTING) {
      throw BankStatementImportErrors.INVALID_STATUS_TRANSITION(
        importRecord.status,
        'CANCELLED',
      );
    }

    // Update import status
    await this.repository.update(importId, {
      status: IMPORT_STATUS.FAILED,
      error_message: "Cancelled by user",
    });

    logInfo("BankStatementImport: Import cancelled", {
      import_id: importId,
    });

    // Audit log for cancellation
    await AuditService.log(
      "UPDATE",
      "bank_statement_import",
      String(importId),
      _userId || null,
      { status: importRecord.status },
      { status: IMPORT_STATUS.FAILED, error_message: "Cancelled by user" },
    );
  }

  /**
   * Delete import (soft delete)
   */
  async deleteImport(
    importId: number,
    companyId: string,
    userId?: string,
  ): Promise<void> {
    const importRecord = await this.repository.findById(importId);

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId);
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId);
    }

    if (importRecord.status === IMPORT_STATUS.IMPORTING) {
      // Allow delete if the linked job already failed (stuck import)
      if (importRecord.job_id) {
        const job = await this.repository.findJobById(importRecord.job_id);
        if (job && job.status === 'failed') {
          logInfo('BankStatementImport: Allowing delete of stuck import (job failed)', {
            import_id: importId, job_id: importRecord.job_id,
          });
        } else {
          throw BankStatementImportErrors.CANNOT_DELETE_PROCESSING();
        }
      } else {
        throw BankStatementImportErrors.CANNOT_DELETE_PROCESSING();
      }
    }

    // Undo reconciliation for any reconciled statements before deleting
    try {
      await this.repository.undoReconciliationsForImport(importId);
    } catch (error) {
      logError(
        "BankStatementImport: Could not undo reconciliations, continuing with delete",
        { importId, error },
      );
    }

    // Delete associated statements (ignore errors if none exist)
    try {
      await this.repository.deleteByImportId(importId);
    } catch (error) {
      logError(
        "BankStatementImport: Could not delete statements, may not exist",
        { importId, error },
      );
    }

    // Soft delete import
    await this.repository.delete(importId, userId || "");

    // Clean up temporary data (non-critical, ignore errors)
    await this.cleanupTemporaryData(importId);

    logInfo("BankStatementImport: Import deleted", {
      import_id: importId,
      user_id: userId,
    });

    // Audit log for deletion
    await AuditService.log(
      "DELETE",
      "bank_statement_import",
      String(importId),
      userId || null,
      { status: importRecord.status, file_name: importRecord.file_name },
      { deleted_at: new Date().toISOString() },
    );
  }

  /**
   * Retry a failed import
   */
  async retryImport(
    importId: number,
    companyId: string,
    userId?: string,
  ): Promise<ConfirmImportResult> {
    const importRecord = await this.repository.findById(importId);

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId);
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId);
    }

    if (importRecord.status !== IMPORT_STATUS.FAILED) {
      throw BankStatementImportErrors.INVALID_STATUS_TRANSITION(
        importRecord.status,
        'RETRY',
      );
    }

    // Reset import status
    await this.repository.update(importId, {
      status: IMPORT_STATUS.PENDING,
      processed_rows: 0,
      failed_rows: 0,
      error_message: undefined,
    });

    // Re-confirm (will create new job)
    return this.confirmImport(importId, companyId, false, userId);
  }

  /**
   * Dry run import - preview without actual import
   */
  async dryRunImport(
    importId: number,
    companyId: string,
  ): Promise<{
    import: BankStatementImport;
    preview: {
      total_rows: number;
      valid_rows: number;
      invalid_rows: number;
      duplicates: BankStatementDuplicate[];
      sample_statements: any[];
    };
  }> {
    const importRecord = await this.getImportById(importId, companyId);

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId);
    }

    const rows = await this.retrieveTemporaryData(importId);
    const { validRows, invalidRows } = await this.validateRows(
      rows,
      companyId,
      importRecord.bank_account_id,
      importId,
    );
    const duplicates = await this.detectDuplicates(
      validRows,
      companyId,
      importRecord.bank_account_id,
    );

    return {
      import: importRecord,
      preview: {
        total_rows: rows.length,
        valid_rows: validRows.length,
        invalid_rows: invalidRows.length,
        duplicates,
        sample_statements: validRows.slice(0, 5),
      },
    };
  }

  /**
   * Get import preview
   * @param limit - Maximum number of rows to return (0 means all rows)
   */
  /**
   * Get import preview with status-based fallback (same logic as summary)
   */
  async getImportPreview(
    importId: number,
    companyId: string,
    limit: number = 10,
  ): Promise<{
    import: BankStatementImport;
    preview_rows: BankStatementPreviewRow[];
    total_rows: number;
    data_source?: 'db' | 'temp' | 'analysis';
  }> {
    const importRecord = await this.getImportById(importId, companyId);

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId);
    }

    const completedStatuses = ['COMPLETED', 'IMPORTING', 'FAILED'] as const;
    let dataSource: 'db' | 'temp' | 'analysis' | undefined;
    let totalRows = importRecord.total_rows || 0;

    if (completedStatuses.includes(importRecord.status as any)) {
      dataSource = 'db';
      const statementsResult = await this.repository.findByImportId(importId, {
        page: 1,
        limit: Math.max(limit, 10000), // Support large previews for export
      });
      const previewRows = statementsResult.data.map((stmt: any) => ({
        row_number: stmt.row_number || 0,
        transaction_date: stmt.transaction_date,
        transaction_time: stmt.transaction_time || '',
        description: stmt.description || '',
        debit_amount: stmt.debit_amount || 0,
        credit_amount: stmt.credit_amount || 0,
        balance: stmt.balance,
        reference_number: stmt.reference_number || '',
        is_valid: true,
        errors: [],
        warnings: [],
      }));
      totalRows = statementsResult.total;
      logInfo('Preview using DB statements', { importId, limit, count: previewRows.length });
      return { import: importRecord, preview_rows: previewRows, total_rows: totalRows, data_source: dataSource };
    } else {
      // ANALYZED/PENDING: Try temp → analysis_data
      try {
        dataSource = 'temp';
        const rows = await this.retrieveTemporaryData(importId);
        const rowsToProcess = limit > 0 ? rows.slice(0, limit) : rows;
        const previewRows = this.generatePreview(
          rowsToProcess.map((r: any) => ({
            ...r,
            is_valid: true,
            errors: [],
            warnings: [],
          })),
          rowsToProcess.length
        );
        logInfo('Preview using temp data', { importId, limit, count: previewRows.length });
        return { import: importRecord, preview_rows: previewRows, total_rows: rows.length, data_source: dataSource };
      } catch {
        dataSource = 'analysis';
        const analysisPreview = (importRecord.analysis_data as any)?.preview || [];
        const previewRows = analysisPreview.slice(0, limit);
        logWarn('Preview using analysis_data fallback', { importId, count: previewRows.length });
        return { import: importRecord, preview_rows: previewRows, total_rows: totalRows, data_source: dataSource };
      }
    }
  }

  // ==================== MANUAL ENTRY METHODS ====================

  /**
   * List manual entries grouped by month for a bank account,
   * with auto-generated suggestions from POS aggregates
   */
  async listManualEntries(
    bankAccountId: number,
    companyId: string,
  ): Promise<{ month: string; entries: BankStatement[]; suggestions: Array<{ transaction_date: string; description: string; credit_amount: number; debit_amount: number; payment_method_id: number }> }[]> {
    const [entries, paymentMethods, branchIds] = await Promise.all([
      this.repository.listManualEntries(companyId, bankAccountId),
      this.repository.getPaymentMethodsByBankAccount(companyId, bankAccountId),
      this.repository.getBranchIdsByCompany(companyId),
    ])

    const pmIds = paymentMethods.map(pm => pm.id)

    const grouped = new Map<string, { entries: BankStatement[]; savedDates: Set<string> }>()
    for (const entry of entries) {
      const d = entry.transaction_date?.split('T')[0] || ''
      const key = d.substring(0, 7)
      if (!grouped.has(key)) grouped.set(key, { entries: [], savedDates: new Set() })
      const g = grouped.get(key)!
      g.entries.push(entry)
      g.savedDates.add(d)
    }

    const now = new Date()
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    if (!grouped.has(curMonth)) grouped.set(curMonth, { entries: [], savedDates: new Set() })

    const allMonths = Array.from(grouped.keys()).sort((a, b) => b.localeCompare(a))

    let allAggregates: Array<{ transaction_date: string; payment_method_id: number; payment_method_name: string; total_bill: number; total_nett: number }> = []

    if (pmIds.length > 0 && branchIds.length > 0 && allMonths.length > 0) {
      const earliest = allMonths[allMonths.length - 1]
      const latest = allMonths[0]
      const [ey, em] = earliest.split('-').map(Number)
      const [ly, lm] = latest.split('-').map(Number)
      const prevLastDay = new Date(Date.UTC(ey, em - 1, 0)).getDate()
      const prevMonth = em === 1 ? `${ey - 1}-12` : `${ey}-${String(em - 1).padStart(2, '0')}`
      const dateFrom = `${prevMonth}-${String(prevLastDay).padStart(2, '0')}`
      const lastDay = new Date(Date.UTC(ly, lm, 0)).getDate()
      const dateTo = `${latest}-${String(lastDay).padStart(2, '0')}`

      allAggregates = await this.repository.getAggregatedByDateAndPM(branchIds, pmIds, dateFrom, dateTo)
    }

    type SuggestionRow = { transaction_date: string; description: string; credit_amount: number; debit_amount: number; payment_method_id: number }

    const result: { month: string; entries: BankStatement[]; suggestions: SuggestionRow[] }[] = []

    const suggestionsByMonth = new Map<string, SuggestionRow[]>()

    if (pmIds.length > 0) {
      for (const agg of allAggregates) {
        const posDate = agg.transaction_date?.split('T')[0]
        if (!posDate) continue

        const bankDate = this.addDays(posDate, 1)
        const bankMonth = bankDate.substring(0, 7)

        if (!grouped.has(bankMonth)) continue
        const g = grouped.get(bankMonth)!
        if (g.savedDates.has(bankDate)) continue

        const pmName = agg.payment_method_name || paymentMethods.find(p => p.id === agg.payment_method_id)?.name || ''
        const suggestion: SuggestionRow = {
          transaction_date: bankDate,
          description: `${pmName} | Bill: ${Math.round(agg.total_bill).toLocaleString('id-ID')}`,
          credit_amount: Math.round(agg.total_nett * 100) / 100,
          debit_amount: 0,
          payment_method_id: agg.payment_method_id,
        }

        if (!suggestionsByMonth.has(bankMonth)) suggestionsByMonth.set(bankMonth, [])
        suggestionsByMonth.get(bankMonth)!.push(suggestion)
      }
    }

    for (const month of allMonths) {
      const g = grouped.get(month)!
      const suggestions = (suggestionsByMonth.get(month) || []).sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))

      if (g.entries.length > 0 || suggestions.length > 0) {
        result.push({ month, entries: g.entries, suggestions })
      }
    }

    return result
  }

  private addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(y, m - 1, d + days))
    return date.toISOString().split('T')[0]
  }

  /**
   * Create single manual bank statement entry
   */
  async createManualEntry(
    bankAccountId: number,
    entry: {
      transaction_date: string
      description: string
      debit_amount: number
      credit_amount: number
      reference_number?: string
      balance?: number
    },
    companyId: string,
    userId?: string,
  ): Promise<BankStatement> {
    logInfo('BankStatementImport: Creating manual entry', {
      bank_account_id: bankAccountId,
      transaction_date: entry.transaction_date,
      company_id: companyId,
    })

    const statement = await this.repository.insertManualStatement({
      company_id: companyId,
      bank_account_id: bankAccountId,
      transaction_date: entry.transaction_date,
      description: entry.description,
      debit_amount: entry.debit_amount,
      credit_amount: entry.credit_amount,
      reference_number: entry.reference_number,
      balance: entry.balance,
      created_by: userId,
    })

    await AuditService.log(
      'CREATE',
      'bank_statement_manual',
      String(statement.id),
      userId || null,
      null,
      {
        bank_account_id: bankAccountId,
        transaction_date: entry.transaction_date,
        debit_amount: entry.debit_amount,
        credit_amount: entry.credit_amount,
        source: 'MANUAL_ENTRY',
      },
    )

    return statement
  }

  /**
   * Create bulk manual bank statement entries
   */
  async createManualBulkEntries(
    bankAccountId: number,
    entries: Array<{
      transaction_date: string
      description: string
      debit_amount: number
      credit_amount: number
      reference_number?: string
      balance?: number
    }>,
    companyId: string,
    userId?: string,
  ): Promise<{ inserted: number; ids: number[] }> {
    logInfo('BankStatementImport: Creating bulk manual entries', {
      bank_account_id: bankAccountId,
      count: entries.length,
      company_id: companyId,
    })

    const statements = entries.map((e, idx) => ({
      company_id: companyId,
      bank_account_id: bankAccountId,
      transaction_date: e.transaction_date,
      description: e.description,
      debit_amount: e.debit_amount,
      credit_amount: e.credit_amount,
      reference_number: e.reference_number,
      balance: e.balance,
      row_number: idx + 1,
      created_by: userId,
    }))

    const result = await this.repository.insertManualStatements(statements)

    await AuditService.log(
      'CREATE',
      'bank_statement_manual_bulk',
      result.ids.join(','),
      userId || null,
      null,
      {
        bank_account_id: bankAccountId,
        count: result.inserted,
        source: 'MANUAL_ENTRY',
      },
    )

    logInfo('BankStatementImport: Bulk manual entries created', {
      bank_account_id: bankAccountId,
      inserted: result.inserted,
    })

    return result
  }

  // ==================== HARD DELETE METHODS ====================

  /**
   * Hard delete single bank statement
   * Statement must NOT be reconciled — undo first if reconciled
   */
  async hardDeleteStatement(
    statementId: number,
    companyId: string,
    userId?: string,
  ): Promise<void> {
    const statement = await this.repository.findStatementById(statementId, companyId)
    if (!statement) {
      throw new Error(`Bank statement dengan ID ${statementId} tidak ditemukan`)
    }

    if (statement.is_reconciled) {
      throw new Error('Statement sudah ter-reconcile. Undo reconciliation terlebih dahulu sebelum menghapus.')
    }

    await this.repository.hardDeleteStatement(statementId, companyId)

    await AuditService.log(
      'DELETE',
      'bank_statement_hard_delete',
      String(statementId),
      userId || null,
      {
        transaction_date: statement.transaction_date,
        description: statement.description,
        debit_amount: statement.debit_amount,
        credit_amount: statement.credit_amount,
        source_file: statement.source_file,
      },
      null,
    )

    logInfo('BankStatementImport: Statement hard deleted', {
      statement_id: statementId,
      user_id: userId,
    })
  }

  /**
   * Hard delete multiple bank statements
   * All statements must NOT be reconciled
   */
  async hardDeleteStatements(
    statementIds: number[],
    companyId: string,
    userId?: string,
  ): Promise<{ deleted: number; skipped: number; errors: Array<{ id: number; reason: string }> }> {
    const statements = await this.repository.findStatementsByIds(statementIds, companyId)

    const toDelete: number[] = []
    const errors: Array<{ id: number; reason: string }> = []

    for (const id of statementIds) {
      const stmt = statements.find(s => s.id === id)
      if (!stmt) {
        errors.push({ id, reason: 'Statement tidak ditemukan' })
      } else if (stmt.is_reconciled) {
        errors.push({ id, reason: 'Sudah ter-reconcile, undo dulu' })
      } else {
        toDelete.push(id)
      }
    }

    let deleted = 0
    if (toDelete.length > 0) {
      deleted = await this.repository.hardDeleteStatements(toDelete, companyId)

      await AuditService.log(
        'DELETE',
        'bank_statement_hard_delete_bulk',
        toDelete.join(','),
        userId || null,
        { count: deleted, ids: toDelete },
        null,
      )
    }

    logInfo('BankStatementImport: Bulk hard delete completed', {
      requested: statementIds.length,
      deleted,
      skipped: errors.length,
      user_id: userId,
    })

    return { deleted, skipped: errors.length, errors }
  }

  // ==================== CSV PARSING METHODS ====================

  /**
   * Parse CSV file dengan format detection
   */
  async parseCSVFile(filePath: string): Promise<{
    rows: ParsedCSVRow[];
    formatDetection: CSVFormatDetectionResult;
  }> {
    logInfo("BankStatementImport: Starting CSV file parsing", { filePath });

    // Read file content
    const content = await fs.readFile(filePath, "utf-8");
    const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");

    if (lines.length < 2) {
      throw BankStatementImportErrors.EMPTY_FILE();
    }

    // Detect format
    const formatDetection = this.detectCSVFormat(lines);

    logInfo("BankStatementImport: CSV format detected", {
      format: formatDetection.format,
      confidence: formatDetection.confidence,
    });

    // Parse based on detected format
    let rows: ParsedCSVRow[] = [];

    switch (formatDetection.format) {
      case BANK_CSV_FORMAT.BCA_PERSONAL:
        rows = this.parseBCAPersonal(lines, formatDetection);
        break;
      case BANK_CSV_FORMAT.BCA_BUSINESS:
        rows = this.parseBCABusiness(lines, formatDetection);
        break;
      case BANK_CSV_FORMAT.BCA_BUSINESS_V2:
        rows = this.parseBCABusinessV2(lines, formatDetection);
        break;
      case BANK_CSV_FORMAT.BANK_MANDIRI:
        rows = this.parseBankMandiri(lines, formatDetection);
        break;
      default:
        // Fallback ke generic parsing
        rows = this.parseGenericCSV(lines, formatDetection);
    }

    logInfo("BankStatementImport: CSV parsing completed", {
      format: formatDetection.format,
      total_rows: rows.length,
      pending_rows: rows.filter((r) => r.is_pending).length,
    });

    // Post-process: assign PEND rows the next business day after latest settled date
    // PEND rows settle on T+1 from the latest settled transaction in the file
    const pendingRows = rows.filter(r => r.is_pending)
    if (pendingRows.length > 0) {
      const settledDates = rows
        .filter(r => !r.is_pending && r.transaction_date)
        .map(r => r.transaction_date)
        .sort()
      
      let pendDate: string
      if (settledDates.length > 0) {
        const latest = new Date(settledDates[settledDates.length - 1])
        latest.setDate(latest.getDate() + 1)
        pendDate = latest.toISOString().split('T')[0]
      } else {
        pendDate = new Date().toISOString().split('T')[0]
      }

      for (const row of pendingRows) {
        row.transaction_date = pendDate
      }

      logInfo('BankStatementImport: PEND rows assigned settlement date (T+1)', {
        pending_count: pendingRows.length,
        latest_settled: settledDates[settledDates.length - 1] || 'none',
        pend_date: pendDate,
      })
    }

    return { rows, formatDetection };
  }

  /**
   * Detect CSV format dari content
   */
  private detectCSVFormat(lines: string[]): CSVFormatDetectionResult {
    const warnings: string[] = [];
    let bestFormat: BankCSVFormat = BANK_CSV_FORMAT.UNKNOWN;
    let highestConfidence = 0;

    // Normalize headers for comparison
    const normalizeHeaders = (line: string): string[] => {
      // Remove generic quotes and split by comma or tab
      return line
        .toLowerCase()
        .split(/[,\t]/)
        .map((h) => h.trim().replace(/^["']|["']$/g, ""));
    };

    // Check first 20 lines (increased from 5) for headers to account for pre-header info
    const headerCandidates = lines.slice(0, 20).map((line, idx) => ({
      line,
      normalized: normalizeHeaders(line),
      index: idx,
    }));

    // Score each format
    const formatScores: Record<
      BankCSVFormat,
      { score: number; matchedHeaders: string[] }
    > = {
      [BANK_CSV_FORMAT.BCA_PERSONAL]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.BCA_BUSINESS]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.BCA_BUSINESS_V2]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.BANK_MANDIRI]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.UNKNOWN]: { score: 0, matchedHeaders: [] },
    };

    // Check against known header patterns
    for (const candidate of headerCandidates) {
      // Skip lines that look like section headers (e.g. "HEADER", "TRANSAKSI DEBIT")
      const rawLineUpper = candidate.line.toUpperCase().trim();
      if (
        ["HEADER", "TRANSAKSI", "ACCOUNT NO"].some((k) =>
          rawLineUpper.startsWith(k),
        ) &&
        !candidate.line.includes(",")
      ) {
        continue;
      }

      const headers = candidate.normalized;

      // Check BCA Personal pattern
      const bcaPersonalPattern =
        BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BCA_PERSONAL];
      const bcaPersonalMatches = bcaPersonalPattern.filter((p) =>
        headers.some((h) => h === p || h.includes(p)),
      );
      if (bcaPersonalMatches.length >= 3) {
        // High score if exact match sequence found
        formatScores[BANK_CSV_FORMAT.BCA_PERSONAL].score +=
          bcaPersonalMatches.length * 20;
        formatScores[BANK_CSV_FORMAT.BCA_PERSONAL].matchedHeaders =
          bcaPersonalMatches;
      }

      // Check BCA Business pattern
      const bcaBusinessPattern =
        BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BCA_BUSINESS];
      const bcaBusinessMatches = bcaBusinessPattern.filter((p) =>
        headers.some((h) => h === p || h.includes(p)),
      );
      if (bcaBusinessMatches.length >= 2) {
        formatScores[BANK_CSV_FORMAT.BCA_BUSINESS].score +=
          bcaBusinessMatches.length * 20;
        formatScores[BANK_CSV_FORMAT.BCA_BUSINESS].matchedHeaders =
          bcaBusinessMatches;
      }

      // Check BCA Business V2 pattern
      const bcaBusinessV2Pattern =
        BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BCA_BUSINESS_V2];
      const bcaBusinessV2Matches = bcaBusinessV2Pattern.filter((p) =>
        headers.some((h) => h.includes(p)),
      );
      if (bcaBusinessV2Matches.length >= 3) {
        formatScores[BANK_CSV_FORMAT.BCA_BUSINESS_V2].score +=
          bcaBusinessV2Matches.length * 20;
        formatScores[BANK_CSV_FORMAT.BCA_BUSINESS_V2].matchedHeaders =
          bcaBusinessV2Matches;
      }

      // Check Bank Mandiri pattern
      const mandiriPattern = BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BANK_MANDIRI];
      const mandiriMatches = mandiriPattern.filter((p) =>
        headers.some((h) => h === p || h.includes(p)),
      );
      if (mandiriMatches.length >= 4) {
        formatScores[BANK_CSV_FORMAT.BANK_MANDIRI].score +=
          mandiriMatches.length * 20;
        formatScores[BANK_CSV_FORMAT.BANK_MANDIRI].matchedHeaders =
          mandiriMatches;
      }
    }

    // Find best matching format
    for (const [format, data] of Object.entries(formatScores)) {
      if (format === BANK_CSV_FORMAT.UNKNOWN) continue;

      if (data.score > highestConfidence) {
        highestConfidence = data.score;
        bestFormat = format as BankCSVFormat;
      }
    }

    // If no clear match, try content-based detection
    if (highestConfidence < 50) {
      // Look for data patterns in first few lines that look like data
      const dataLines = lines
        .slice(0, 10)
        .filter((l) => l.includes(",") && /\d/.test(l));

      for (const line of dataLines) {
        const columns = this.splitCSVLine(line, ",");

        // Check for BCA Personal specific pattern: Date with quote, DB/CR col
        if (columns.length >= 6) {
          const col0 = columns[0]?.trim();
          const col4 = columns[4]?.trim(); // CR/DB col
          if (col0?.startsWith("'") && (col4 === "DB" || col4 === "CR")) {
            bestFormat = BANK_CSV_FORMAT.BCA_PERSONAL;
            highestConfidence = 80;
            warnings.push("Format detected by BCA Personal content pattern");
            break;
          }
        }

        // Check for BCA Business specific pattern: 4 cols, amount with suffix
        if (columns.length >= 4) {
          const col3 = columns[3]?.trim();
          if (/[\d,]+\.?\d*\s*(DB|CR|DR)/i.test(col3)) {
            bestFormat = BANK_CSV_FORMAT.BCA_BUSINESS;
            highestConfidence = 80;
            warnings.push("Format detected by BCA Business content pattern");
            break;
          }
        }
      }
    }

    // Determine header row and data start row indices dynamically
    // Check if first line is a header or data
    let headerRowIndex = 0;
    let dataStartRowIndex = 1;

    // Search for header row AGAIN using the best format patterns
    for (const candidate of headerCandidates) {
      const headers = candidate.normalized;

      // Simple check: if there are bank keywords matches the detected format
      let isHeader = false;
      if (bestFormat !== BANK_CSV_FORMAT.UNKNOWN) {
        const pattern = BANK_HEADER_PATTERNS[bestFormat];
        const matches = pattern.filter((p) =>
          headers.some((h) => h.includes(p)),
        );
        if (matches.length >= 2) isHeader = true;
      } else {
        // Fallback generic check
        const bankKeywords = [
          "date",
          "tanggal",
          "desc",
          "keterangan",
          "debit",
          "credit",
          "saldo",
          "balance",
          "account",
          "transaction",
          "val. date",
          "transaction code",
          "reference no",
          "cabang",
          "jumlah",
        ];
        isHeader = bankKeywords.some((keyword) =>
          headers.some((h) => h.includes(keyword)),
        );
      }

      if (isHeader) {
        headerRowIndex = candidate.index;
        dataStartRowIndex = candidate.index + 1;
        break;
      }
    }

    // Build column mapping based on detected format
    const actualHeaders = headerCandidates[headerRowIndex]?.normalized || [];
    const columnMapping = this.buildColumnMapping(bestFormat, actualHeaders);

    // Calculate confidence percentage
    const confidence = Math.min(100, highestConfidence);

    if (confidence < 30) {
      warnings.push(
        "Low confidence format detection. Please verify the CSV format.",
      );
    }

    // Get index-based mapping for fallback
    const columnIndexMapping =
      BANK_COLUMN_INDEX_MAPPING[bestFormat] ||
      BANK_COLUMN_INDEX_MAPPING[BANK_CSV_FORMAT.UNKNOWN];

    // Get parsing config for this format
    const parsingConfig = BANK_PARSING_CONFIG[bestFormat];

    // Detect actual column count from first data line
    const firstDataLine = lines[dataStartRowIndex] || "";
    const dataColumns = this.splitCSVLine(firstDataLine, ",");
    const detectedColumnCount = dataColumns.length;

    // Warn about column count mismatch
    if (
      detectedColumnCount > 0 &&
      (detectedColumnCount < 4 || detectedColumnCount > 9)
    ) {
      warnings.push(
        `Unusual column count detected: ${detectedColumnCount} columns. Please verify the format.`,
      );
    }

    return {
      format: bestFormat,
      confidence,
      headerRowIndex,
      dataStartRowIndex,
      columnMapping,
      columnIndexMapping,
      detectedHeaders: actualHeaders,
      detectedColumnCount,
      warnings,
      parsingConfig,
    };
  }

  /**
   * Build column mapping berdasarkan format
   */
  private buildColumnMapping(
    format: BankCSVFormat,
    headers: string[],
  ): BankStatementColumnMapping {
    const defaultMapping: BankStatementColumnMapping = {
      transaction_date: "transaction_date",
      description: "description",
      debit_amount: "debit_amount",
      credit_amount: "credit_amount",
    };

    switch (format) {
      case BANK_CSV_FORMAT.BCA_PERSONAL:
        return {
          ...defaultMapping,
          transaction_date:
            headers.find((h) => h.includes("date") || h.includes("tanggal")) ||
            "transaction_date",
          description:
            headers.find(
              (h) => h.includes("desc") || h.includes("keterangan"),
            ) || "description",
          balance:
            headers.find((h) => h.includes("balance") || h.includes("saldo")) ||
            "balance",
        };

      case BANK_CSV_FORMAT.BCA_BUSINESS:
        return {
          ...defaultMapping,
          transaction_date: headers[0] || "transaction_date",
          description: headers[1] || "description",
        };

      case BANK_CSV_FORMAT.BANK_MANDIRI:
        return {
          transaction_date: headers[0] || "postdate",
          transaction_time: headers[1] || "remarks",
          description: headers[2] || "additionaldesc",
          debit_amount: headers[4] || "debit_amount",
          credit_amount: headers[3] || "credit_amount",
          balance: headers[5] || "close_balance",
        };

      default:
        return defaultMapping;
    }
  }

  /**
   * Split CSV line dengan handle quotes
   */
  private splitCSVLine(line: string, delimiter: string = ","): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Parse BCA Personal format
   */
  private parseBCAPersonal(
    lines: string[],
    formatDetection: CSVFormatDetectionResult,
  ): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = [];
    const config = BANK_CSV_FORMATS[BANK_CSV_FORMAT.BCA_PERSONAL];
    const dataStartRow = formatDetection.dataStartRowIndex;

    for (let i = dataStartRow; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip header sections
      if (
        line.toUpperCase().startsWith("TRANSAKSI") ||
        line.toUpperCase().includes("HEADER")
      )
        continue;

      const columns = this.splitCSVLine(line, config.delimiter);

      if (columns.length < 5) continue;

      const row = this.parseBCAPersonalRow(columns, i + 1, line);
      if (row) rows.push(row);
    }

    return rows;
  }

  /**
   * Extract tanggal dari description BCA untuk transaksi PEND
   */
  private extractDateFromDescription(description: string, fallbackYear?: number): string | null {
    const year = fallbackYear || new Date().getFullYear()

    // Pattern 1: DDMM/ di awal kode transfer, contoh "1804/FTSCY" atau "0104/FTSCY"
    const transferMatch = description.match(/\b(\d{2})(\d{2})\/[A-Z]{2,}/)
    if (transferMatch) {
      const day = transferMatch[1]
      const month = transferMatch[2]
      const dayNum = parseInt(day)
      const monthNum = parseInt(month)
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
    }

    // Pattern 2: "TANGGAL :DD/MM" atau "TANGGAL:DD/MM"
    const tanggalMatch = description.match(/TANGGAL\s*:(\d{1,2})\/(\d{1,2})/i)
    if (tanggalMatch) {
      const day = tanggalMatch[1].padStart(2, '0')
      const month = tanggalMatch[2].padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    // Pattern 3: " DDMM " spasi-DDMM-spasi (4 digit), fallback
    const shortMatch = description.match(/\s(\d{2})(\d{2})\s/)
    if (shortMatch) {
      const day = parseInt(shortMatch[1])
      const month = parseInt(shortMatch[2])
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
    }

    return null
  }

  /**
   * Parse single BCA Personal row
   */
  private parseBCAPersonalRow(
    columns: string[],
    rowNumber: number,
    rawLine: string,
  ): ParsedCSVRow | null {
    try {
      let dateValue = columns[0]?.trim() || "";
      let description = columns[1]?.trim() || "";
      const branch = columns[2]?.trim().replace(/^'/, "") || "";
      let amountRaw = columns[3]?.trim() || "";
      let creditDebit = columns[4]?.trim()?.toUpperCase() || ""; // Sometimes in col 4
      let balanceRaw = columns[5]?.trim() || "";

      // Handle BCA Personal quirk: date often has leading quote '01/01/2026
      dateValue = dateValue.replace(/^'/, "");

      const transactionDate = this.parseDate(dateValue);
      if (!transactionDate) {
        // Check if it's pending (PEND)
        if (dateValue.toUpperCase().startsWith("PEND")) {
          // Coba extract tanggal dari description
          const extractedDate = this.extractDateFromDescription(description);
          const resolvedDate = extractedDate || new Date().toISOString().split("T")[0];

          let debitAmountPend = 0;
          let creditAmountPend = 0;
          const amountNumPend = parseFloat(amountRaw.replace(/[,\s]/g, ""));
          if (!isNaN(amountNumPend)) {
            if (creditDebit === "CR") creditAmountPend = amountNumPend;
            else if (creditDebit === "DB") debitAmountPend = amountNumPend;
          }

          const balance = this.parseAmount(balanceRaw);

          return {
            row_number: rowNumber,
            raw_line: rawLine,
            format: BANK_CSV_FORMAT.BCA_PERSONAL,
            transaction_date: resolvedDate,
            reference_number: "",
            description: description.substring(0, 1000),
            debit_amount: debitAmountPend,
            credit_amount: creditAmountPend,
            balance: balance || undefined,
            is_pending: true,
            transaction_type: PENDING_TRANSACTION.TRANSACTION_TYPE,
            raw_data: { columns, extractedDateFrom: extractedDate ? 'description' : 'fallback' },
          };
        }
        return null;
      }

      let debitAmount = 0;
      let creditAmount = 0;

      const amountNum = parseFloat(amountRaw.replace(/[,\s]/g, ""));

      // Use DB/CR indicator if available
      if (creditDebit === "CR") {
        creditAmount = amountNum;
      } else if (creditDebit === "DB") {
        debitAmount = amountNum;
      } else {
        // Fallback: check amount sign or description?
        // Usually BCA Personal has explicit column
      }

      const balance = this.parseAmount(balanceRaw);

      return {
        row_number: rowNumber,
        raw_line: rawLine,
        format: BANK_CSV_FORMAT.BCA_PERSONAL,
        transaction_date: transactionDate,
        reference_number: "",
        description: description.substring(0, 1000),
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        balance: balance || undefined,
        is_pending: false,
        raw_data: { columns, branch },
      };
    } catch (e: any) {
      return null;
    }
  }

  /**
   * Parse BCA Business format
   */
  private parseBCABusiness(
    lines: string[],
    formatDetection: CSVFormatDetectionResult,
  ): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = [];
    const dataStartRow = formatDetection.dataStartRowIndex;

    for (let i = dataStartRow; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip header sections
      if (
        line.toUpperCase().startsWith("TRANSAKSI") ||
        line.toUpperCase().includes("HEADER")
      )
        continue;

      const columns = this.parseBusinessCSV(line); // Handles quoted fields
      if (columns.length < 4) continue;

      const row = this.parseBCABusinessRow(columns, i + 1, line);
      if (row) rows.push(row);
    }

    return rows;
  }

  /**
   * Parse BCA Business CSV line
   */
  private parseBusinessCSV(line: string): string[] {
    return this.splitCSVLine(line, ",");
  }

  /**
   * Parse single BCA Business row
   */
  private parseBCABusinessRow(
    columns: string[],
    rowNumber: number,
    rawLine: string,
  ): ParsedCSVRow | null {
    try {
      let dateValue = columns[0]?.trim() || "";
      const description = columns[1]?.trim() || "";
      const branch = columns[2]?.trim() || "";
      const amountRaw = columns[3]?.trim() || "";
      const balanceRaw = columns[4]?.trim() || "";

      const transactionDate = this.parseDate(dateValue);
      if (!transactionDate) {
        if (dateValue.toUpperCase().startsWith("PEND")) {
          const extractedDate = this.extractDateFromDescription(description);
          const resolvedDate = extractedDate || new Date().toISOString().split("T")[0];

          let debitAmountPend = 0;
          let creditAmountPend = 0;
          const amountMatch = amountRaw.match(/^([\d,]+\.?\d*)\s*(DB|CR|DR)?/i);
          if (amountMatch) {
            const num = parseFloat(amountMatch[1].replace(/,/g, ""));
            const type = (amountMatch[2] || "").toUpperCase();

            if (type === "CR") creditAmountPend = num;
            else if (type === "DB" || type === "DR") debitAmountPend = num;
          }

          const balance = this.parseAmount(balanceRaw);

          return {
            row_number: rowNumber,
            raw_line: rawLine,
            format: BANK_CSV_FORMAT.BCA_BUSINESS,
            transaction_date: resolvedDate,
            description: description.substring(0, 1000),
            debit_amount: debitAmountPend,
            credit_amount: creditAmountPend,
            balance: balance || undefined,
            is_pending: true,
            transaction_type: PENDING_TRANSACTION.TRANSACTION_TYPE,
            raw_data: { columns, branch, extractedDateFrom: extractedDate ? 'description' : 'fallback' },
          };
        }
        return null;
      }

      let debitAmount = 0;
      let creditAmount = 0;

      // Amount "287,490.00 DB"
      const amountMatch = amountRaw.match(/^([\d,]+\.?\d*)\s*(DB|CR|DR)?/i);
      if (amountMatch) {
        const num = parseFloat(amountMatch[1].replace(/,/g, ""));
        const type = (amountMatch[2] || "").toUpperCase();

        if (type === "CR") creditAmount = num;
        else if (type === "DB" || type === "DR") debitAmount = num;
        else {
          // Should not happen for business format usually
        }
      }

      const balance = this.parseAmount(balanceRaw);

      return {
        row_number: rowNumber,
        raw_line: rawLine,
        format: BANK_CSV_FORMAT.BCA_BUSINESS,
        transaction_date: transactionDate,
        description: description.substring(0, 1000),
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        balance: balance || undefined,
        is_pending: false,
        raw_data: { columns, branch },
      };
    } catch (e: any) {
      return null;
    }
  }

  /**
   * Parse Bank Mandiri format
   */
  private parseBankMandiri(
    lines: string[],
    formatDetection: CSVFormatDetectionResult,
  ): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = [];
    const dataStartRow = formatDetection.dataStartRowIndex;

    for (let i = dataStartRow; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip section headers if any (e.g. "TRANSAKSI DEBIT")
      if (line.toUpperCase().startsWith("TRANSAKSI") && !line.includes(","))
        continue;

      const columns = this.splitCSVLine(line, ",");
      // Expected columns: Account No, Date, Val Date, Transaction Code, Description, Description, Reference No., Debit, Credit
      if (columns.length < 5) continue;

      const row = this.parseMandiriRow(columns, i + 1, line);
      if (row) rows.push(row);
    }

    return rows;
  }

  /**
   * Helper function to check if transaction is pending
   */
  private isPendingTransaction(
    description: string,
    transactionCode?: string,
  ): boolean {
    // Check for pending indicators in description or transaction code
    const pendingIndicators = ["PEND", "PENDING", "ESTIMATE", "PROJECTED"];

    if (description.toUpperCase().includes("PEND")) {
      return true;
    }

    if (
      transactionCode &&
      pendingIndicators.some((indicator) =>
        transactionCode.toUpperCase().includes(indicator),
      )
    ) {
      return true;
    }

    return false;
  }

  /**
   * Helper function to parse Mandiri amount
   */
  private parseMandiriAmount(val: string): number {
    if (!val || val === ".00" || val.trim() === "") return 0;
    const cleaned = val.replace(/,/g, ""); // Remove thousands separator
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Parse single Mandiri row
   */
  private parseMandiriRow(
    columns: string[],
    rowNumber: number,
    rawLine: string,
  ): ParsedCSVRow | null {
    try {
      // Mapping based on constants
      // 0:AccountNo, 1:Date, 2:ValDate, 3:TrxCode, 4:Desc, 5:Desc, 6:RefNo, 7:Debit, 8:Credit

      // Date is in column 1 (DD/MM/YY)
      const dateStr = columns[1]?.trim();
      // Skip if date is empty
      if (!dateStr) return null;

      const transactionDate =
        this.parseDate(dateStr) || new Date().toISOString().split("T")[0];

      const transactionCode = columns[3]?.trim();
      const description = (columns[4] || "") + " " + (columns[5] || "");
      const referenceNo = columns[6]?.trim();

      const debitStr = columns[7]?.trim();
      const creditStr = columns[8]?.trim();

      const debitAmount = this.parseMandiriAmount(debitStr);
      const creditAmount = this.parseMandiriAmount(creditStr);

      // Check if transaction is pending
      const isPending = this.isPendingTransaction(description, transactionCode);

      return {
        row_number: rowNumber,
        raw_line: rawLine,
        format: BANK_CSV_FORMAT.BANK_MANDIRI,
        transaction_date: transactionDate as string,
        reference_number: referenceNo,
        description: description.trim().substring(0, 1000),
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        // Balance not always available in this layout
        balance: undefined,
        is_pending: isPending,
        transaction_type: isPending
          ? PENDING_TRANSACTION.TRANSACTION_TYPE
          : undefined,
        raw_data: { columns, transactionCode },
      };
    } catch (error: any) {
      logError("BankStatementImport: Error parsing Mandiri row", {
        rowNumber,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Parse BCA Business V2 (Pratinjau Data - Tab Separated usually)
   */
  private parseBCABusinessV2(
    lines: string[],
    formatDetection: CSVFormatDetectionResult,
  ): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = [];

    // Config in constants might imply TSV via delimiter, but we detect dynamically here
    const headerRow = lines[formatDetection.headerRowIndex];

    // Detect delimiter (Tab or Comma)
    const delimiter = headerRow.includes("\t") ? "\t" : ",";
    logInfo("BankStatementImport: Detected delimiter for BCA Business V2", {
      delimiter: delimiter === "\t" ? "TAB" : "COMMA",
    });

    const dataStartRow = formatDetection.dataStartRowIndex;

    for (let i = dataStartRow; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Skip non-data lines (footer etc)
      if (line.startsWith("Bersaldo") || line.startsWith("Total")) continue;

      const columns = this.splitCSVLine(line, delimiter);

      // Expected columns: No, Tanggal, Keterangan, Debit, Kredit, Saldo
      if (columns.length < 6) continue;

      const parsedRow = this.parseBCABusinessV2Row(columns, i + 1);
      if (parsedRow) {
        rows.push(parsedRow);
      }
    }

    return rows;
  }

  private parseBCABusinessV2Row(
    columns: string[],
    rowNumber: number,
  ): ParsedCSVRow | null {
    try {
      const mapping =
        BANK_COLUMN_INDEX_MAPPING[BANK_CSV_FORMAT.BCA_BUSINESS_V2];

      // Date parsing (Col 1: Tanggal)
      const dateValue = columns[mapping.transaction_date!]?.trim() || "";
      const transactionDate = this.parseDate(dateValue);

      if (!transactionDate) {
        // Check if it is a valid row
        return null;
      }

      const description = columns[mapping.description!]?.trim() || "";

      // Amount parsing (Col 3: Debit, Col 4: Kredit)
      // Format: "Rp 806.300" (Indonesian format: Dot = thousand, Comma = decimal)
      // Value "-" means 0

      const parseIdr = (val: string): number => {
        if (!val || val.trim() === "-") return 0;

        // Remove 'Rp' and whitespaces
        let cleaned = val.replace(/Rp\s?/i, "").replace(/\s/g, "");

        // Handle Indonesian format: 806.300 -> 806300 | 123.456,78 -> 123456.78
        // If there is a comma, replace dots with empty, replace comma with dot
        if (cleaned.includes(",")) {
          cleaned = cleaned.replace(/\./g, "").replace(",", ".");
        } else {
          // If only dots, assume thousand separators -> remove them
          cleaned = cleaned.replace(/\./g, "");
        }

        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : num;
      };

      const debitAmount = parseIdr(columns[mapping.debit_amount!]);
      const creditAmount = parseIdr(columns[mapping.credit_amount!]);
      const balance = parseIdr(columns[mapping.balance!]);

      // Determine PENDING
      const isPending = description.includes(PENDING_TRANSACTION.INDICATOR);

      return {
        row_number: rowNumber,
        raw_line: columns.join(","),
        format: BANK_CSV_FORMAT.BCA_BUSINESS_V2,
        transaction_date: transactionDate,
        description,
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        balance,
        is_pending: isPending,
        transaction_type: isPending
          ? PENDING_TRANSACTION.TRANSACTION_TYPE
          : undefined,
        raw_data: { columns },
      };
    } catch (error: any) {
      logError("BankStatementImport: Error parsing BCA Business V2 row", {
        rowNumber,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Generic CSV parsing fallback
   */
  private parseGenericCSV(
    lines: string[],
    formatDetection: CSVFormatDetectionResult,
  ): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = [];
    const config = BANK_CSV_FORMATS[BANK_CSV_FORMAT.BCA_PERSONAL];
    const dataStartRow = formatDetection.dataStartRowIndex;

    for (let i = dataStartRow; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const columns = this.splitCSVLine(line, config.delimiter);

      if (columns.length < 3) continue;

      try {
        const dateValue = columns[0]?.trim() || "";
        const isPending = dateValue === PENDING_TRANSACTION.INDICATOR;

        let transactionDate: string | null = null;
        if (!isPending) {
          transactionDate = this.parseDate(dateValue);
          if (!transactionDate) continue;
        } else {
          transactionDate = new Date().toISOString().split("T")[0];
        }

        const description = columns[1]?.trim() || "";
        const debitAmount = this.parseAmount(columns[2]);
        const creditAmount = this.parseAmount(columns[3] || "0");

        rows.push({
          row_number: i + 1,
          raw_line: line,
          format: BANK_CSV_FORMAT.UNKNOWN,
          transaction_date: transactionDate!,
          description: description.substring(0, 1000),
          debit_amount: debitAmount,
          credit_amount: creditAmount,
          is_pending: isPending,
          transaction_type: isPending
            ? PENDING_TRANSACTION.TRANSACTION_TYPE
            : undefined,
          raw_data: { columns },
        });
      } catch {
        // Skip error rows
      }
    }

    return rows;
  }

  /**
   * Extract reference number dari description
   */
  private extractReferenceNumber(description: string): string | undefined {
    const patterns = [
      /([A-Z0-9]{10,})/,
      /#(\w+)/,
      /Ref[:\s]*(\w+)/i,
      /No\.?\s*(\w+)/i,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match) {
        return match[1] || match[0];
      }
    }

    return undefined;
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Parse Excel or CSV file
   */
  private async parseExcelFile(
    filePath: string,
  ): Promise<{ rows: ParsedRow[]; columnMapping: BankStatementColumnMapping }> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null,
    });

    if (rawData.length === 0) {
      throw BankStatementImportErrors.EMPTY_FILE();
    }

    // Detect column mapping
    const headers = Object.keys(rawData[0]);
    const columnMapping = this.detectColumnMapping(headers);

    // Parse rows
    const rows: ParsedRow[] = rawData.map((row, index) => {
      const parsedRow = this.parseRow(row, columnMapping, index + 2);
      return parsedRow;
    });

    return { rows, columnMapping };
  }

  /**
   * Detect column mapping from headers
   */
  private detectColumnMapping(headers: string[]): BankStatementColumnMapping {
    logInfo("BankStatementImport: Detecting column mapping from headers", {
      headers,
    });

    const mapping: Record<string, string> = {};
    const normalizedHeaders = headers.map((h) =>
      h
        ?.toLowerCase()
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, ""),
    );

    // Comprehensive list of column name variations for bank statement CSV files
    const columnVariations: Record<string, string[]> = {
      transaction_date: [
        "tanggal",
        "date",
        "tgl",
        "transaction_date",
        "trx_date",
        "tanggal_transaksi",
        "posting_date",
        "valuedate",
        "valuedate",
        "trxdate",
        "txndate",
        "tanggal_transaksi",
        "tanggal",
        "tgl_transaksi",
        "date_txn",
        "tran_date",
        "post_date",
        "txn_date",
        "datoverforing",
        "valuedate",
        "postingdate",
        "trandate",
        "txdate",
        "postdate",
        "valuedate",
        "trndate",
        "transdate",
        "trans_date",
        "trxn_date",
        "txndate",
        "tgl",
        "d",
        "dt",
        "tglposting",
        "tgldate",
        "datepost",
      ],
      transaction_time: [
        "waktu",
        "time",
        "jam",
        "transaction_time",
        "waktu_transaksi",
        "jam_transaksi",
        "trx_time",
        "txn_time",
        "posting_time",
        "valued_time",
        "tm",
        "wkt",
        "jam",
      ],
      reference_number: [
        "referensi",
        "reference",
        "ref",
        "no_ref",
        "ref_number",
        "nomor_referensi",
        "no_referensi",
        "reference_no",
        "ref_no",
        "trx_ref",
        "txn_ref",
        "reference_no",
        "nostru",
        "voucher_no",
        "voucherno",
        "doc_no",
        "docnumber",
        "bank_ref",
        "refno",
        "referencenumber",
        "tran_ref",
        "tran_ref",
        "no",
        "number",
        "kode_transaksi",
        "kode",
        "no_transaksi",
        "trx_no",
        "trxn_no",
        "sequence",
      ],
      description: [
        "keterangan",
        "description",
        "desc",
        "memo",
        "keterangan_transaksi",
        "transaction_description",
        "trx_desc",
        "txn_desc",
        "details",
        "detail",
        "uraian",
        "deskripsi",
        "narrative",
        "particulars",
        "trx_description",
        "transactiondetail",
        "trandesc",
        "trx_narration",
        "narration",
        "remark",
        "remarks",
        "note",
        "notes",
        "info",
        "ket",
        "keter",
      ],
      debit_amount: [
        "debit",
        "debet",
        "keluar",
        "withdrawal",
        "pengeluaran",
        "debit_amount",
        "debet_amount",
        "debit_amt",
        "debet_amt",
        "jumlah_keluar",
        "amount_withdrawal",
        "withdraw",
        "paid_out",
        "paidout",
        "outgoing",
        "debitamount",
        "debit_",
        "debitamount",
        "debitamt",
        "db",
        "amount_debit",
        "jumlah_debit",
        "nilai_debit",
        "debitn",
        "dbt",
        "debit_value",
        "outflow",
        "decrease",
      ],
      credit_amount: [
        "kredit",
        "credit",
        "masuk",
        "deposit",
        "pemasukan",
        "credit_amount",
        "kredit_amount",
        "credit_amt",
        "kredit_amt",
        "jumlah_masuk",
        "amount_deposit",
        "deposit",
        "paid_in",
        "paidin",
        "incoming",
        "creditamount",
        "credit_",
        "creditamount",
        "creditamt",
        "cr",
        "amount_credit",
        "jumlah_kredit",
        "nilai_kredit",
        "creditn",
        "crt",
        "credit_value",
        "inflow",
        "increase",
      ],
      balance: [
        "saldo",
        "balance",
        "saldo_akhir",
        "ending_balance",
        "saldo_awal",
        "opening_balance",
        "current_balance",
        "available_balance",
        "balance_amount",
        "saldo_transaksi",
        "running_balance",
        "balanceamt",
        "saldo_tersedia",
        "saldo_sebelum",
        "saldo_setelah",
        "balance_before",
        "balance_after",
        "end_balance",
        "start_balance",
        "accbalance",
        "balance_",
        "bal",
        "sld",
        "amount",
        "saldoamount",
      ],
    };

    // First pass: exact matches (case-insensitive) - case-insensitive comparison
    for (const [key, variations] of Object.entries(columnVariations)) {
      const matchIndex = headers.findIndex((h) =>
        variations.some((v) => h?.toLowerCase().trim() === v.toLowerCase()),
      );
      if (matchIndex !== -1) {
        mapping[key] = headers[matchIndex];
        logInfo(
          `BankStatementImport: Found exact match for ${key}: ${headers[matchIndex]}`,
        );
      }
    }

    // Second pass: partial matches if no exact match found
    for (const [key, variations] of Object.entries(columnVariations)) {
      if (!mapping[key]) {
        const matchIndex = headers.findIndex((h) =>
          variations.some((v) =>
            h?.toLowerCase().trim().includes(v.toLowerCase()),
          ),
        );
        if (matchIndex !== -1) {
          mapping[key] = headers[matchIndex];
          logInfo(
            `BankStatementImport: Found partial match for ${key}: ${headers[matchIndex]}`,
          );
        }
      }
    }

    // Third pass: try to match by common patterns
    if (!mapping.transaction_date) {
      // Try to find any column that looks like a date
      const dateColumnIndex = headers.findIndex((h) => {
        const lower = h.toLowerCase();
        return (
          lower.includes("date") ||
          lower.includes("tanggal") ||
          lower.includes("tgl") ||
          lower.includes("posting") ||
          lower.includes("value") ||
          lower === "d" ||
          lower === "dt"
        );
      });
      if (dateColumnIndex !== -1) {
        mapping.transaction_date = headers[dateColumnIndex];
        logInfo(
          `BankStatementImport: Found date-like column: ${headers[dateColumnIndex]}`,
        );
      }
    }

    // Try to find description column
    if (!mapping.description) {
      const descColumnIndex = headers.findIndex((h) => {
        const lower = h.toLowerCase();
        return (
          lower.includes("desc") ||
          lower.includes("memo") ||
          lower.includes("remark") ||
          lower.includes("ket") ||
          lower.includes("narrative") ||
          lower.includes("detail")
        );
      });
      if (descColumnIndex !== -1) {
        mapping.description = headers[descColumnIndex];
        logInfo(
          `BankStatementImport: Found description-like column: ${headers[descColumnIndex]}`,
        );
      }
    }

    // Try to find amount columns
    if (!mapping.debit_amount || !mapping.credit_amount) {
      // Look for columns with 'amount' or numeric-looking names
      headers.forEach((h, idx) => {
        const lower = h.toLowerCase();
        if (
          !mapping.debit_amount &&
          (lower.includes("debit") ||
            lower.includes("db") ||
            lower === "dr" ||
            lower.includes("withdrawal") ||
            lower.includes("out"))
        ) {
          mapping.debit_amount = h;
          logInfo(`BankStatementImport: Found debit column: ${h}`);
        }
        if (
          !mapping.credit_amount &&
          (lower.includes("credit") ||
            lower.includes("cr") ||
            lower.includes("deposit") ||
            lower.includes("in"))
        ) {
          mapping.credit_amount = h;
          logInfo(`BankStatementImport: Found credit column: ${h}`);
        }
      });
    }

    logInfo("BankStatementImport: Final column mapping", { mapping });

    // Validate required columns
    if (!mapping.transaction_date) {
      throw BankStatementImportErrors.MISSING_REQUIRED_COLUMNS([
        "transaction_date (Tanggal)",
      ]);
    }
    if (!mapping.description) {
      throw BankStatementImportErrors.MISSING_REQUIRED_COLUMNS([
        "description (Keterangan)",
      ]);
    }
    if (!mapping.debit_amount && !mapping.credit_amount) {
      throw BankStatementImportErrors.MISSING_REQUIRED_COLUMNS([
        "debit_amount (Debit) or credit_amount (Kredit)",
      ]);
    }

    return mapping as unknown as BankStatementColumnMapping;
  }

  /**
   * Parse single row
   */
  private parseRow(
    row: any,
    columnMapping: BankStatementColumnMapping,
    rowNumber: number,
  ): ParsedRow {
    const transactionDate = this.parseDate(row[columnMapping.transaction_date]);
    const debitAmount = this.parseAmount(row[columnMapping.debit_amount]);
    const creditAmount = this.parseAmount(row[columnMapping.credit_amount]);

    if (!transactionDate) {
      throw BankStatementImportErrors.INVALID_DATE_FORMAT(
        columnMapping.transaction_date,
        ["YYYY-MM-DD", "DD/MM/YYYY", "DD-MM-YYYY"],
      );
    }

    if (debitAmount === 0 && creditAmount === 0) {
      throw new Error(
        `Row ${rowNumber}: Either debit or credit amount must be greater than 0`,
      );
    }

    return {
      row_number: rowNumber,
      transaction_date: transactionDate,
      transaction_time: columnMapping.transaction_time
        ? row[columnMapping.transaction_time]
        : undefined,
      reference_number: columnMapping.reference_number
        ? row[columnMapping.reference_number]
        : undefined,
      description: String(row[columnMapping.description] || "").trim(),
      debit_amount: debitAmount,
      credit_amount: creditAmount,
      balance: columnMapping.balance
        ? this.parseAmount(row[columnMapping.balance])
        : undefined,
      raw_data: row,
    };
  }

  /**
   * Parse date from various formats
   */
  private parseDate(value: any): string | null {
    if (!value) return null;

    if (value instanceof Date) {
      return value.toISOString().split("T")[0];
    }

    if (typeof value === "string") {
      const cleaned = value.trim().replace(/^'/, "");

      // Try DD/MM/YYYY
      const dmyMatch = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (dmyMatch) {
        const [, day, month, year] = dmyMatch;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }

      // Try DD/MM/YY (e.g., Mandiri 01/01/26)
      const dmy2Match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
      if (dmy2Match) {
        const [, day, month, yearShort] = dmy2Match;
        // Simple year pivot: assuming 20xx
        const year = "20" + yearShort;
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }

      const isoDate = new Date(cleaned);
      if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString().split("T")[0];
      }
    }

    if (typeof value === "number") {
      const date = XLSX.SSF.parse_date_code(value);
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }

    return null;
  }

  /**
   * Parse amount value
   */
  private parseAmount(value: any): number {
    if (value === null || value === undefined || value === "") return 0;

    if (typeof value === "number") return value;

    if (typeof value === "string") {
      const cleaned = value.replace(/[Rp$€£¥,\s]/g, "");
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }

    return 0;
  }

  /**
   * Validate rows
   */
  private async validateRows(
    rows: ParsedRow[],
    companyId: string,
    bankAccountId: number,
    importId?: number,
  ): Promise<{
    validRows: any[];
    invalidRows: ParsedRow[];
    validationErrors: any[];
  }> {
    // Get import record to get file_name for source_file
    let importRecord: any = null;
    if (importId) {
      try {
        const fileName = await this.repository.getImportFileName(importId)
        importRecord = { file_name: fileName }
      } catch (error: any) {
        logError("BankStatementImport: Failed to load import file name", {
          import_id: importId,
          error: error?.message || String(error),
        });
        importRecord = null;
      }
    }

    const validRows: any[] = [];
    const invalidRows: ParsedRow[] = [];
    const validationErrors: any[] = [];

    for (const row of rows) {
      try {
        // Skip transaction_date validation for pending rows (they use placeholder date)
        if (!row.is_pending && !row.transaction_date) {
          throw new Error("Transaction date is required");
        }
        if (!row.description) {
          throw new Error("Description is required");
        }

        // Check that either debit_amount or credit_amount is greater than 0
        // This prevents constraint violation for chk_amount_not_both_zero
        const debitAmount = row.debit_amount ?? 0;
        const creditAmount = row.credit_amount ?? 0;
        if (debitAmount === 0 && creditAmount === 0) {
          throw new Error(
            `Row ${row.row_number}: Either debit or credit amount must be greater than 0`,
          );
        }

        validRows.push({
          company_id: companyId,
          bank_account_id: bankAccountId,
          transaction_date: row.transaction_date,
          transaction_time: row.transaction_time,
          reference_number: row.reference_number,
          description: row.description,
          debit_amount: debitAmount,
          credit_amount: creditAmount,
          balance: row.balance,
          import_id: importId,
          row_number: row.row_number,
          is_pending: row.is_pending,
          transaction_type: row.transaction_type,
          source_file: importRecord?.file_name || null,
        });
      } catch (error: any) {
        invalidRows.push(row);
        validationErrors.push({
          row_number: row.row_number,
          error: error.message,
        });
      }
    }

    return { validRows, invalidRows, validationErrors };
  }

  /**
   * Detect duplicates
   */
  private async detectDuplicates(
    rows: any[],
    companyId: string,
    bankAccountId: number,
  ): Promise<BankStatementDuplicate[]> {
    if (rows.length === 0) return [];

    const transactions = rows.map((r) => ({
      reference_number: r.reference_number,
      transaction_date: r.transaction_date,
      debit_amount: r.debit_amount,
      credit_amount: r.credit_amount,
      description: r.description,
      bank_account_id: bankAccountId
    }));

    const existingStatements = await this.repository.checkDuplicates(
      transactions,
      bankAccountId
    );

    if (existingStatements.length === 0) return [];

    // Convert existing matches to BankStatementDuplicate format
    // checkDuplicates already handles date+amount+description similarity
    const duplicates: BankStatementDuplicate[] = existingStatements.map((ex: any) => ({
      reference_number: ex.reference_number || undefined,
      transaction_date: String(ex.transaction_date),
      description: ex.description || '',
      debit_amount: Number(ex.debit_amount),
      credit_amount: Number(ex.credit_amount),
      existing_import_id: ex.import_id || 0,
      existing_statement_id: ex.id,
      row_numbers: [],
    }));

    // Deduplicate by date+amount
    return duplicates.filter((dup, index, self) =>
      index === self.findIndex((d) =>
        d.transaction_date === dup.transaction_date &&
        d.debit_amount === dup.debit_amount &&
        d.credit_amount === dup.credit_amount
      )
    );
  }

  /**
   * Generate preview rows
   */
  private generatePreview(
    rows: any[],
    limit: number,
  ): BankStatementPreviewRow[] {
    return rows.slice(0, limit).map((row) => ({
      row_number: row.row_number,
      transaction_date: row.transaction_date,
      transaction_time: row.transaction_time,
      description: row.description,
      debit_amount: row.debit_amount,
      credit_amount: row.credit_amount,
      balance: row.balance,
      reference_number: row.reference_number,
      is_valid: true,
      errors: [],
      warnings: [],
    }));
  }

  /**
   * Generate warnings based on analysis
   */
  private generateWarnings(
    duplicates: BankStatementDuplicate[],
    invalidRows: ParsedRow[],
  ): string[] {
    const warnings: string[] = [];

    if (duplicates.length > 0) {
      warnings.push(`Found ${duplicates.length} potential duplicate(s)`);
    }
    if (invalidRows.length > 0) {
      warnings.push(
        `Found ${invalidRows.length} invalid row(s) that will be skipped`,
      );
    }

    return warnings;
  }

  /**
   * Store temporary data in Supabase Storage
   */
  private async storeTemporaryData(
    importId: number,
    rows: any[],
  ): Promise<void> {
    try {
      await this.repository.uploadTemporaryData(importId, rows)
    } catch (error) {
      logError("BankStatementImport: storeTemporaryData error", {
        importId,
        error,
      });
      throw error;
    }
  }

  /**
   * Retrieve temporary data from Supabase Storage (graceful fallback)
   */
  private async retrieveTemporaryData(importId: number): Promise<any[]> {
    try {
      const data = await this.repository.downloadTemporaryData(importId);
      logInfo('Temp data retrieved successfully', { importId, rowCount: data.length });
      return data;
    } catch (error: any) {
      // Graceful handling for StorageUnknownError (file not found)
      if (error.name === 'StorageUnknownError' || String(error).includes('not found')) {
        logWarn('Temp data not found (expected for completed imports)', { 
          importId, 
          error: String(error).substring(0, 100) 
        });
        return [];
      }
      
      logError("BankStatementImport: retrieveTemporaryData error", {
        importId,
        bucket: "bank-statement-imports-temp",
        path: `${importId}.json`,
        error_name: error.name,
        error_message: error.message,
      });
      throw error;
    }
  }

  /**
   * Clean up temporary data from storage
   */
  private async cleanupTemporaryData(importId: number): Promise<void> {
    try {
      await this.repository.removeTemporaryData(importId)
    } catch (error) {
      logError("BankStatementImport: cleanupTemporaryData error", {
        importId,
        error,
      });
      // Non-critical error - don't throw
    }
  }
}

export const bankStatementImportService = (
  repository: BankStatementImportRepository,
): BankStatementImportService => {
  return new BankStatementImportService(repository);
};
