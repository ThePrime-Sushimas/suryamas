/**
 * Bank Statement Import Service
 * Handles business logic untuk bank statement import operations
 */

import { supabase } from '../../../config/supabase'
import { logInfo, logError } from '../../../config/logger'
import { BankStatementImportRepository } from './bank-statement-import.repository'
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
} from './bank-statement-import.types'
import { 
  BankStatementImportErrors, 
  BankStatementImportConfig 
} from './bank-statement-import.errors'
import { 
  IMPORT_STATUS,
  BANK_CSV_FORMAT,
  BANK_CSV_FORMATS,
  BANK_HEADER_PATTERNS,
  BANK_COLUMN_INDEX_MAPPING,
  AMOUNT_PATTERNS,
  BANK_PARSING_CONFIG,
  PENDING_TRANSACTION,
} from './bank-statement-import.constants'
import { duplicateDetector } from './utils/duplicate-detector'
import * as XLSX from 'xlsx'
import fs from 'fs/promises'
import path from 'path'

// Pagination interface
interface PaginationParams {
  page: number
  limit: number
}

// Sort interface
interface SortParams {
  field: string
  order: 'asc' | 'desc'
}

// Paginated response interface
interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// File upload interface
interface FileUploadResult {
  file_name: string
  file_size: number
  file_path: string
  file_hash: string
  mime_type: string
}

// Parsed row from Excel
interface ParsedRow {
  row_number: number
  transaction_date: string
  transaction_time?: string
  reference_number?: string
  description: string
  debit_amount: number
  credit_amount: number
  balance?: number
  raw_data: Record<string, any>
  is_pending?: boolean
  transaction_type?: string
}

export class BankStatementImportService {
  private readonly TEMP_DIR = '/tmp/bank-imports'

  constructor(
    private readonly repository: BankStatementImportRepository
  ) {
    this.ensureTempDir()
  }

  /**
   * Ensure temp directory exists
   */
  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(this.TEMP_DIR, { recursive: true })
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
    userId?: string
  ): Promise<UploadAnalysisResult> {
    logInfo('BankStatementImport: Starting file analysis', {
      file_name: fileResult.file_name,
      bank_account_id: bankAccountId,
      company_id: companyId,
    })

    try {
      // Check for duplicate file - first check active records
      const activeImport = await this.repository.checkFileHashExists(
        fileResult.file_hash,
        companyId
      )

      if (activeImport) {
        // File exists and is active - throw duplicate error
        throw BankStatementImportErrors.DUPLICATE_FILE(fileResult.file_name)
      }

      // Check if file exists but was deleted (for re-upload)
      const existingImport = await this.repository.checkFileHashExistsIncludingDeleted(
        fileResult.file_hash,
        companyId
      )

      if (existingImport && existingImport.deleted_at !== null) {
        logInfo('BankStatementImport: Re-uploading previously deleted file', {
          file_hash: fileResult.file_hash,
          previous_import_id: existingImport.id
        })
        
        // Hard delete the old record to allow new upload
        const { error: hardDeleteError } = await supabase
          .from('bank_statement_imports')
          .delete()
          .eq('id', existingImport.id)

        if (hardDeleteError) {
          logError('BankStatementImport: Failed to hard delete old import', {
            import_id: existingImport.id,
            error: hardDeleteError.message
          })
          throw new Error('Tidak dapat memproses file yang sama. Silakan coba lagi.')
        }
        
        logInfo('BankStatementImport: Successfully deleted old import, allowing new upload', {
          previous_import_id: existingImport.id
        })
      }

      // Check file extension and parse accordingly
      const isCSV = fileResult.file_name.toLowerCase().endsWith('.csv')
      let rows: any[]
      let columnMapping: BankStatementColumnMapping

      if (isCSV) {
        // Parse CSV file with format detection
        logInfo('BankStatementImport: Parsing CSV file', { file_name: fileResult.file_name })
        const csvResult = await this.parseCSVFile(fileResult.file_path)
        rows = csvResult.rows.map(row => ({
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
        }))
        columnMapping = csvResult.formatDetection.columnMapping
        
        logInfo('BankStatementImport: CSV parsed successfully', {
          format: csvResult.formatDetection.format,
          total_rows: rows.length,
        })
      } else {
        // Parse Excel file
        const excelResult = await this.parseExcelFile(fileResult.file_path)
        rows = excelResult.rows
        columnMapping = excelResult.columnMapping
      }

      if (rows.length === 0) {
        throw BankStatementImportErrors.EMPTY_FILE()
      }

      // Validate and transform rows
      const { validRows, invalidRows, validationErrors } = await this.validateRows(
        rows,
        companyId,
        bankAccountId
      )

      // Check for duplicates against existing database records
      const existingDuplicates = await this.detectDuplicates(
        validRows,
        companyId,
        bankAccountId
      )

      // Check for intra-file duplicates (duplicates within the same file)
      const intraFileDuplicates = duplicateDetector.detectIntraFileDuplicates(
        validRows.map(r => ({
          row_number: r.row_number,
          transaction_date: r.transaction_date,
          reference_number: r.reference_number,
          description: r.description,
          debit_amount: r.debit_amount,
          credit_amount: r.credit_amount,
          is_valid: true,
        }))
      )

      // Merge duplicates (existing + intra-file)
      const duplicates = [...existingDuplicates, ...intraFileDuplicates]

      // Calculate date range
      const dates = validRows.map(r => new Date(r.transaction_date))
      const dateRangeStart = dates.length > 0 
        ? new Date(Math.min(...dates.map(d => d.getTime()))).toISOString().split('T')[0]
        : ''
      const dateRangeEnd = dates.length > 0 
        ? new Date(Math.max(...dates.map(d => d.getTime()))).toISOString().split('T')[0]
        : ''

      // Generate preview
      const preview = this.generatePreview(validRows, 10)

      // Create import record
      const createDto: CreateBankStatementImportDto = {
        company_id: companyId,
        bank_account_id: bankAccountId,
        file_name: fileResult.file_name,
        file_size: fileResult.file_size,
        file_hash: fileResult.file_hash,
        created_by: userId,
      }

      const importRecord = await this.repository.create(createDto)

      if (!importRecord) {
        throw BankStatementImportErrors.CREATE_FAILED()
      }

      // Create analysis result
      const analysis: BankStatementAnalysis = {
        total_rows: rows.length,
        valid_rows: validRows.length,
        invalid_rows: invalidRows.length,
        date_range_start: dateRangeStart,
        date_range_end: dateRangeEnd,
        preview,
        duplicates,
        duplicate_count: duplicates.length,
        column_mapping: columnMapping,
        errors: validationErrors,
        warnings: this.generateWarnings(duplicates, invalidRows),
      }

      // Update import with analysis data
      await this.repository.update(importRecord.id, {
        status: IMPORT_STATUS.ANALYZED,
        total_rows: rows.length,
        date_range_start: dateRangeStart || undefined,
        date_range_end: dateRangeEnd || undefined,
        analysis_data: {
          preview: preview,
          duplicates: duplicates,
          duplicate_count: duplicates.length,
          invalid_count: invalidRows.length,
          column_mapping: columnMapping,
          date_range: {
            start: dateRangeStart,
            end: dateRangeEnd,
          },
          warnings: analysis.warnings,
          analyzed_at: new Date().toISOString(),
        } as any,
      })

      // Store parsed data in Supabase Storage for later processing
      await this.storeTemporaryData(importRecord.id, rows)

      logInfo('BankStatementImport: File analysis completed', {
        import_id: importRecord.id,
        total_rows: rows.length,
        valid_rows: validRows.length,
        duplicates: duplicates.length,
      })

      return {
        import: importRecord,
        analysis,
      }
    } catch (error: any) {
      logError('BankStatementImport: File analysis failed', {
        error: error.message,
        file_name: fileResult.file_name,
      })
      throw error
    }
  }

  /**
   * Confirm import and create job for async processing
   */
  async confirmImport(
    importId: number,
    companyId: string,
    skipDuplicates: boolean,
    userId?: string
  ): Promise<ConfirmImportResult> {
    logInfo('BankStatementImport: Confirming import', {
      import_id: importId,
      skip_duplicates: skipDuplicates,
    })

    const importRecord = await this.repository.findById(importId)

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId)
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId)
    }

    if (importRecord.status !== IMPORT_STATUS.ANALYZED) {
      throw BankStatementImportErrors.INVALID_STATUS_TRANSITION(
        importRecord.status,
        IMPORT_STATUS.IMPORTING
      )
    }

    // Create job
    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        name: `Import Bank Statement ${importRecord.file_name}`,
        type: 'import',
        module: 'bank_statements',
        status: 'pending',
        metadata: {
          importId,
          bankAccountId: importRecord.bank_account_id,
          companyId,
          skipDuplicates,
          totalRows: importRecord.total_rows,
        },
        user_id: userId,
        company_id: companyId,
      })
      .select()
      .single()

    if (error) {
      logError('BankStatementImport: Failed to create job', { error: error.message })
      throw new Error('Failed to create job')
    }

    // Update import status and job_id
    await this.repository.update(importId, {
      status: IMPORT_STATUS.IMPORTING,
      job_id: job.id,
    })

    logInfo('BankStatementImport: Job created', {
      import_id: importId,
      job_id: job.id,
    })

    return {
      import: importRecord,
      job_id: String(job.id),
    }
  }

  /**
   * Process import (called by job worker)
   */
  async processImport(
    jobId: number,
    importId: number,
    companyId: string,
    skipDuplicates: boolean
  ): Promise<{ processed_count: number }> {
    logInfo('BankStatementImport: Starting import processing', {
      job_id: jobId,
      import_id: importId,
    })

    const importRecord = await this.repository.findById(importId)

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId)
    }

    // Retrieve temporary data
    const rows = await this.retrieveTemporaryData(importId)

    // Validate rows
    const { validRows, invalidRows } = await this.validateRows(
      rows,
      companyId,
      importRecord.bank_account_id,
      importId
    )

    let rowsToInsert = validRows

    // Filter duplicates if requested
    if (skipDuplicates) {
      // Check for duplicates against existing database records
      const existingDuplicates = await this.detectDuplicates(
        validRows,
        companyId,
        importRecord.bank_account_id
      )

      // Check for intra-file duplicates
      const intraFileDuplicates = duplicateDetector.detectIntraFileDuplicates(
        validRows.map(r => ({
          row_number: r.row_number,
          transaction_date: r.transaction_date,
          reference_number: r.reference_number,
          description: r.description,
          debit_amount: r.debit_amount,
          credit_amount: r.credit_amount,
          is_valid: true,
        }))
      )

      // Merge all duplicates
      const allDuplicates = [...existingDuplicates, ...intraFileDuplicates]

      const duplicateKeys = new Set(
        allDuplicates.map(d => `${d.transaction_date}-${d.reference_number || ''}-${d.debit_amount}-${d.credit_amount}`)
      )

      rowsToInsert = validRows.filter(r => {
        const key = `${r.transaction_date}-${r.reference_number || ''}-${r.debit_amount}-${r.credit_amount}`
        return !duplicateKeys.has(key)
      })

      logInfo('BankStatementImport: Duplicates filtered', {
        import_id: importId,
        original_count: validRows.length,
        after_filter: rowsToInsert.length,
        skipped: validRows.length - rowsToInsert.length,
        existing_duplicates: existingDuplicates.length,
        intra_file_duplicates: intraFileDuplicates.length,
      })
    }

    // Bulk insert in batches
    const batchSize = BankStatementImportConfig.BATCH_SIZE
    let processedCount = 0

    for (let i = 0; i < rowsToInsert.length; i += batchSize) {
      const batch = rowsToInsert.slice(i, i + batchSize)
      
      const insertedCount = await this.repository.bulkInsert(batch)
      processedCount += insertedCount

      // Update progress
      await this.repository.updateProgress(importId, processedCount, invalidRows.length)

      // Update job progress
      await supabase
        .from('jobs')
        .update({
          progress: {
            processed_rows: processedCount,
            total_rows: rowsToInsert.length,
            percentage: Math.round((processedCount / rowsToInsert.length) * 100),
          },
        })
        .eq('id', jobId)

      logInfo('BankStatementImport: Batch processed', {
        import_id: importId,
        batch_number: Math.ceil(i / batchSize) + 1,
        processed: processedCount,
        total: rowsToInsert.length,
      })
    }

    // Update import to completed
    await this.repository.update(importId, {
      status: IMPORT_STATUS.COMPLETED,
      processed_rows: processedCount,
      failed_rows: invalidRows.length,
    })

    // Clean up temporary data
    await this.cleanupTemporaryData(importId)

    logInfo('BankStatementImport: Processing completed', {
      import_id: importId,
      processed_count: processedCount,
      failed_count: invalidRows.length,
    })

    return { processed_count: processedCount }
  }

  /**
   * List imports with pagination
   */
  async listImports(
    companyId: string,
    pagination: PaginationParams,
    _sort: SortParams,
    filter?: BankStatementImportFilterParams
  ): Promise<PaginatedResponse<BankStatementImport>> {
    const result = await this.repository.findAll(companyId, pagination, filter)

    const totalPages = Math.ceil(result.total / pagination.limit)

    return {
      data: result.data,
      total: result.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      hasNext: pagination.page * pagination.limit < result.total,
      hasPrev: pagination.page > 1,
    }
  }

  /**
   * Get import by ID
   */
  async getImportById(
    importId: number,
    companyId: string
  ): Promise<BankStatementImport | null> {
    const importRecord = await this.repository.findById(importId)

    if (!importRecord) {
      return null
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId)
    }

    return importRecord
  }

  /**
   * Get statements for an import
   */
  async getImportStatements(
    importId: number,
    companyId: string,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<BankStatement>> {
    const importRecord = await this.repository.findById(importId)

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId)
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId)
    }

    const result = await this.repository.findByImportId(importId, pagination)
    const totalPages = Math.ceil(result.total / pagination.limit)

    return {
      data: result.data,
      total: result.total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages,
      hasNext: pagination.page * pagination.limit < result.total,
      hasPrev: pagination.page > 1,
    }
  }

  /**
   * Get import summary
   */
  async getImportSummary(
    importId: number,
    companyId: string
  ): Promise<{
    import: BankStatementImport
    summary: {
      total_statements: number
      total_credit: number
      total_debit: number
      reconciled_count: number
      duplicate_count: number
      preview?: BankStatementPreviewRow[]
    }
  }> {
    const importRecord = await this.getImportById(importId, companyId)

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId)
    }

    const summary = await this.repository.getSummaryByImportId(importId)

    // Calculate duplicate_count based on import status
    let duplicateCount = 0
    let preview: BankStatementPreviewRow[] | undefined

    // Try from Supabase Storage first (for ANALYZED status)
    try {
      const rows = await this.retrieveTemporaryData(importId)
      
      // Generate preview
      preview = this.generatePreview(
        rows.slice(0, 10).map((r) => ({
          ...r,
          is_valid: true,
          errors: [],
          warnings: [],
        })),
        10
      )

      // Calculate duplicates from temporary data for ANALYZED status
      if (importRecord.status === IMPORT_STATUS.ANALYZED) {
        const { validRows } = await this.validateRows(
          rows,
          companyId,
          importRecord.bank_account_id,
          importId
        )
        const duplicates = await this.detectDuplicates(
          validRows,
          companyId,
          importRecord.bank_account_id
        )
        duplicateCount = duplicates.length
        logInfo('BankStatementImport: Calculated duplicate count from temporary data', { importId, duplicateCount })
      }
    } catch {
      // Fallback: get from statements in database (for COMPLETED status)
      try {
        const statementsResult = await this.repository.findByImportId(importId, { page: 1, limit: 10 })
        if (statementsResult.data.length > 0) {
          preview = statementsResult.data.map((stmt) => ({
            row_number: stmt.row_number || 0,
            transaction_date: stmt.transaction_date,
            transaction_time: stmt.transaction_time,
            description: stmt.description || '',
            debit_amount: stmt.debit_amount,
            credit_amount: stmt.credit_amount,
            balance: stmt.balance,
            reference_number: stmt.reference_number,
            is_valid: true,
            errors: [],
            warnings: [],
          }))
        }
      } catch (error) {
        logError('BankStatementImport: Could not fetch preview from statements', { importId, error })
        preview = undefined
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
      },
    }
  }

  /**
   * Cancel an ongoing import
   */
  async cancelImport(
    importId: number,
    companyId: string,
    _userId?: string
  ): Promise<void> {
    const importRecord = await this.repository.findById(importId)

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId)
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId)
    }

    if (importRecord.status !== IMPORT_STATUS.IMPORTING) {
      throw new Error('Can only cancel imports that are currently processing')
    }

    // Update import status
    await this.repository.update(importId, {
      status: IMPORT_STATUS.FAILED,
      error_message: 'Cancelled by user',
    })

    logInfo('BankStatementImport: Import cancelled', {
      import_id: importId,
    })
  }

  /**
   * Delete import (soft delete)
   */
  async deleteImport(
    importId: number,
    companyId: string,
    userId?: string
  ): Promise<void> {
    const importRecord = await this.repository.findById(importId)

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId)
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId)
    }

    if (importRecord.status === IMPORT_STATUS.IMPORTING) {
      throw new Error('Cannot delete import while it is being processed')
    }

    // Delete associated statements (ignore errors if none exist)
    try {
      await this.repository.deleteByImportId(importId)
    } catch (error) {
      logError('BankStatementImport: Could not delete statements, may not exist', { importId, error })
    }

    // Soft delete import
    await this.repository.delete(importId, userId || '')

    // Clean up temporary data (non-critical, ignore errors)
    await this.cleanupTemporaryData(importId)

    logInfo('BankStatementImport: Import deleted', {
      import_id: importId,
      user_id: userId,
    })
  }

  /**
   * Retry a failed import
   */
  async retryImport(
    importId: number,
    companyId: string,
    userId?: string
  ): Promise<ConfirmImportResult> {
    const importRecord = await this.repository.findById(importId)

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId)
    }

    if (importRecord.company_id !== companyId) {
      throw BankStatementImportErrors.COMPANY_ACCESS_DENIED(companyId)
    }

    if (importRecord.status !== IMPORT_STATUS.FAILED) {
      throw new Error('Can only retry failed imports')
    }

    // Reset import status
    await this.repository.update(importId, {
      status: IMPORT_STATUS.PENDING,
      processed_rows: 0,
      failed_rows: 0,
      error_message: undefined,
    })

    // Re-confirm (will create new job)
    return this.confirmImport(importId, companyId, false, userId)
  }

  /**
   * Dry run import - preview without actual import
   */
  async dryRunImport(
    importId: number,
    companyId: string
  ): Promise<{
    import: BankStatementImport
    preview: {
      total_rows: number
      valid_rows: number
      invalid_rows: number
      duplicates: BankStatementDuplicate[]
      sample_statements: any[]
    }
  }> {
    const importRecord = await this.getImportById(importId, companyId)

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId)
    }

    const rows = await this.retrieveTemporaryData(importId)
    const { validRows, invalidRows } = await this.validateRows(
      rows,
      companyId,
      importRecord.bank_account_id,
      importId
    )
    const duplicates = await this.detectDuplicates(
      validRows,
      companyId,
      importRecord.bank_account_id
    )

    return {
      import: importRecord,
      preview: {
        total_rows: rows.length,
        valid_rows: validRows.length,
        invalid_rows: invalidRows.length,
        duplicates,
        sample_statements: validRows.slice(0, 5),
      },
    }
  }

  /**
   * Get import preview
   * @param limit - Maximum number of rows to return (0 means all rows)
   */
  async getImportPreview(
    importId: number,
    companyId: string,
    limit: number
  ): Promise<{
    import: BankStatementImport
    preview_rows: BankStatementPreviewRow[]
    total_rows: number
  }> {
    const importRecord = await this.getImportById(importId, companyId)

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId)
    }

    // Try to get from temporary data first
    try {
      const rows = await this.retrieveTemporaryData(importId)
      
      // If limit is 0 or greater than rows.length, return all rows
      const rowsToProcess = limit > 0 ? rows.slice(0, limit) : rows
      
      const previewRows = this.generatePreview(
        rowsToProcess.map((r) => ({
          ...r,
          is_valid: true,
          errors: [],
          warnings: [],
        })),
        rowsToProcess.length
      )

      return {
        import: importRecord,
        preview_rows: previewRows,
        total_rows: rows.length,
      }
    } catch {
      // Fallback: get from statements in database
      const statementsResult = await this.repository.findByImportId(importId, { page: 1, limit: limit > 0 ? limit : 10000 })
      const previewRows = statementsResult.data.map((stmt) => ({
        row_number: stmt.row_number || 0,
        transaction_date: stmt.transaction_date,
        transaction_time: stmt.transaction_time,
        description: stmt.description || '',
        debit_amount: stmt.debit_amount,
        credit_amount: stmt.credit_amount,
        balance: stmt.balance,
        reference_number: stmt.reference_number,
        is_valid: true,
        errors: [],
        warnings: [],
      }))

      return {
        import: importRecord,
        preview_rows: previewRows,
        total_rows: statementsResult.total,
      }
    }
  }

  // ==================== CSV PARSING METHODS ====================

  /**
   * Parse CSV file dengan format detection
   */
  async parseCSVFile(
    filePath: string
  ): Promise<{ rows: ParsedCSVRow[]; formatDetection: CSVFormatDetectionResult }> {
    logInfo('BankStatementImport: Starting CSV file parsing', { filePath })

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8')
    const lines = content.split(/\r?\n/).filter(line => line.trim() !== '')

    if (lines.length < 2) {
      throw BankStatementImportErrors.EMPTY_FILE()
    }

    // Detect format
    const formatDetection = this.detectCSVFormat(lines)

    logInfo('BankStatementImport: CSV format detected', {
      format: formatDetection.format,
      confidence: formatDetection.confidence,
    })

    // Parse based on detected format
    let rows: ParsedCSVRow[] = []

    switch (formatDetection.format) {
      case BANK_CSV_FORMAT.BCA_PERSONAL:
        rows = this.parseBCAPersonal(lines, formatDetection)
        break
      case BANK_CSV_FORMAT.BCA_BUSINESS:
        rows = this.parseBCABusiness(lines, formatDetection)
        break
      case BANK_CSV_FORMAT.BCA_BUSINESS_V2:
        rows = this.parseBCABusinessV2(lines, formatDetection)
        break
      case BANK_CSV_FORMAT.BANK_MANDIRI:
        rows = this.parseBankMandiri(lines, formatDetection)
        break
      default:
        // Fallback ke generic parsing
        rows = this.parseGenericCSV(lines, formatDetection)
    }

    logInfo('BankStatementImport: CSV parsing completed', {
      format: formatDetection.format,
      total_rows: rows.length,
      pending_rows: rows.filter(r => r.is_pending).length,
    })

    return { rows, formatDetection }
  }

  /**
   * Detect CSV format dari content
   */
  private detectCSVFormat(lines: string[]): CSVFormatDetectionResult {
    const warnings: string[] = []
    let bestFormat: BankCSVFormat = BANK_CSV_FORMAT.UNKNOWN
    let highestConfidence = 0

    // Normalize headers for comparison
    const normalizeHeaders = (line: string): string[] => {
      // Remove generic quotes and split by comma or tab
      return line.toLowerCase().split(/[,\t]/).map(h => h.trim().replace(/^["']|["']$/g, ''))
    }

    // Check first 20 lines (increased from 5) for headers to account for pre-header info
    const headerCandidates = lines.slice(0, 20).map((line, idx) => ({
      line,
      normalized: normalizeHeaders(line),
      index: idx,
    }))

    // Score each format
    const formatScores: Record<BankCSVFormat, { score: number; matchedHeaders: string[] }> = {
      [BANK_CSV_FORMAT.BCA_PERSONAL]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.BCA_BUSINESS]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.BCA_BUSINESS_V2]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.BANK_MANDIRI]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.UNKNOWN]: { score: 0, matchedHeaders: [] },
    }

    // Check against known header patterns
    for (const candidate of headerCandidates) {
      // Skip lines that look like section headers (e.g. "HEADER", "TRANSAKSI DEBIT")
      const rawLineUpper = candidate.line.toUpperCase().trim()
      if (['HEADER', 'TRANSAKSI', 'ACCOUNT NO'].some(k => rawLineUpper.startsWith(k)) && !candidate.line.includes(',')) {
        continue
      }

      const headers = candidate.normalized

      // Check BCA Personal pattern
      const bcaPersonalPattern = BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BCA_PERSONAL]
      const bcaPersonalMatches = bcaPersonalPattern.filter(p => 
        headers.some(h => h === p || h.includes(p))
      )
      if (bcaPersonalMatches.length >= 3) {
        // High score if exact match sequence found
        formatScores[BANK_CSV_FORMAT.BCA_PERSONAL].score += bcaPersonalMatches.length * 20
        formatScores[BANK_CSV_FORMAT.BCA_PERSONAL].matchedHeaders = bcaPersonalMatches
      }

      // Check BCA Business pattern
      const bcaBusinessPattern = BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BCA_BUSINESS]
      const bcaBusinessMatches = bcaBusinessPattern.filter(p =>
        headers.some(h => h === p || h.includes(p))
      )
      if (bcaBusinessMatches.length >= 2) {
        formatScores[BANK_CSV_FORMAT.BCA_BUSINESS].score += bcaBusinessMatches.length * 20
        formatScores[BANK_CSV_FORMAT.BCA_BUSINESS].matchedHeaders = bcaBusinessMatches
      }

      // Check BCA Business V2 pattern
      const bcaBusinessV2Pattern = BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BCA_BUSINESS_V2]
      const bcaBusinessV2Matches = bcaBusinessV2Pattern.filter(p =>
        headers.some(h => h.includes(p))
      )
      if (bcaBusinessV2Matches.length >= 3) {
        formatScores[BANK_CSV_FORMAT.BCA_BUSINESS_V2].score += bcaBusinessV2Matches.length * 20
        formatScores[BANK_CSV_FORMAT.BCA_BUSINESS_V2].matchedHeaders = bcaBusinessV2Matches
      }


      // Check Bank Mandiri pattern
      const mandiriPattern = BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BANK_MANDIRI]
      const mandiriMatches = mandiriPattern.filter(p =>
        headers.some(h => h === p || h.includes(p))
      )
      if (mandiriMatches.length >= 4) {
        formatScores[BANK_CSV_FORMAT.BANK_MANDIRI].score += mandiriMatches.length * 20
        formatScores[BANK_CSV_FORMAT.BANK_MANDIRI].matchedHeaders = mandiriMatches
      }
    }

    // Find best matching format
    for (const [format, data] of Object.entries(formatScores)) {
      if (format === BANK_CSV_FORMAT.UNKNOWN) continue
      
      if (data.score > highestConfidence) {
        highestConfidence = data.score
        bestFormat = format as BankCSVFormat
      }
    }

    // If no clear match, try content-based detection
    if (highestConfidence < 50) {
      // Look for data patterns in first few lines that look like data
      const dataLines = lines.slice(0, 10).filter(l => l.includes(',') && /\d/.test(l))
      
      for (const line of dataLines) {
        const columns = this.splitCSVLine(line, ',')
        
        // Check for BCA Personal specific pattern: Date with quote, DB/CR col
        if (columns.length >= 6) {
           const col0 = columns[0]?.trim()
           const col4 = columns[4]?.trim() // CR/DB col
           if (col0?.startsWith("'") && (col4 === 'DB' || col4 === 'CR')) {
             bestFormat = BANK_CSV_FORMAT.BCA_PERSONAL
             highestConfidence = 80
             warnings.push('Format detected by BCA Personal content pattern')
             break
           }
        }
        
        // Check for BCA Business specific pattern: 4 cols, amount with suffix
        if (columns.length >= 4) {
          const col3 = columns[3]?.trim()
          if (/[\d,]+\.?\d*\s*(DB|CR|DR)/i.test(col3)) {
             bestFormat = BANK_CSV_FORMAT.BCA_BUSINESS
             highestConfidence = 80
             warnings.push('Format detected by BCA Business content pattern')
             break
          }
        }
      }
    }

    // Determine header row and data start row indices dynamically
    // Check if first line is a header or data
    let headerRowIndex = 0
    let dataStartRowIndex = 1
    
    // Search for header row AGAIN using the best format patterns
    for (const candidate of headerCandidates) {
      const headers = candidate.normalized
      
      // Simple check: if there are bank keywords matches the detected format
      let isHeader = false
      if (bestFormat !== BANK_CSV_FORMAT.UNKNOWN) {
         const pattern = BANK_HEADER_PATTERNS[bestFormat]
         const matches = pattern.filter(p => headers.some(h => h.includes(p)))
         if (matches.length >= 2) isHeader = true
      } else {
        // Fallback generic check
        const bankKeywords = [
          'date', 'tanggal', 'desc', 'keterangan', 'debit', 'credit', 
          'saldo', 'balance', 'account', 'transaction', 'val. date',
          'transaction code', 'reference no', 'cabang', 'jumlah'
        ]
        isHeader = bankKeywords.some(keyword => 
          headers.some(h => h.includes(keyword))
        )
      }
      
      if (isHeader) {
        headerRowIndex = candidate.index
        dataStartRowIndex = candidate.index + 1
        break
      }
    }

    // Build column mapping based on detected format
    const actualHeaders = headerCandidates[headerRowIndex]?.normalized || []
    const columnMapping = this.buildColumnMapping(bestFormat, actualHeaders)

    // Calculate confidence percentage
    const confidence = Math.min(100, highestConfidence)

    if (confidence < 30) {
      warnings.push('Low confidence format detection. Please verify the CSV format.')
    }

    // Get index-based mapping for fallback
    const columnIndexMapping = BANK_COLUMN_INDEX_MAPPING[bestFormat] || BANK_COLUMN_INDEX_MAPPING[BANK_CSV_FORMAT.UNKNOWN]

    // Get parsing config for this format
    const parsingConfig = BANK_PARSING_CONFIG[bestFormat]

    // Detect actual column count from first data line
    const firstDataLine = lines[dataStartRowIndex] || ''
    const dataColumns = this.splitCSVLine(firstDataLine, ',')
    const detectedColumnCount = dataColumns.length

    // Warn about column count mismatch
    if (detectedColumnCount > 0 && (detectedColumnCount < 4 || detectedColumnCount > 9)) {
      warnings.push(`Unusual column count detected: ${detectedColumnCount} columns. Please verify the format.`)
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
    }
  }

  /**
   * Build column mapping berdasarkan format
   */
  private buildColumnMapping(format: BankCSVFormat, headers: string[]): BankStatementColumnMapping {
    const defaultMapping: BankStatementColumnMapping = {
      transaction_date: 'transaction_date',
      description: 'description',
      debit_amount: 'debit_amount',
      credit_amount: 'credit_amount',
    }

    switch (format) {
      case BANK_CSV_FORMAT.BCA_PERSONAL:
        return {
          ...defaultMapping,
          transaction_date: headers.find(h => h.includes('date') || h.includes('tanggal')) || 'transaction_date',
          description: headers.find(h => h.includes('desc') || h.includes('keterangan')) || 'description',
          balance: headers.find(h => h.includes('balance') || h.includes('saldo')) || 'balance',
        }

      case BANK_CSV_FORMAT.BCA_BUSINESS:
        return {
          ...defaultMapping,
          transaction_date: headers[0] || 'transaction_date',
          description: headers[1] || 'description',
        }

      case BANK_CSV_FORMAT.BANK_MANDIRI:
        return {
          transaction_date: headers[0] || 'postdate',
          transaction_time: headers[1] || 'remarks',
          description: headers[2] || 'additionaldesc',
          debit_amount: headers[4] || 'debit_amount',
          credit_amount: headers[3] || 'credit_amount',
          balance: headers[5] || 'close_balance',
        }

      default:
        return defaultMapping
    }
  }

  /**
   * Split CSV line dengan handle quotes
   */
  private splitCSVLine(line: string, delimiter: string = ','): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }

    result.push(current.trim())
    return result
  }

  /**
   * Parse BCA Personal format
   */
  private parseBCAPersonal(lines: string[], formatDetection: CSVFormatDetectionResult): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = []
    const config = BANK_CSV_FORMATS[BANK_CSV_FORMAT.BCA_PERSONAL]
    const dataStartRow = formatDetection.dataStartRowIndex

    for (let i = dataStartRow; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        // Skip header sections
        if (line.toUpperCase().startsWith('TRANSAKSI') || line.toUpperCase().includes('HEADER')) continue

        const columns = this.splitCSVLine(line, config.delimiter)
        
        if (columns.length < 5) continue

        const row = this.parseBCAPersonalRow(columns, i + 1, line)
        if (row) rows.push(row)
    }

    return rows
  }

  /**
   * Parse single BCA Personal row
   */
  private parseBCAPersonalRow(columns: string[], rowNumber: number, rawLine: string): ParsedCSVRow | null {
    try {
        let dateValue = columns[0]?.trim() || ''
        let description = columns[1]?.trim() || ''
        const branch = columns[2]?.trim().replace(/^'/, '') || ''
        let amountRaw = columns[3]?.trim() || ''
        let creditDebit = columns[4]?.trim()?.toUpperCase() || '' // Sometimes in col 4
        let balanceRaw = columns[5]?.trim() || ''

        // Handle BCA Personal quirk: date often has leading quote '01/01/2026
        dateValue = dateValue.replace(/^'/, '')
        
        const transactionDate = this.parseDate(dateValue)
        if (!transactionDate) {
            // Check if it's pending (PEND)
            if (dateValue.toUpperCase().startsWith('PEND')) {
                 // Pending logic
                 return {
                    row_number: rowNumber,
                    raw_line: rawLine,
                    format: BANK_CSV_FORMAT.BCA_PERSONAL,
                    transaction_date: new Date().toISOString().split('T')[0],
                    reference_number: '',
                    description: description.substring(0, 1000),
                    debit_amount: 0,
                    credit_amount: 0,
                    is_pending: true,
                    transaction_type: PENDING_TRANSACTION.TRANSACTION_TYPE,
                    raw_data: { columns }
                 }
            }
            return null
        }

        let debitAmount = 0
        let creditAmount = 0
        
        const amountNum = parseFloat(amountRaw.replace(/[,\s]/g, ''))

        // Use DB/CR indicator if available
        if (creditDebit === 'CR') {
             creditAmount = amountNum
        } else if (creditDebit === 'DB') {
             debitAmount = amountNum
        } else {
             // Fallback: check amount sign or description?
             // Usually BCA Personal has explicit column
        }
        
        const balance = this.parseAmount(balanceRaw)

        return {
            row_number: rowNumber,
            raw_line: rawLine,
            format: BANK_CSV_FORMAT.BCA_PERSONAL,
            transaction_date: transactionDate,
            reference_number: '',
            description: description.substring(0, 1000),
            debit_amount: debitAmount,
            credit_amount: creditAmount,
            balance: balance || undefined,
            is_pending: false,
            raw_data: { columns, branch }
        }
    } catch (e: any) {
        return null
    }
  }

  /**
   * Parse BCA Business format
   */
  private parseBCABusiness(lines: string[], formatDetection: CSVFormatDetectionResult): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = []
    const dataStartRow = formatDetection.dataStartRowIndex

    for (let i = dataStartRow; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        // Skip header sections
        if (line.toUpperCase().startsWith('TRANSAKSI') || line.toUpperCase().includes('HEADER')) continue

        const columns = this.parseBusinessCSV(line) // Handles quoted fields
        if (columns.length < 4) continue

        const row = this.parseBCABusinessRow(columns, i + 1, line)
        if (row) rows.push(row)
    }

    return rows
  }

  /**
   * Parse BCA Business CSV line
   */
  private parseBusinessCSV(line: string): string[] {
    return this.splitCSVLine(line, ',')
  }

  /**
   * Parse single BCA Business row
   */
  private parseBCABusinessRow(columns: string[], rowNumber: number, rawLine: string): ParsedCSVRow | null {
    try {
      let dateValue = columns[0]?.trim() || ''
      const description = columns[1]?.trim() || ''
      const branch = columns[2]?.trim() || ''
      const amountRaw = columns[3]?.trim() || ''
      const balanceRaw = columns[4]?.trim() || ''

      const transactionDate = this.parseDate(dateValue)
      if (!transactionDate) return null
      
      let debitAmount = 0
      let creditAmount = 0

      // Amount "287,490.00 DB"
      const amountMatch = amountRaw.match(/^([\d,]+\.?\d*)\s*(DB|CR|DR)?/i)
      if (amountMatch) {
          const num = parseFloat(amountMatch[1].replace(/,/g, ''))
          const type = (amountMatch[2] || '').toUpperCase()
          
          if (type === 'CR') creditAmount = num
          else if (type === 'DB' || type === 'DR') debitAmount = num
          else {
              // Should not happen for business format usually
          }
      }
      
      const balance = this.parseAmount(balanceRaw)

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
        raw_data: { columns, branch }
      }
    } catch (e: any) {
        return null
    }
  }

  /**
   * Parse Bank Mandiri format
   */
  private parseBankMandiri(lines: string[], formatDetection: CSVFormatDetectionResult): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = []
    const dataStartRow = formatDetection.dataStartRowIndex
    
    for (let i = dataStartRow; i < lines.length; i++) {
        const line = lines[i].trim()
        if (!line) continue
        
        // Skip section headers if any (e.g. "TRANSAKSI DEBIT")
        if (line.toUpperCase().startsWith('TRANSAKSI') && !line.includes(',')) continue
  
        const columns = this.splitCSVLine(line, ',')
        // Expected columns: Account No, Date, Val Date, Transaction Code, Description, Description, Reference No., Debit, Credit
        if (columns.length < 5) continue
  
        const row = this.parseMandiriRow(columns, i + 1, line)
        if (row) rows.push(row)
    }
  
    return rows
  }

  /**
   * Helper function to check if transaction is pending
   */
  private isPendingTransaction(description: string, transactionCode?: string): boolean {
    // Check for pending indicators in description or transaction code
    const pendingIndicators = ['PEND', 'PENDING', 'ESTIMATE', 'PROJECTED']
    
    if (description.toUpperCase().includes('PEND')) {
      return true
    }
    
    if (transactionCode && pendingIndicators.some(indicator => 
      transactionCode.toUpperCase().includes(indicator))) {
      return true
    }
    
    return false
  }

  /**
   * Helper function to parse Mandiri amount
   */
  private parseMandiriAmount(val: string): number {
    if (!val || val === '.00' || val.trim() === '') return 0
    const cleaned = val.replace(/,/g, '') // Remove thousands separator
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  /**
   * Parse single Mandiri row
   */
  private parseMandiriRow(columns: string[], rowNumber: number, rawLine: string): ParsedCSVRow | null {
    try {
        // Mapping based on constants
        // 0:AccountNo, 1:Date, 2:ValDate, 3:TrxCode, 4:Desc, 5:Desc, 6:RefNo, 7:Debit, 8:Credit
        
        // Date is in column 1 (DD/MM/YY)
        const dateStr = columns[1]?.trim()
        // Skip if date is empty
        if (!dateStr) return null
        
        const transactionDate = this.parseDate(dateStr) || new Date().toISOString().split('T')[0]
        
        const transactionCode = columns[3]?.trim()
        const description = (columns[4] || '') + ' ' + (columns[5] || '')
        const referenceNo = columns[6]?.trim()
        
        const debitStr = columns[7]?.trim()
        const creditStr = columns[8]?.trim()
        
        const debitAmount = this.parseMandiriAmount(debitStr)
        const creditAmount = this.parseMandiriAmount(creditStr)
        
        // Check if transaction is pending
        const isPending = this.isPendingTransaction(description, transactionCode)

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
            transaction_type: isPending ? PENDING_TRANSACTION.TRANSACTION_TYPE : undefined,
            raw_data: { columns, transactionCode }
        }

    } catch (error: any) {
        logError('BankStatementImport: Error parsing Mandiri row', { rowNumber, error: error.message })
        return null
    }
  }

  /**
   * Parse BCA Business V2 (Pratinjau Data - Tab Separated usually)
   */
  private parseBCABusinessV2(lines: string[], formatDetection: CSVFormatDetectionResult): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = []
    
    // Config in constants might imply TSV via delimiter, but we detect dynamically here
    const headerRow = lines[formatDetection.headerRowIndex]
    
    // Detect delimiter (Tab or Comma)
    const delimiter = headerRow.includes('\t') ? '\t' : ','
    logInfo('BankStatementImport: Detected delimiter for BCA Business V2', { delimiter: delimiter === '\t' ? 'TAB' : 'COMMA' })

    const dataStartRow = formatDetection.dataStartRowIndex

    for (let i = dataStartRow; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Skip non-data lines (footer etc)
      if (line.startsWith('Bersaldo') || line.startsWith('Total')) continue
      
      const columns = this.splitCSVLine(line, delimiter)
      
      // Expected columns: No, Tanggal, Keterangan, Debit, Kredit, Saldo
      if (columns.length < 6) continue

      const parsedRow = this.parseBCABusinessV2Row(columns, i + 1)
      if (parsedRow) {
        rows.push(parsedRow)
      }
    }

    return rows
  }

  private parseBCABusinessV2Row(columns: string[], rowNumber: number): ParsedCSVRow | null {
    try {
        const mapping = BANK_COLUMN_INDEX_MAPPING[BANK_CSV_FORMAT.BCA_BUSINESS_V2]
        
        // Date parsing (Col 1: Tanggal)
        const dateValue = columns[mapping.transaction_date!]?.trim() || ''
        const transactionDate = this.parseDate(dateValue)
        
        if (!transactionDate) {
            // Check if it is a valid row
            return null
        }

        const description = columns[mapping.description!]?.trim() || ''
        
        // Amount parsing (Col 3: Debit, Col 4: Kredit)
        // Format: "Rp 806.300" (Indonesian format: Dot = thousand, Comma = decimal)
        // Value "-" means 0
        
        const parseIdr = (val: string): number => {
            if (!val || val.trim() === '-') return 0
            
            // Remove 'Rp' and whitespaces
            let cleaned = val.replace(/Rp\s?/i, '').replace(/\s/g, '')
            
            // Handle Indonesian format: 806.300 -> 806300 | 123.456,78 -> 123456.78
            // If there is a comma, replace dots with empty, replace comma with dot
            if (cleaned.includes(',')) {
                cleaned = cleaned.replace(/\./g, '').replace(',', '.')
            } else {
                // If only dots, assume thousand separators -> remove them
                cleaned = cleaned.replace(/\./g, '')
            }
            
            const num = parseFloat(cleaned)
            return isNaN(num) ? 0 : num
        }

        const debitAmount = parseIdr(columns[mapping.debit_amount!])
        const creditAmount = parseIdr(columns[mapping.credit_amount!])
        const balance = parseIdr(columns[mapping.balance!])

        // Determine PENDING
        const isPending = description.includes(PENDING_TRANSACTION.INDICATOR)

        return {
            row_number: rowNumber,
            raw_line: columns.join(','),
            format: BANK_CSV_FORMAT.BCA_BUSINESS_V2,
            transaction_date: transactionDate,
            description,
            debit_amount: debitAmount,
            credit_amount: creditAmount,
            balance,
            is_pending: isPending,
            transaction_type: isPending ? PENDING_TRANSACTION.TRANSACTION_TYPE : undefined,
            raw_data: { columns }
        }

    } catch (error: any) {
        logError('BankStatementImport: Error parsing BCA Business V2 row', { rowNumber, error: error.message })
        return null
    }
  }


  /**
   * Generic CSV parsing fallback
   */
  private parseGenericCSV(lines: string[], formatDetection: CSVFormatDetectionResult): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = []
    const config = BANK_CSV_FORMATS[BANK_CSV_FORMAT.BCA_PERSONAL]
    const dataStartRow = formatDetection.dataStartRowIndex

    for (let i = dataStartRow; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const columns = this.splitCSVLine(line, config.delimiter)

      if (columns.length < 3) continue

      try {
        const dateValue = columns[0]?.trim() || ''
        const isPending = dateValue === PENDING_TRANSACTION.INDICATOR

        let transactionDate: string | null = null
        if (!isPending) {
          transactionDate = this.parseDate(dateValue)
          if (!transactionDate) continue
        } else {
          transactionDate = new Date().toISOString().split('T')[0]
        }

        const description = columns[1]?.trim() || ''
        const debitAmount = this.parseAmount(columns[2])
        const creditAmount = this.parseAmount(columns[3] || '0')

        rows.push({
          row_number: i + 1,
          raw_line: line,
          format: BANK_CSV_FORMAT.UNKNOWN,
          transaction_date: transactionDate!,
          description: description.substring(0, 1000),
          debit_amount: debitAmount,
          credit_amount: creditAmount,
          is_pending: isPending,
          transaction_type: isPending ? PENDING_TRANSACTION.TRANSACTION_TYPE : undefined,
          raw_data: { columns },
        })
      } catch {
        // Skip error rows
      }
    }

    return rows
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
    ]

    for (const pattern of patterns) {
      const match = description.match(pattern)
      if (match) {
        return match[1] || match[0]
      }
    }

    return undefined
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Parse Excel or CSV file
   */
  private async parseExcelFile(
    filePath: string
  ): Promise<{ rows: ParsedRow[]; columnMapping: BankStatementColumnMapping }> {
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
      raw: false,
      defval: null,
    })

    if (rawData.length === 0) {
      throw BankStatementImportErrors.EMPTY_FILE()
    }

    // Detect column mapping
    const headers = Object.keys(rawData[0])
    const columnMapping = this.detectColumnMapping(headers)

    // Parse rows
    const rows: ParsedRow[] = rawData.map((row, index) => {
      const parsedRow = this.parseRow(row, columnMapping, index + 2)
      return parsedRow
    })

    return { rows, columnMapping }
  }

  /**
   * Detect column mapping from headers
   */
  private detectColumnMapping(
    headers: string[]
  ): BankStatementColumnMapping {
    logInfo('BankStatementImport: Detecting column mapping from headers', { headers })

    const mapping: Record<string, string> = {}
    const normalizedHeaders = headers.map(h => h?.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))

    // Comprehensive list of column name variations for bank statement CSV files
    const columnVariations: Record<string, string[]> = {
      transaction_date: [
        'tanggal', 'date', 'tgl', 'transaction_date', 'trx_date', 'tanggal_transaksi',
        'posting_date', 'valuedate', 'valuedate', 'trxdate', 'txndate', 'tanggal_transaksi',
        'tanggal', 'tgl_transaksi', 'date_txn', 'tran_date', 'post_date', 'txn_date',
        'datoverforing', 'valuedate', 'postingdate', 'trandate', 'txdate', 'postdate',
        'valuedate', 'trndate', 'transdate', 'trans_date', 'trxn_date', 'txndate',
        'tgl', 'd', 'dt', 'tglposting', 'tgldate', 'datepost'
      ],
      transaction_time: [
        'waktu', 'time', 'jam', 'transaction_time', 'waktu_transaksi', 'jam_transaksi',
        'trx_time', 'txn_time', 'posting_time', 'valued_time', 'tm', 'wkt', 'jam'
      ],
      reference_number: [
        'referensi', 'reference', 'ref', 'no_ref', 'ref_number', 'nomor_referensi',
        'no_referensi', 'reference_no', 'ref_no', 'trx_ref', 'txn_ref', 'reference_no',
        'nostru', 'voucher_no', 'voucherno', 'doc_no', 'docnumber', 'bank_ref',
        'refno', 'referencenumber', 'tran_ref', 'tran_ref', 'no', 'number',
        'kode_transaksi', 'kode', 'no_transaksi', 'trx_no', 'trxn_no', 'sequence'
      ],
      description: [
        'keterangan', 'description', 'desc', 'memo', 'keterangan_transaksi',
        'transaction_description', 'trx_desc', 'txn_desc', 'details', 'detail',
        'uraian', 'deskripsi', 'narrative', 'particulars', 'trx_description',
        'transactiondetail', 'trandesc', 'trx_narration', 'narration', 'remark',
        'remarks', 'note', 'notes', 'info', 'ket', 'keter'
      ],
      debit_amount: [
        'debit', 'debet', 'keluar', 'withdrawal', 'pengeluaran', 'debit_amount',
        'debet_amount', 'debit_amt', 'debet_amt', 'jumlah_keluar', 'amount_withdrawal',
        'withdraw', 'paid_out', 'paidout', 'outgoing', 'debitamount', 'debit_',
        'debitamount', 'debitamt', 'db', 'amount_debit', 'jumlah_debit', 'nilai_debit',
        'debitn', 'dbt', 'debit_value', 'outflow', 'decrease'
      ],
      credit_amount: [
        'kredit', 'credit', 'masuk', 'deposit', 'pemasukan', 'credit_amount',
        'kredit_amount', 'credit_amt', 'kredit_amt', 'jumlah_masuk', 'amount_deposit',
        'deposit', 'paid_in', 'paidin', 'incoming', 'creditamount', 'credit_',
        'creditamount', 'creditamt', 'cr', 'amount_credit', 'jumlah_kredit', 'nilai_kredit',
        'creditn', 'crt', 'credit_value', 'inflow', 'increase'
      ],
      balance: [
        'saldo', 'balance', 'saldo_akhir', 'ending_balance', 'saldo_awal', 'opening_balance',
        'current_balance', 'available_balance', 'balance_amount', 'saldo_transaksi',
        'running_balance', 'balanceamt', 'saldo_tersedia', 'saldo_sebelum', 'saldo_setelah',
        'balance_before', 'balance_after', 'end_balance', 'start_balance', 'accbalance',
        'balance_', 'bal', 'sld', 'amount', 'saldoamount'
      ],
    }

    // First pass: exact matches (case-insensitive) - case-insensitive comparison
    for (const [key, variations] of Object.entries(columnVariations)) {
      const matchIndex = headers.findIndex(h => 
        variations.some(v => h?.toLowerCase().trim() === v.toLowerCase())
      )
      if (matchIndex !== -1) {
        mapping[key] = headers[matchIndex]
        logInfo(`BankStatementImport: Found exact match for ${key}: ${headers[matchIndex]}`)
      }
    }

    // Second pass: partial matches if no exact match found
    for (const [key, variations] of Object.entries(columnVariations)) {
      if (!mapping[key]) {
        const matchIndex = headers.findIndex(h =>
          variations.some(v => h?.toLowerCase().trim().includes(v.toLowerCase()))
        )
        if (matchIndex !== -1) {
          mapping[key] = headers[matchIndex]
          logInfo(`BankStatementImport: Found partial match for ${key}: ${headers[matchIndex]}`)
        }
      }
    }

    // Third pass: try to match by common patterns
    if (!mapping.transaction_date) {
      // Try to find any column that looks like a date
      const dateColumnIndex = headers.findIndex(h => {
        const lower = h.toLowerCase()
        return lower.includes('date') || lower.includes('tanggal') || lower.includes('tgl') || 
               lower.includes('posting') || lower.includes('value') || lower === 'd' || lower === 'dt'
      })
      if (dateColumnIndex !== -1) {
        mapping.transaction_date = headers[dateColumnIndex]
        logInfo(`BankStatementImport: Found date-like column: ${headers[dateColumnIndex]}`)
      }
    }

    // Try to find description column
    if (!mapping.description) {
      const descColumnIndex = headers.findIndex(h => {
        const lower = h.toLowerCase()
        return lower.includes('desc') || lower.includes('memo') || lower.includes('remark') ||
               lower.includes('ket') || lower.includes('narrative') || lower.includes('detail')
      })
      if (descColumnIndex !== -1) {
        mapping.description = headers[descColumnIndex]
        logInfo(`BankStatementImport: Found description-like column: ${headers[descColumnIndex]}`)
      }
    }

    // Try to find amount columns
    if (!mapping.debit_amount || !mapping.credit_amount) {
      // Look for columns with 'amount' or numeric-looking names
      headers.forEach((h, idx) => {
        const lower = h.toLowerCase()
        if (!mapping.debit_amount && (lower.includes('debit') || lower.includes('db') || lower === 'dr' || lower.includes('withdrawal') || lower.includes('out'))) {
          mapping.debit_amount = h
          logInfo(`BankStatementImport: Found debit column: ${h}`)
        }
        if (!mapping.credit_amount && (lower.includes('credit') || lower.includes('cr') || lower.includes('deposit') || lower.includes('in'))) {
          mapping.credit_amount = h
          logInfo(`BankStatementImport: Found credit column: ${h}`)
        }
      })
    }

    logInfo('BankStatementImport: Final column mapping', { mapping })

    // Validate required columns
    if (!mapping.transaction_date) {
      throw BankStatementImportErrors.MISSING_REQUIRED_COLUMNS(['transaction_date (Tanggal)'])
    }
    if (!mapping.description) {
      throw BankStatementImportErrors.MISSING_REQUIRED_COLUMNS(['description (Keterangan)'])
    }
    if (!mapping.debit_amount && !mapping.credit_amount) {
      throw BankStatementImportErrors.MISSING_REQUIRED_COLUMNS(['debit_amount (Debit) or credit_amount (Kredit)'])
    }

    return mapping as unknown as BankStatementColumnMapping
  }

  /**
   * Parse single row
   */
  private parseRow(
    row: any,
    columnMapping: BankStatementColumnMapping,
    rowNumber: number
  ): ParsedRow {
    const transactionDate = this.parseDate(row[columnMapping.transaction_date])
    const debitAmount = this.parseAmount(row[columnMapping.debit_amount])
    const creditAmount = this.parseAmount(row[columnMapping.credit_amount])

    if (!transactionDate) {
      throw BankStatementImportErrors.INVALID_DATE_FORMAT(
        columnMapping.transaction_date,
        ['YYYY-MM-DD', 'DD/MM/YYYY', 'DD-MM-YYYY']
      )
    }

    if (debitAmount === 0 && creditAmount === 0) {
      throw new Error(`Row ${rowNumber}: Either debit or credit amount must be greater than 0`)
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
      description: String(row[columnMapping.description] || '').trim(),
      debit_amount: debitAmount,
      credit_amount: creditAmount,
      balance: columnMapping.balance
        ? this.parseAmount(row[columnMapping.balance])
        : undefined,
      raw_data: row,
    }
  }

  /**
   * Parse date from various formats
   */
  private parseDate(value: any): string | null {
    if (!value) return null

    if (value instanceof Date) {
      return value.toISOString().split('T')[0]
    }

    if (typeof value === 'string') {
      const cleaned = value.trim().replace(/^'/, '')

      // Try DD/MM/YYYY
      const dmyMatch = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
      if (dmyMatch) {
        const [, day, month, year] = dmyMatch
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }

      // Try DD/MM/YY (e.g., Mandiri 01/01/26)
      const dmy2Match = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/)
      if (dmy2Match) {
        const [, day, month, yearShort] = dmy2Match
        // Simple year pivot: assuming 20xx
        const year = '20' + yearShort
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }

      const isoDate = new Date(cleaned)
      if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString().split('T')[0]
      }
    }

    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value)
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
    }

    return null
  }

  /**
   * Parse amount value
   */
  private parseAmount(value: any): number {
    if (value === null || value === undefined || value === '') return 0

    if (typeof value === 'number') return value

    if (typeof value === 'string') {
      const cleaned = value.replace(/[Rp$€£¥,\s]/g, '')
      const num = parseFloat(cleaned)
      return isNaN(num) ? 0 : num
    }

    return 0
  }

  /**
   * Validate rows
   */
  private async validateRows(
    rows: ParsedRow[],
    companyId: string,
    bankAccountId: number,
    importId?: number
  ): Promise<{ validRows: any[]; invalidRows: ParsedRow[]; validationErrors: any[] }> {
    // Get import record to get file_name for source_file
    let importRecord: any = null
    if (importId) {
      const { data } = await supabase
        .from('bank_statement_imports')
        .select('file_name')
        .eq('id', importId)
        .maybeSingle()
      importRecord = data
    }

    const validRows: any[] = []
    const invalidRows: ParsedRow[] = []
    const validationErrors: any[] = []

    for (const row of rows) {
      try {
        // Skip transaction_date validation for pending rows (they use placeholder date)
        if (!row.is_pending && !row.transaction_date) {
          throw new Error('Transaction date is required')
        }
        if (!row.description) {
          throw new Error('Description is required')
        }

        // Check that either debit_amount or credit_amount is greater than 0
        // This prevents constraint violation for chk_amount_not_both_zero
        const debitAmount = row.debit_amount ?? 0
        const creditAmount = row.credit_amount ?? 0
        if (debitAmount === 0 && creditAmount === 0) {
          throw new Error(`Row ${row.row_number}: Either debit or credit amount must be greater than 0`)
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
        })
      } catch (error: any) {
        invalidRows.push(row)
        validationErrors.push({
          row_number: row.row_number,
          error: error.message,
        })
      }
    }

    return { validRows, invalidRows, validationErrors }
  }

  /**
   * Detect duplicates
   */
  private async detectDuplicates(
    rows: any[],
    companyId: string,
    bankAccountId: number
  ): Promise<BankStatementDuplicate[]> {
    if (rows.length === 0) return []

    const transactions = rows.map(r => ({
      reference_number: r.reference_number,
      transaction_date: r.transaction_date,
      debit_amount: r.debit_amount,
      credit_amount: r.credit_amount,
    }))

    const existingStatements = await this.repository.checkDuplicates(transactions)

    // Use the duplicate detector for more robust matching
    const parsedRows = rows.map(r => ({
      row_number: r.row_number,
      transaction_date: r.transaction_date,
      reference_number: r.reference_number,
      description: r.description,
      debit_amount: r.debit_amount,
      credit_amount: r.credit_amount,
      is_valid: true,
    }))

    return duplicateDetector.detectDuplicates(parsedRows, existingStatements)
  }

  /**
   * Generate preview rows
   */
  private generatePreview(rows: any[], limit: number): BankStatementPreviewRow[] {
    return rows.slice(0, limit).map(row => ({
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
    }))
  }

  /**
   * Generate warnings based on analysis
   */
  private generateWarnings(
    duplicates: BankStatementDuplicate[],
    invalidRows: ParsedRow[]
  ): string[] {
    const warnings: string[] = []

    if (duplicates.length > 0) {
      warnings.push(`Found ${duplicates.length} potential duplicate(s)`)
    }
    if (invalidRows.length > 0) {
      warnings.push(`Found ${invalidRows.length} invalid row(s) that will be skipped`)
    }

    return warnings
  }

  /**
   * Store temporary data in Supabase Storage
   */
  private async storeTemporaryData(importId: number, rows: any[]): Promise<void> {
    try {
      const jsonData = JSON.stringify(rows)
      const { error } = await supabase.storage
        .from('bank-statement-imports-temp')
        .upload(`${importId}.json`, jsonData, {
          contentType: 'application/json',
          upsert: true
        })

      if (error) throw error
      
      logInfo('BankStatementImport: Stored temporary data in Supabase Storage', { importId })
    } catch (error) {
      logError('BankStatementImport: storeTemporaryData error', { importId, error })
      throw error
    }
  }

  /**
   * Retrieve temporary data from Supabase Storage
   */
  private async retrieveTemporaryData(importId: number): Promise<any[]> {
    try {
      const { data, error } = await supabase.storage
        .from('bank-statement-imports-temp')
        .download(`${importId}.json`)

      if (error) throw error

      const text = await data.text()
      return JSON.parse(text)
    } catch (error) {
      logError('BankStatementImport: retrieveTemporaryData error', { importId, error })
      throw new Error('Temporary data not found. Please re-upload the file.')
    }
  }

  /**
   * Clean up temporary data from storage
   */
  private async cleanupTemporaryData(importId: number): Promise<void> {
    try {
      // Check if storage bucket exists first
      const { data: buckets } = await supabase.storage.listBuckets()
      const bucketExists = buckets?.some(b => b.name === 'bank-statement-imports-temp')
      
      if (!bucketExists) {
        logInfo('BankStatementImport: Storage bucket not found, skipping cleanup', { importId })
        return
      }
      
      await supabase.storage
        .from('bank-statement-imports-temp')
        .remove([`${importId}.json`])
      
      logInfo('BankStatementImport: Cleaned up temporary data', { importId })
    } catch (error) {
      logError('BankStatementImport: cleanupTemporaryData error', { importId, error })
      // Non-critical error - don't throw
    }
  }
}

export const bankStatementImportService = (
  repository: BankStatementImportRepository
): BankStatementImportService => {
  return new BankStatementImportService(repository)
}
