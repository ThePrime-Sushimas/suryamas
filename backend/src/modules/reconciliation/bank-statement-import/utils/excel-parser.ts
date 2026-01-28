/**
 * Excel Parser Utility
 * Handles parsing Excel files with various bank statement formats
 */

import * as XLSX from 'xlsx'
import { logWarn, logError } from '@/config/logger'
import { COLUMN_MAPPINGS } from '../constants'
import type { 
  ParsedBankStatementRow, 
  ExcelColumnMapping, 
  BankStatementPreviewRow 
} from '../types'

/**
 * Excel Parser Utility Class
 */
export class ExcelParser {
  private readonly requiredColumns = ['transaction_date', 'description']

  /**
   * Detect column mapping from Excel headers
   */
  detectColumnMapping(headers: string[]): ExcelColumnMapping {
    const mapping: Partial<ExcelColumnMapping> = {}
    const normalizedHeaders = headers.map((h) => 
      h?.toLowerCase().trim().replace(/\s+/g, '_')
    )

    // Match columns
    Object.entries(COLUMN_MAPPINGS).forEach(([key, variations]) => {
      const matchIndex = normalizedHeaders.findIndex((h) =>
        variations.some((v) => h?.includes(v))
      )

      if (matchIndex !== -1) {
        mapping[key as keyof ExcelColumnMapping] = headers[matchIndex]
      }
    })

    // Validate required columns
    if (!mapping.transaction_date) {
      throw new Error('Column "Tanggal" (transaction_date) not found')
    }
    if (!mapping.description) {
      throw new Error('Column "Keterangan" (description) not found')
    }
    if (!mapping.debit_amount && !mapping.credit_amount) {
      throw new Error('At least one amount column (Debit or Kredit) required')
    }

    return mapping as ExcelColumnMapping
  }

  /**
   * Parse Excel file to array of rows
   */
  parseExcelFile(filePath: string): { rows: ParsedBankStatementRow[]; mapping: ExcelColumnMapping } {
    const workbook = XLSX.readFile(filePath)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: null })

    if (rawData.length === 0) {
      throw new Error('Excel file is empty')
    }

    const headers = Object.keys(rawData[0])
    const mapping = this.detectColumnMapping(headers)

    const rows: ParsedBankStatementRow[] = rawData.map((row, index) => ({
      row_number: index + 2,
      transaction_date: this.extractValue(row, mapping.transaction_date),
      transaction_time: mapping.transaction_time ? this.extractValue(row, mapping.transaction_time) : undefined,
      reference_number: mapping.reference_number ? this.extractValue(row, mapping.reference_number) : undefined,
      description: this.extractValue(row, mapping.description),
      debit_amount: mapping.debit_amount ? this.extractValue(row, mapping.debit_amount) : 0,
      credit_amount: mapping.credit_amount ? this.extractValue(row, mapping.credit_amount) : 0,
      balance: mapping.balance ? this.extractValue(row, mapping.balance) : undefined,
      transaction_type: mapping.transaction_type ? this.extractValue(row, mapping.transaction_type) : undefined,
      is_valid: true, // Will be validated later
      errors: [],
    }))

    return { rows, mapping }
  }

  /**
   * Extract and clean value from row
   */
  private extractValue(row: any, columnName?: string): any {
    if (!columnName) return null
    
    let value = row[columnName]
    
    if (value === null || value === undefined || value === '') {
      return null
    }

    if (typeof value === 'string') {
      value = value.trim()
      if (value === '') return null
      
      if (/^[\d,.\s]+$/.test(value)) {
        value = value.replace(/[,\s]/g, '')
        const numValue = parseFloat(value)
        return isNaN(numValue) ? value : numValue
      }
    }

    return value
  }

  /**
   * Parse date from various formats
   */
  parseDate(value: any): Date | null {
    if (!value) return null

    if (value instanceof Date) return value

    if (typeof value === 'string') {
      const isoDate = new Date(value)
      if (!isNaN(isoDate.getTime())) return isoDate

      const dmyMatch = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
      if (dmyMatch) {
        const [, day, month, year] = dmyMatch
        return new Date(`${year}-${month}-${day}`)
      }
    }

    if (typeof value === 'number') {
      return XLSX.SSF.parse_date_code(value)
    }

    return null
  }

  /**
   * Parse amount (handle various number formats)
   */
  parseAmount(value: any): number {
    if (value === null || value === undefined) return 0

    if (typeof value === 'number') return value

    if (typeof value === 'string') {
      const cleaned = value.replace(/[Rp$€£¥,\s]/g, '')
      const num = parseFloat(cleaned)
      return isNaN(num) ? 0 : num
    }

    return 0
  }

  /**
   * Create preview row for UI display
   */
  createPreviewRow(row: ParsedBankStatementRow, isValid: boolean, errors: string[] = []): BankStatementPreviewRow {
    return {
      row_number: row.row_number,
      transaction_date: String(row.transaction_date || ''),
      transaction_time: row.transaction_time,
      reference_number: row.reference_number,
      description: String(row.description || ''),
      debit_amount: this.parseAmount(row.debit_amount),
      credit_amount: this.parseAmount(row.credit_amount),
      balance: row.balance ? this.parseAmount(row.balance) : undefined,
      is_valid: isValid,
      errors,
      warnings: [],
    }
  }

  /**
   * Generate preview rows (first N rows)
   */
  generatePreview(rows: ParsedBankStatementRow[], maxPreviewRows: number = 10): BankStatementPreviewRow[] {
    return rows.slice(0, maxPreviewRows).map(row => this.createPreviewRow(row, true))
  }
}

// Export singleton instance
export const excelParser = new ExcelParser()
