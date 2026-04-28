import { pool } from '../../../config/db'
import { logInfo } from '../../../config/logger'
import type { PosImportLine, CreatePosImportLineDto } from './pos-import-lines.types'

// All known columns for pos_import_lines (for insert whitelist)
const LINE_COLUMNS = [
  'pos_import_id', 'row_number', 'sales_number', 'bill_number', 'sales_type',
  'batch_order', 'table_section', 'table_name', 'sales_date', 'sales_date_in',
  'sales_date_out', 'branch', 'brand', 'city', 'area', 'visit_purpose',
  'regular_member_code', 'regular_member_name', 'loyalty_member_code',
  'loyalty_member_name', 'loyalty_member_type', 'employee_code', 'employee_name',
  'external_employee_code', 'external_employee_name', 'customer_name',
  'payment_method', 'menu_category', 'menu_category_detail', 'menu',
  'custom_menu_name', 'menu_code', 'menu_notes', 'order_mode', 'qty', 'price',
  'subtotal', 'discount', 'service_charge', 'tax', 'vat', 'total', 'nett_sales',
  'dpp', 'bill_discount', 'total_after_bill_discount', 'waiter', 'order_time',
] as const

function escapeSearch(s: string): string {
  return s.replace(/[%_\\]/g, '\\$&')
}

export class PosImportLinesRepository {
  async bulkInsert(lines: CreatePosImportLineDto[]): Promise<void> {
    if (lines.length === 0) return

    const BATCH_SIZE = 500
    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batch = lines.slice(i, i + BATCH_SIZE)
      const valueRows: string[] = []
      const params: unknown[] = []
      let idx = 1

      for (const line of batch) {
        const placeholders: string[] = []
        for (const col of LINE_COLUMNS) {
          placeholders.push(`$${idx++}`)
          params.push((line as Record<string, unknown>)[col] ?? null)
        }
        valueRows.push(`(${placeholders.join(', ')})`)
      }

      await pool.query(
        `INSERT INTO pos_import_lines (${LINE_COLUMNS.join(', ')}) VALUES ${valueRows.join(', ')}`,
        params
      )
    }

    logInfo('PosImportLinesRepository bulkInsert success', {
      pos_import_id: lines[0]?.pos_import_id,
      count: lines.length
    })
  }

  async findByImportId(importId: string, page: number = 1, limit: number = 50): Promise<{ data: PosImportLine[]; total: number }> {
    const offset = (page - 1) * limit
    const [dataRes, countRes] = await Promise.all([
      pool.query(
        `SELECT * FROM pos_import_lines WHERE pos_import_id = $1 ORDER BY row_number ASC LIMIT $2 OFFSET $3`,
        [importId, limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total FROM pos_import_lines WHERE pos_import_id = $1`,
        [importId]
      ),
    ])
    return { data: dataRes.rows, total: countRes.rows[0]?.total ?? 0 }
  }

  async findAllByImportId(importId: string): Promise<PosImportLine[]> {
    const CHUNK = 1000
    let offset = 0
    const all: PosImportLine[] = []

    while (true) {
      const { rows } = await pool.query(
        `SELECT * FROM pos_import_lines WHERE pos_import_id = $1 ORDER BY row_number ASC LIMIT $2 OFFSET $3`,
        [importId, CHUNK, offset]
      )
      if (rows.length === 0) break
      all.push(...rows)
      if (rows.length < CHUNK) break
      offset += CHUNK
    }
    return all
  }

  async findExistingTransactions(
    transactions: Array<{ bill_number: string; sales_number: string; sales_date: string }>
  ): Promise<Array<{ bill_number: string; sales_number: string; sales_date: string; pos_import_id: string }>> {
    if (transactions.length === 0) return []

    // Try RPC first
    try {
      const { rows } = await pool.query(
        `SELECT * FROM check_duplicate_transactions($1::jsonb)`,
        [JSON.stringify(transactions)]
      )
      if (rows.length > 0) return rows
    } catch {
      // Fall through to fallback
    }

    // Fallback: fetch by bill_numbers
    const billNumbers = [...new Set(transactions.map(t => t.bill_number))]
    const { rows } = await pool.query(
      `SELECT bill_number, sales_number, sales_date, pos_import_id
       FROM pos_import_lines WHERE bill_number = ANY($1::text[])`,
      [billNumbers]
    )

    const txSet = new Set(transactions.map(t => `${t.bill_number}|${t.sales_number}|${t.sales_date}`))
    return rows.filter(r => txSet.has(`${r.bill_number}|${r.sales_number}|${r.sales_date}`))
  }

  async deleteByImportId(importId: string): Promise<void> {
    await pool.query(`DELETE FROM pos_import_lines WHERE pos_import_id = $1`, [importId])
    logInfo('PosImportLinesRepository deleteByImportId success', { importId })
  }

  async countByImportId(importId: string): Promise<number> {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM pos_import_lines WHERE pos_import_id = $1`,
      [importId]
    )
    return rows[0]?.total ?? 0
  }

  async getSummaryByImportId(importId: string): Promise<{
    totalAmount: number; totalTax: number; totalDiscount: number;
    totalBillDiscount: number; totalAfterBillDiscount: number; transactionCount: number
  }> {
    const { rows } = await pool.query(
      `SELECT
         COALESCE(SUM(total), 0)::float AS total_amount,
         COALESCE(SUM(tax), 0)::float AS total_tax,
         COALESCE(SUM(discount), 0)::float AS total_discount,
         COALESCE(SUM(bill_discount), 0)::float AS total_bill_discount,
         COALESCE(SUM(total_after_bill_discount), 0)::float AS total_after_bill_discount,
         COUNT(*)::int AS transaction_count
       FROM pos_import_lines WHERE pos_import_id = $1`,
      [importId]
    )
    const r = rows[0]
    return {
      totalAmount: r.total_amount,
      totalTax: r.total_tax,
      totalDiscount: r.total_discount,
      totalBillDiscount: r.total_bill_discount,
      totalAfterBillDiscount: r.total_after_bill_discount,
      transactionCount: r.transaction_count,
    }
  }

  async findAllWithFilters(
    companyId: string,
    filters: {
      dateFrom?: string; dateTo?: string; salesNumber?: string; billNumber?: string;
      branches?: string; area?: string; brand?: string; city?: string; menuName?: string;
      paymentMethods?: string; regularMemberName?: string; customerName?: string;
      visitPurpose?: string; salesType?: string; menuCategory?: string;
      menuCategoryDetail?: string; menuCode?: string; customMenuName?: string;
      tableSection?: string; tableName?: string;
    },
    pagination: { page: number; limit: number }
  ): Promise<{
    data: PosImportLine[]; total: number;
    summary: { totalAmount: number; totalTax: number; totalDiscount: number; totalBillDiscount: number; totalAfterBillDiscount: number; totalSubtotal: number; transactionCount: number }
  }> {
    const conditions: string[] = [
      'pi.company_id = $1',
      'pi.is_deleted = false',
    ]
    const values: unknown[] = [companyId]
    let idx = 2

    if (filters.dateFrom) { conditions.push(`pil.sales_date >= $${idx++}`); values.push(filters.dateFrom) }
    if (filters.dateTo) { conditions.push(`pil.sales_date <= $${idx++}`); values.push(filters.dateTo) }
    if (filters.salesNumber) { conditions.push(`pil.sales_number ILIKE $${idx++}`); values.push(`%${escapeSearch(filters.salesNumber)}%`) }
    if (filters.billNumber) { conditions.push(`pil.bill_number ILIKE $${idx++}`); values.push(`%${escapeSearch(filters.billNumber)}%`) }

    if (filters.branches) {
      const branchList = filters.branches.split(',').map(b => b.trim()).filter(Boolean)
      if (branchList.length > 0) {
        const orParts = branchList.map(b => { const p = `$${idx++}`; values.push(`%${escapeSearch(b)}%`); return `pil.branch ILIKE ${p}` })
        conditions.push(`(${orParts.join(' OR ')})`)
      }
    }

    if (filters.area) { conditions.push(`pil.area = $${idx++}`); values.push(filters.area) }
    if (filters.brand) { conditions.push(`pil.brand = $${idx++}`); values.push(filters.brand) }
    if (filters.city) { conditions.push(`pil.city = $${idx++}`); values.push(filters.city) }
    if (filters.menuName) { conditions.push(`pil.menu ILIKE $${idx++}`); values.push(`%${escapeSearch(filters.menuName)}%`) }

    if (filters.paymentMethods) {
      const pmList = filters.paymentMethods.split(',').map(p => p.trim()).filter(Boolean)
      if (pmList.length > 0) {
        const orParts = pmList.map(p => { const ph = `$${idx++}`; values.push(`%${escapeSearch(p)}%`); return `pil.payment_method ILIKE ${ph}` })
        conditions.push(`(${orParts.join(' OR ')})`)
      }
    }

    if (filters.regularMemberName) { conditions.push(`pil.regular_member_name = $${idx++}`); values.push(filters.regularMemberName) }
    if (filters.customerName) { conditions.push(`pil.customer_name ILIKE $${idx++}`); values.push(`%${escapeSearch(filters.customerName)}%`) }
    if (filters.visitPurpose) { conditions.push(`pil.visit_purpose = $${idx++}`); values.push(filters.visitPurpose) }
    if (filters.salesType) { conditions.push(`pil.sales_type = $${idx++}`); values.push(filters.salesType) }
    if (filters.menuCategory) { conditions.push(`pil.menu_category = $${idx++}`); values.push(filters.menuCategory) }
    if (filters.menuCategoryDetail) { conditions.push(`pil.menu_category_detail = $${idx++}`); values.push(filters.menuCategoryDetail) }
    if (filters.menuCode) { conditions.push(`pil.menu_code = $${idx++}`); values.push(filters.menuCode) }
    if (filters.customMenuName) { conditions.push(`pil.custom_menu_name ILIKE $${idx++}`); values.push(`%${escapeSearch(filters.customMenuName)}%`) }
    if (filters.tableSection) { conditions.push(`pil.table_section = $${idx++}`); values.push(filters.tableSection) }
    if (filters.tableName) { conditions.push(`pil.table_name = $${idx++}`); values.push(filters.tableName) }

    const where = `WHERE ${conditions.join(' AND ')}`
    const fromClause = `FROM pos_import_lines pil INNER JOIN pos_imports pi ON pi.id = pil.pos_import_id`
    const offset = (pagination.page - 1) * pagination.limit

    const [dataRes, countRes, summaryRes] = await Promise.all([
      pool.query(
        `SELECT pil.* ${fromClause} ${where}
         ORDER BY pil.sales_date DESC, pil.sales_number DESC
         LIMIT $${idx} OFFSET $${idx + 1}`,
        [...values, pagination.limit, offset]
      ),
      pool.query(
        `SELECT COUNT(*)::int AS total ${fromClause} ${where}`,
        values
      ),
      pool.query(
        `SELECT
           COALESCE(SUM(pil.total), 0)::float AS total_amount,
           COALESCE(SUM(pil.tax), 0)::float AS total_tax,
           COALESCE(SUM(pil.discount), 0)::float AS total_discount,
           COALESCE(SUM(pil.bill_discount), 0)::float AS total_bill_discount,
           COALESCE(SUM(pil.total_after_bill_discount), 0)::float AS total_after_bill_discount,
           COALESCE(SUM(pil.subtotal), 0)::float AS total_subtotal
         ${fromClause} ${where}`,
        values
      ),
    ])

    const total = countRes.rows[0]?.total ?? 0
    const s = summaryRes.rows[0]

    return {
      data: dataRes.rows,
      total,
      summary: {
        totalAmount: s.total_amount,
        totalTax: s.total_tax,
        totalDiscount: s.total_discount,
        totalBillDiscount: s.total_bill_discount,
        totalAfterBillDiscount: s.total_after_bill_discount,
        totalSubtotal: s.total_subtotal,
        transactionCount: total,
      },
    }
  }

  async findExistingBills(
    bills: Array<{ bill_number: string; sales_date: string }>
  ): Promise<Set<string>> {
    if (bills.length === 0) return new Set()

    const billNumbers = [...new Set(bills.map(b => b.bill_number))]
    const requestedKeys = new Set(bills.map(b => `${b.bill_number}|${b.sales_date}`))
    const result = new Set<string>()

    const BATCH = 50
    for (let i = 0; i < billNumbers.length; i += BATCH) {
      const batch = billNumbers.slice(i, i + BATCH)
      const { rows } = await pool.query(
        `SELECT DISTINCT bill_number, sales_date FROM pos_import_lines WHERE bill_number = ANY($1::text[])`,
        [batch]
      )
      for (const row of rows) {
        const key = `${row.bill_number}|${row.sales_date}`
        if (requestedKeys.has(key)) result.add(key)
      }
    }
    return result
  }

  async deleteByBillNumbers(
    bills: Array<{ bill_number: string; sales_date: string }>,
    posImportId: string
  ): Promise<void> {
    if (bills.length === 0) return

    // Batch delete using VALUES list
    const valueRows: string[] = []
    const params: unknown[] = [posImportId]
    let idx = 2

    for (const bill of bills) {
      valueRows.push(`($${idx++}, $${idx++})`)
      params.push(bill.bill_number, bill.sales_date)
    }

    await pool.query(
      `DELETE FROM pos_import_lines
       WHERE pos_import_id = $1
         AND (bill_number, sales_date) IN (VALUES ${valueRows.join(', ')})`,
      params
    )
    logInfo('deleteByBillNumbers success', { count: bills.length, posImportId })
  }

  async findBillImportMapping(billNumbers: string[]): Promise<Array<{ bill_number: string; pos_import_id: string }>> {
    if (billNumbers.length === 0) return []

    const { rows } = await pool.query(
      `SELECT DISTINCT bill_number, pos_import_id FROM pos_import_lines WHERE bill_number = ANY($1::text[])`,
      [billNumbers]
    )
    return rows
  }
}

export const posImportLinesRepository = new PosImportLinesRepository()
