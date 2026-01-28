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
  PENDING_TRANSACTION,
} from './bank-statement-import.constants'
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
      // Check for duplicate file
      const existingImport = await this.repository.checkFileHashExists(
        fileResult.file_hash,
        companyId
      )

      if (existingImport) {
        throw BankStatementImportErrors.DUPLICATE_FILE()
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

      // Check for duplicates
      const duplicates = await this.detectDuplicates(
        validRows,
        companyId,
        bankAccountId
      )

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
      })

      // Store temporary data for later processing
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

    // Update import status
    await this.repository.update(importId, {
      status: IMPORT_STATUS.IMPORTING,
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
      const duplicates = await this.detectDuplicates(
        validRows,
        companyId,
        importRecord.bank_account_id
      )

      const duplicateKeys = new Set(
        duplicates.map(d => `${d.transaction_date}-${d.reference_number || ''}-${d.debit_amount}-${d.credit_amount}`)
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
    }
  }> {
    const importRecord = await this.getImportById(importId, companyId)

    if (!importRecord) {
      throw BankStatementImportErrors.IMPORT_NOT_FOUND(importId)
    }

    const summary = await this.repository.getSummaryByImportId(importId)

    return {
      import: importRecord,
      summary: {
        ...summary,
        duplicate_count: 0,
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

    // Delete associated statements
    await this.repository.deleteByImportId(importId)

    // Soft delete import
    await this.repository.delete(importId, userId || '')

    // Clean up temporary data
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

    const rows = await this.retrieveTemporaryData(importId)
    const previewRows = this.generatePreview(
      rows.slice(0, limit).map((r) => ({
        ...r,
        is_valid: true,
        errors: [],
        warnings: [],
      })),
      limit
    )

    return {
      import: importRecord,
      preview_rows: previewRows,
      total_rows: rows.length,
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
      return line.toLowerCase().split(/[,\t]/).map(h => h.trim().replace(/["']/g, ''))
    }

    // Check first few lines for headers
    const headerCandidates = lines.slice(0, 5).map((line, idx) => ({
      line,
      normalized: normalizeHeaders(line),
      index: idx,
    }))

    // Score each format
    const formatScores: Record<BankCSVFormat, { score: number; matchedHeaders: string[] }> = {
      [BANK_CSV_FORMAT.BCA_PERSONAL]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.BCA_BUSINESS]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.BANK_MANDIRI]: { score: 0, matchedHeaders: [] },
      [BANK_CSV_FORMAT.UNKNOWN]: { score: 0, matchedHeaders: [] },
    }

    // Check against known header patterns
    for (const candidate of headerCandidates) {
      const headers = candidate.normalized

      // Check BCA Personal pattern
      const bcaPersonalPattern = BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BCA_PERSONAL]
      const bcaPersonalMatches = bcaPersonalPattern.filter(p => 
        headers.some(h => h.includes(p))
      )
      if (bcaPersonalMatches.length >= 3) {
        formatScores[BANK_CSV_FORMAT.BCA_PERSONAL].score += bcaPersonalMatches.length * 10
        formatScores[BANK_CSV_FORMAT.BCA_PERSONAL].matchedHeaders = bcaPersonalMatches
      }

      // Check BCA Business pattern
      const bcaBusinessPattern = BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BCA_BUSINESS]
      const bcaBusinessMatches = bcaBusinessPattern.filter(p =>
        headers.some(h => h.includes(p))
      )
      if (bcaBusinessMatches.length >= 2) {
        formatScores[BANK_CSV_FORMAT.BCA_BUSINESS].score += bcaBusinessMatches.length * 10
        formatScores[BANK_CSV_FORMAT.BCA_BUSINESS].matchedHeaders = bcaBusinessMatches
      }

      // Check Bank Mandiri pattern
      const mandiriPattern = BANK_HEADER_PATTERNS[BANK_CSV_FORMAT.BANK_MANDIRI]
      const mandiriMatches = mandiriPattern.filter(p =>
        headers.some(h => h.includes(p))
      )
      if (mandiriMatches.length >= 3) {
        formatScores[BANK_CSV_FORMAT.BANK_MANDIRI].score += mandiriMatches.length * 10
        formatScores[BANK_CSV_FORMAT.BANK_MANDIRI].matchedHeaders = mandiriMatches
      }
    }

    // Find best matching format
    for (const [format, data] of Object.entries(formatScores)) {
      if (data.score > highestConfidence) {
        highestConfidence = data.score
        bestFormat = format as BankCSVFormat
      }
    }

    // If no clear match, try content-based detection
    if (bestFormat === BANK_CSV_FORMAT.UNKNOWN) {
      const formatConfig = BANK_CSV_FORMATS[BANK_CSV_FORMAT.BCA_PERSONAL]
      const firstDataLine = lines[1] || ''
      const columns = this.splitCSVLine(firstDataLine, formatConfig.delimiter)

      // BCA Personal typically has 6-7 columns
      if (columns.length >= 6) {
        bestFormat = BANK_CSV_FORMAT.BCA_PERSONAL
        highestConfidence = 50
        warnings.push('Format detected by column count (BCA Personal fallback)')
      }
    }

    // Determine header row and data start row indices dynamically
    // Check if first line is a header or data
    let headerRowIndex = 0
    let dataStartRowIndex = 1
    
    // Search for header row
    for (const candidate of headerCandidates) {
      const headers = candidate.normalized
      // Simple check: if there are bank keywords, it's a header
      const bankKeywords = ['date', 'tanggal', 'desc', 'keterangan', 'debit', 'credit', 'saldo', 'balance']
      const isHeader = bankKeywords.some(keyword => 
        headers.some(h => h.includes(keyword))
      )
      
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

    // Calculate confidence percentage
    const confidence = Math.min(100, highestConfidence)

    if (confidence < 30) {
      warnings.push('Low confidence format detection. Please verify the CSV format.')
    }

    return {
      format: bestFormat,
      confidence,
      headerRowIndex,
      dataStartRowIndex,
      columnMapping,
      detectedHeaders: actualHeaders,
      warnings,
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

      const columns = this.splitCSVLine(line, config.delimiter)
      
      if (columns.length < 4) continue

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
      const description = columns[1]?.trim() || ''
      const branch = columns[2]?.trim() || ''
      const amountRaw = columns[3]?.trim() || ''
      const creditDebit = columns[4]?.trim()?.toUpperCase() || ''
      const balanceRaw = columns[5]?.trim() || ''

      // Check for PEND indicator FIRST - before date parsing
      // Use startsWith to handle cases where there might be extra characters
      const isPending = dateValue.toUpperCase().startsWith(PENDING_TRANSACTION.INDICATOR)

      // Parse date - only if not PEND
      let transactionDate: string | null = null

      if (!isPending) {
        dateValue = dateValue.replace(/^'/, '')
        transactionDate = this.parseDate(dateValue)
        
        if (!transactionDate) {
          logInfo('BankStatementImport: Skipping row with invalid date', { rowNumber, dateValue })
          return null
        }
      } else {
        // For PEND transactions, use current date as placeholder
        transactionDate = new Date().toISOString().split('T')[0]
      }

      // Parse amount
      let debitAmount = 0
      let creditAmount = 0

      const amountClean = amountRaw.replace(/[,\s]/g, '')
      const amountNum = parseFloat(amountClean)

      if (creditDebit.includes('CR') || creditDebit === 'KREDIT') {
        creditAmount = isNaN(amountNum) ? 0 : amountNum
      } else if (creditDebit.includes('DR') || creditDebit === 'DEBIT') {
        debitAmount = isNaN(amountNum) ? 0 : amountNum
      } else if (amountRaw.toUpperCase().includes('CR')) {
        creditAmount = isNaN(amountNum) ? 0 : amountNum
      } else if (amountRaw.toUpperCase().includes('DR')) {
        debitAmount = isNaN(amountNum) ? 0 : amountNum
      }

      const balance = this.parseAmount(balanceRaw)
      const referenceNumber = this.extractReferenceNumber(description)

      return {
        row_number: rowNumber,
        raw_line: rawLine,
        format: BANK_CSV_FORMAT.BCA_PERSONAL,
        transaction_date: transactionDate!,
        reference_number: referenceNumber,
        description: description.substring(0, 1000),
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        balance: balance || undefined,
        is_pending: isPending,
        transaction_type: isPending ? PENDING_TRANSACTION.TRANSACTION_TYPE : undefined,
        raw_data: { columns, branch },
      }
    } catch (error: any) {
      logError('BankStatementImport: Error parsing BCA Personal row', { rowNumber, error: error.message })
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

      const columns = this.parseBusinessCSV(line)

      if (columns.length < 4) continue

      const row = this.parseBCABusinessRow(columns, i + 1, line)
      if (row) rows.push(row)
    }

    return rows
  }

  /**
   * Parse BCA Business CSV line dengan quotes
   */
  private parseBusinessCSV(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
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
   * Parse single BCA Business row
   */
  private parseBCABusinessRow(columns: string[], rowNumber: number, rawLine: string): ParsedCSVRow | null {
    try {
      let dateValue = columns[0]?.trim() || ''
      const description = columns[1]?.trim() || ''
      const branch = columns[2]?.trim() || ''
      const amountRaw = columns[3]?.trim() || ''

      // Check for PEND indicator FIRST - before date parsing
      const isPending = dateValue.toUpperCase() === PENDING_TRANSACTION.INDICATOR

      let transactionDate: string | null = null

      if (!isPending) {
        transactionDate = this.parseDate(dateValue)
        if (!transactionDate) {
          logInfo('BankStatementImport: Skipping BCA Business row with invalid date', { rowNumber, dateValue })
          return null
        }
      } else {
        // For PEND transactions, use current date
        transactionDate = new Date().toISOString().split('T')[0]
      }

      let debitAmount = 0
      let creditAmount = 0

      const amountMatch = amountRaw.match(/^([\d,]+\.?\d*)\s*(CR|DR)?$/i)
      
      if (amountMatch) {
        const amountNum = parseFloat(amountMatch[1].replace(/,/g, ''))
        const indicator = amountMatch[2]?.toUpperCase()

        if (indicator === 'CR') {
          creditAmount = isNaN(amountNum) ? 0 : amountNum
        } else if (indicator === 'DR') {
          debitAmount = isNaN(amountNum) ? 0 : amountNum
        } else {
          creditAmount = isNaN(amountNum) ? 0 : amountNum
        }
      }

      const referenceNumber = this.extractReferenceNumber(description)

      return {
        row_number: rowNumber,
        raw_line: rawLine,
        format: BANK_CSV_FORMAT.BCA_BUSINESS,
        transaction_date: transactionDate!,
        reference_number: referenceNumber,
        description: description.substring(0, 1000),
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        is_pending: isPending,
        transaction_type: isPending ? PENDING_TRANSACTION.TRANSACTION_TYPE : undefined,
        raw_data: { columns, branch },
      }
    } catch (error: any) {
      logError('BankStatementImport: Error parsing BCA Business row', { rowNumber, error: error.message })
      return null
    }
  }

  /**
   * Parse Bank Mandiri format (multi-line)
   */
  private parseBankMandiri(lines: string[], formatDetection: CSVFormatDetectionResult): ParsedCSVRow[] {
    const rows: ParsedCSVRow[] = []
    const dataStartRow = formatDetection.dataStartRowIndex

    let i = dataStartRow
    while (i < lines.length) {
      const line = lines[i].trim()
      
      if (!line) {
        i++
        continue
      }

      const transaction = this.parseMandiriMultiLineTransaction(lines, i)

      if (transaction) {
        const row = this.convertMandiriTransaction(transaction, i + 1)
        if (row) rows.push(row)
        i += transaction.rawLines.length
      } else {
        const singleLineRow = this.parseMandiriSingleLine(line, i + 1)
        if (singleLineRow) {
          rows.push(singleLineRow)
          i++
        } else {
          i++
        }
      }
    }

    return rows
  }

  /**
   * Parse Bank Mandiri multi-line transaction
   */
  private parseMandiriMultiLineTransaction(lines: string[], startIndex: number): {
    postDate: string
    postTime?: string
    remarks: string
    creditAmount: number
    debitAmount: number
    closeBalance: number
    rawLines: string[]
    isPending: boolean
  } | null {
    try {
      const row1 = lines[startIndex]?.trim() || ''
      if (!row1) return null

      const dateMatch = row1.match(/^(\d{2}\/\d{2}\/\d{4})(?:\s+(\d{2}\.\d{2}\.\d{2}))?/)
      
      if (!dateMatch) return null

      const postDate = dateMatch[1]
      const postTime = dateMatch[2]

      const row2 = lines[startIndex + 1]?.trim() || ''
      if (!row2) return null

      const isPending = row2.toUpperCase().startsWith(PENDING_TRANSACTION.INDICATOR)

      const row3 = lines[startIndex + 2]?.trim() || ''
      const row4 = lines[startIndex + 3]?.trim() || ''
      const row5 = lines[startIndex + 4]?.trim() || ''

      const parseMandiriAmount = (val: string): number => {
        const cleaned = val.replace(/[,\s]/g, '')
        const num = parseFloat(cleaned)
        return isNaN(num) ? 0 : num
      }

      let creditAmount = 0
      let debitAmount = 0

      if (row3) {
        if (row3.toUpperCase().includes('CR') || row3.toUpperCase().includes('KR')) {
          creditAmount = parseMandiriAmount(row3)
        } else if (!row3.toUpperCase().includes('DR') && !row3.toUpperCase().includes('DB')) {
          creditAmount = parseMandiriAmount(row3)
        }
      }

      if (row4) {
        if (row4.toUpperCase().includes('DR') || row4.toUpperCase().includes('DB')) {
          debitAmount = parseMandiriAmount(row4)
        } else if (!row4.toUpperCase().includes('CR') && !row4.toUpperCase().includes('KR')) {
          debitAmount = parseMandiriAmount(row4)
        }
      }

      const closeBalance = parseMandiriAmount(row5)

      return {
        postDate,
        postTime,
        remarks: row2,
        creditAmount,
        debitAmount,
        closeBalance,
        rawLines: [row1, row2, row3 || '', row4 || '', row5 || ''],
        isPending,
      }
    } catch (error: any) {
      logError('BankStatementImport: Error parsing Mandiri multi-line', { startIndex, error: error.message })
      return null
    }
  }

  /**
   * Parse Bank Mandiri single line (fallback)
   */
  private parseMandiriSingleLine(line: string, rowNumber: number): ParsedCSVRow | null {
    try {
      const parts = line.split(/\s+/).filter(p => p.trim())

      if (parts.length < 3) return null

      const dateIndex = parts.findIndex(p => /^\d{2}\/\d{2}\/\d{4}$/.test(p))
      
      if (dateIndex < 0) return null

      const dateValue = parts[dateIndex]
      const description = parts.slice(dateIndex + 1).join(' ')

      // Check for PEND indicator
      const isPending = description.toUpperCase().startsWith(PENDING_TRANSACTION.INDICATOR)

      const amounts = parts
        .slice(dateIndex + 1)
        .filter(p => /^[-\d,]+\.?\d*$/.test(p.replace(/,/g, '')))
        .map(p => parseFloat(p.replace(/,/g, '')))

      let creditAmount = 0
      let debitAmount = 0

      if (amounts.length >= 1) {
        if (amounts.length >= 2) {
          const transactionAmount = amounts[amounts.length - 2]
          
          if (description.toUpperCase().includes('DR') || description.toUpperCase().includes('DEBIT')) {
            debitAmount = transactionAmount
          } else {
            creditAmount = transactionAmount
          }
        }
      }

      const transactionDate = this.parseDate(dateValue)
      if (!transactionDate) return null

      return {
        row_number: rowNumber,
        raw_line: line,
        format: BANK_CSV_FORMAT.BANK_MANDIRI,
        transaction_date: transactionDate,
        description: description.substring(0, 1000),
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        is_pending: isPending,
        transaction_type: isPending ? PENDING_TRANSACTION.TRANSACTION_TYPE : undefined,
        raw_data: { parts, amounts },
      }
    } catch (error: any) {
      return null
    }
  }

  /**
   * Convert Mandiri transaction to ParsedCSVRow
   */
  private convertMandiriTransaction(
    transaction: {
      postDate: string
      postTime?: string
      remarks: string
      creditAmount: number
      debitAmount: number
      closeBalance: number
      rawLines: string[]
      isPending: boolean
    },
    rowNumber: number
  ): ParsedCSVRow {
    const transactionDate = this.parseDate(transaction.postDate) || new Date().toISOString().split('T')[0]

    return {
      row_number: rowNumber,
      raw_line: transaction.rawLines.join('\n'),
      format: BANK_CSV_FORMAT.BANK_MANDIRI,
      transaction_date: transactionDate,
      transaction_time: transaction.postTime?.replace(/\./g, ':'),
      description: transaction.remarks.substring(0, 1000),
      debit_amount: transaction.debitAmount,
      credit_amount: transaction.creditAmount,
      balance: transaction.closeBalance,
      is_pending: transaction.isPending,
      transaction_type: transaction.isPending ? PENDING_TRANSACTION.TRANSACTION_TYPE : undefined,
      raw_data: { rawLines: transaction.rawLines },
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
      throw BankStatementImportErrors.INVALID_DATE_FORMAT(columnMapping.transaction_date)
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
      const isoDate = new Date(value)
      if (!isNaN(isoDate.getTime())) {
        return isoDate.toISOString().split('T')[0]
      }

      const dmyMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
      if (dmyMatch) {
        const [, day, month, year] = dmyMatch
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
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

        validRows.push({
          company_id: companyId,
          bank_account_id: bankAccountId,
          transaction_date: row.transaction_date,
          transaction_time: row.transaction_time,
          reference_number: row.reference_number,
          description: row.description,
          debit_amount: row.debit_amount,
          credit_amount: row.credit_amount,
          balance: row.balance,
          import_id: importId,
          row_number: row.row_number,
          is_pending: row.is_pending,
          transaction_type: row.transaction_type,
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

    const duplicates: BankStatementDuplicate[] = []

    for (const row of rows) {
      for (const existing of existingStatements) {
        const isMatch =
          row.transaction_date === existing.transaction_date &&
          row.debit_amount === existing.debit_amount &&
          row.credit_amount === existing.credit_amount &&
          (row.reference_number === existing.reference_number || !row.reference_number)

        if (isMatch) {
          duplicates.push({
            reference_number: row.reference_number,
            transaction_date: row.transaction_date,
            debit_amount: row.debit_amount,
            credit_amount: row.credit_amount,
            existing_import_id: existing.import_id || 0,
            existing_statement_id: existing.id,
            row_numbers: [row.row_number],
          })
        }
      }
    }

    const uniqueDuplicates = duplicates.filter((dup, index, self) =>
      index === self.findIndex(d =>
        d.transaction_date === dup.transaction_date &&
        d.debit_amount === dup.debit_amount &&
        d.credit_amount === dup.credit_amount &&
        d.reference_number === dup.reference_number
      )
    )

    return uniqueDuplicates
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
   * Store temporary data for processing
   */
  private async storeTemporaryData(importId: number, rows: any[]): Promise<void> {
    const tempPath = path.join(this.TEMP_DIR, `import-${importId}.json`)
    await fs.writeFile(tempPath, JSON.stringify(rows))
  }

  /**
   * Retrieve temporary data
   */
  private async retrieveTemporaryData(importId: number): Promise<any[]> {
    const tempPath = path.join(this.TEMP_DIR, `import-${importId}.json`)
    const data = await fs.readFile(tempPath, 'utf-8')
    return JSON.parse(data)
  }

  /**
   * Clean up temporary data
   */
  private async cleanupTemporaryData(importId: number): Promise<void> {
    const tempPath = path.join(this.TEMP_DIR, `import-${importId}.json`)
    try {
      await fs.unlink(tempPath)
    } catch {
      // Ignore if file doesn't exist
    }
  }
}

export const bankStatementImportService = (
  repository: BankStatementImportRepository
): BankStatementImportService => {
  return new BankStatementImportService(repository)
}

