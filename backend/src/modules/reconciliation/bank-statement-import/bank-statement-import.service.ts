/**
 * Bank Statement Import Service
 * Handles business logic untuk bank statement import operations
 */

import { supabase } from '../../../config/supabase'
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
} from './bank-statement-import.types'
import { 
  BankStatementImportErrors, 
  BankStatementImportConfig 
} from './bank-statement-import.errors'
import { IMPORT_STATUS } from './bank-statement-import.constants'
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

      // Parse Excel file
      const { rows, columnMapping } = await this.parseExcelFile(
        fileResult.file_path
      )

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
        type: 'BANK_STATEMENT_IMPORT',
        module: 'bank_statements',
        status: 'PENDING',
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

  // ==================== PRIVATE METHODS ====================

  /**
   * Parse Excel file
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
    const mapping: Record<string, string> = {}
    const normalizedHeaders = headers.map(h => h?.toLowerCase().trim().replace(/\s+/g, '_'))

    const columnVariations: Record<string, string[]> = {
      transaction_date: ['tanggal', 'date', 'tgl', 'transaction_date', 'trx_date', 'tanggal_transaksi'],
      transaction_time: ['waktu', 'time', 'jam', 'transaction_time', 'waktu_transaksi'],
      reference_number: ['referensi', 'reference', 'ref', 'no_ref', 'ref_number', 'nomor_referensi'],
      description: ['keterangan', 'description', 'desc', 'memo', 'keterangan_transaksi'],
      debit_amount: ['debit', 'debet', 'keluar', 'withdrawal', 'pengeluaran'],
      credit_amount: ['kredit', 'credit', 'masuk', 'deposit', 'pemasukan'],
      balance: ['saldo', 'balance', 'saldo_akhir'],
    }

    Object.entries(columnVariations).forEach(([key, variations]) => {
      const matchIndex = normalizedHeaders.findIndex(h =>
        variations.some(v => h?.includes(v))
      )

      if (matchIndex !== -1) {
        mapping[key] = headers[matchIndex]
      }
    })

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
        if (!row.transaction_date) {
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

