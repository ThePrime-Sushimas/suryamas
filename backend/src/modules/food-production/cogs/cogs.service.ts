import { pool } from '../../../config/db'
import type { PoolClient } from 'pg'
import { cogsRepository } from './cogs.repository'
import type { SalesAggregateRow } from './cogs.repository'
import { CogsCalculationNotFoundError, CogsNoSalesDataError, CogsAlreadyJournaledError, CogsPeriodNotOpenError } from './cogs.errors'
import { journalHeadersService } from '../../accounting/journals/journal-headers/journal-headers.service'
import { AuditService } from '../../monitoring/monitoring.service'
import { logError } from '../../../config/logger'
import type { CogsPreviewResult, CogsCalculateParams, CogsFinalizeParams, CogsCalculation, CogsCalculationLine } from './cogs.types'
import { BusinessRuleError } from '../../../utils/errors.base'

// Compare by category_code (stable) not category_name (can be renamed)
const FOOD_CODE = 'FOOD'
const BEVERAGE_CODE = 'BEVERAGE'
const OTHER_CODE = 'OTHER'

interface CoaMappings {
  cogsCoaMap: Map<string, string>
  inventoryCoaId: string
}

export class CogsService {
  /**
   * Preview mode: calculate COGS without persisting.
   */
  async preview(companyId: string, params: CogsCalculateParams): Promise<CogsPreviewResult> {
    const salesData = await cogsRepository.getSalesAggregate(companyId, params.period_start, params.period_end, params.branch_id)
    return this.buildResult(params.period_start, params.period_end, params.branch_id ?? null, salesData)
  }

  /**
   * Finalize: calculate, persist to cogs_calculations, generate journal.
   * All DB writes are wrapped in a single transaction.
   */
  async finalize(companyId: string, params: CogsFinalizeParams, userId: string): Promise<{ calculation: CogsCalculation; journal_id: string; journal_number: string }> {
    // Pre-checks (read-only, outside transaction)
    const periodOpen = await this.isFiscalPeriodOpen(companyId, params.period_start, params.period_end)
    if (!periodOpen) throw new CogsPeriodNotOpenError()

    const salesData = await cogsRepository.getSalesAggregate(companyId, params.period_start, params.period_end, params.branch_id)
    if (salesData.length === 0) throw new CogsNoSalesDataError(params.period_start, params.period_end)

    const result = this.buildResult(params.period_start, params.period_end, params.branch_id ?? null, salesData)

    // Validate and get COA mappings (single query, reused in generateJournal)
    const coaMappings = await this.validateAndGetCoaMappings(companyId, result.summary)

    // Check existing record for supersede
    const existing = await cogsRepository.findExistingForPeriod(companyId, params.period_start, params.period_end, params.branch_id ?? null)

    // === Transaction: all writes atomic ===
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Save calculation
      const { rows: [calcRow] } = await client.query(
        `INSERT INTO cogs_calculations
         (company_id, branch_id, period_start, period_end, total_food_cogs, total_beverage_cogs, total_other_cogs, total_cogs, total_revenue, cogs_percentage, unmapped_menu_count, notes, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [companyId, params.branch_id ?? null, params.period_start, params.period_end, result.summary.total_food_cogs, result.summary.total_beverage_cogs, result.summary.total_other_cogs, result.summary.total_cogs, result.summary.total_revenue, result.summary.cogs_percentage, result.summary.unmapped_menu_count, params.notes ?? null, userId]
      )
      const calculation = calcRow as CogsCalculation

      // 2. Supersede old record (always set VOID regardless of journal_id)
      if (existing) {
        await client.query('UPDATE cogs_calculations SET superseded_by = $1, status = $2 WHERE id = $3', [calculation.id, 'VOID', existing.id])
      }

      // 3. Save lines (chunked for param safety)
      await this.saveLinesBatch(client, calculation.id, result.lines)

      // 4. Generate journal
      const journalDate = params.journal_date || params.period_end
      const journal = await this.generateJournal(companyId, calculation, journalDate, userId, coaMappings)

      // 5. Update status
      await client.query('UPDATE cogs_calculations SET status = $1, journal_id = $2 WHERE id = $3', ['JOURNALED', journal.id, calculation.id])

      await client.query('COMMIT')

      // Post-commit: reverse old journal (outside transaction — journal service has its own)
      if (existing?.journal_id) {
        try {
          await journalHeadersService.reverse(existing.journal_id, 'Superseded by COGS re-calculation', userId, companyId)
        } catch (err: unknown) {
          // Log but don't fail — new journal is already created. Old journal can be manually reversed.
          logError('Failed to reverse old COGS journal', { journal_id: existing.journal_id, error: err instanceof Error ? err.message : 'Unknown' })
        }
      }

      await AuditService.log('CREATE', 'cogs_calculation', calculation.id, userId, undefined, {
        ...result.summary,
        journal_id: journal.id,
        journal_number: journal.journal_number,
        superseded: existing?.id ?? null,
      })

      return { calculation: { ...calculation, status: 'JOURNALED', journal_id: journal.id }, journal_id: journal.id, journal_number: journal.journal_number }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async getById(id: string, companyId: string): Promise<{ calculation: CogsCalculation; lines: CogsCalculationLine[] }> {
    const calculation = await cogsRepository.findById(id, companyId)
    if (!calculation) throw new CogsCalculationNotFoundError(id)
    const lines = await cogsRepository.getLines(id)
    return { calculation, lines }
  }

  async list(companyId: string, pagination: { page: number; limit: number }, filter?: { period_start?: string; period_end?: string; branch_id?: string; status?: string }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await cogsRepository.findAll(companyId, { limit: pagination.limit, offset }, filter)
    const totalPages = Math.ceil(total / pagination.limit)
    return { data, pagination: { page: pagination.page, limit: pagination.limit, total, totalPages, hasNext: pagination.page < totalPages, hasPrev: pagination.page > 1 } }
  }

  // ── Private ──

  private buildResult(periodStart: string, periodEnd: string, branchId: string | null, salesData: SalesAggregateRow[]): CogsPreviewResult {
    let totalFoodCogs = 0, totalBeverageCogs = 0, totalOtherCogs = 0
    let totalRevenue = 0, unmappedCount = 0

    const lines: CogsPreviewResult['lines'] = salesData.map(row => {
      const costPerUnit = Number(row.estimated_cost) || 0
      const qtySold = Number(row.qty_sold) || 0
      const totalCogs = qtySold * costPerUnit
      const revenue = Number(row.revenue) || 0
      const cogsPct = revenue > 0 ? Number(((totalCogs / revenue) * 100).toFixed(2)) : 0

      if (row.category_code === FOOD_CODE) totalFoodCogs += totalCogs
      else if (row.category_code === BEVERAGE_CODE) totalBeverageCogs += totalCogs
      else totalOtherCogs += totalCogs

      totalRevenue += revenue
      // "unmapped" = menu without recipe (includes menus not in menus table at all)
      if (!row.has_recipe) unmappedCount++

      return {
        menu_id: row.internal_menu_id,
        menu_name: row.menu_name,
        category_name: row.category_name,
        qty_sold: qtySold,
        cost_per_unit: costPerUnit,
        total_cogs: totalCogs,
        revenue,
        cogs_percentage: cogsPct,
        has_recipe: row.has_recipe,
      }
    })

    const totalCogs = totalFoodCogs + totalBeverageCogs + totalOtherCogs
    const cogsPct = totalRevenue > 0 ? Number(((totalCogs / totalRevenue) * 100).toFixed(2)) : 0

    return {
      period_start: periodStart,
      period_end: periodEnd,
      branch_id: branchId,
      summary: {
        total_food_cogs: totalFoodCogs,
        total_beverage_cogs: totalBeverageCogs,
        total_other_cogs: totalOtherCogs,
        total_cogs: totalCogs,
        total_revenue: totalRevenue,
        cogs_percentage: cogsPct,
        unmapped_menu_count: unmappedCount,
        total_menus_sold: salesData.length,
      },
      lines,
    }
  }

  /**
   * Validate COA mappings exist and return them for reuse in generateJournal.
   * Single query — no race window between validate and generate.
   */
  private async validateAndGetCoaMappings(companyId: string, summary: CogsPreviewResult['summary']): Promise<CoaMappings> {
    const { rows: categories } = await pool.query(
      `SELECT category_code, cogs_coa_id FROM menu_categories WHERE company_id = $1 AND deleted_at IS NULL`,
      [companyId]
    )
    const cogsCoaMap = new Map(categories.map((c: { category_code: string; cogs_coa_id: string | null }) => [c.category_code, c.cogs_coa_id]))

    const missing: string[] = []
    if (summary.total_food_cogs > 0 && !cogsCoaMap.get(FOOD_CODE)) missing.push(FOOD_CODE)
    if (summary.total_beverage_cogs > 0 && !cogsCoaMap.get(BEVERAGE_CODE)) missing.push(BEVERAGE_CODE)
    if (summary.total_other_cogs > 0 && !cogsCoaMap.get(OTHER_CODE)) missing.push(OTHER_CODE)

    if (missing.length > 0) {
      throw new BusinessRuleError(`Missing COGS COA mapping for categories: ${missing.join(', ')}. Please set cogs_coa_id in menu_categories.`)
    }

    const { rows: [invCoa] } = await pool.query(
      `SELECT id FROM chart_of_accounts WHERE company_id = $1 AND account_code = '110501' AND deleted_at IS NULL`,
      [companyId]
    )
    if (!invCoa) {
      throw new BusinessRuleError('Inventory COA (110501 - Bahan Baku) not found. Please create this account first.')
    }

    // Cast to non-null map (validated above)
    const validMap = new Map<string, string>()
    for (const [code, coaId] of cogsCoaMap) {
      if (coaId) validMap.set(code, coaId)
    }

    return { cogsCoaMap: validMap, inventoryCoaId: invCoa.id }
  }

  private async generateJournal(companyId: string, calculation: CogsCalculation, journalDate: string, userId: string, coaMappings: CoaMappings): Promise<{ id: string; journal_number: string }> {
    const { cogsCoaMap, inventoryCoaId } = coaMappings
    const lines: Array<{ line_number: number; account_id: string; description: string; debit_amount: number; credit_amount: number }> = []
    let lineNum = 0

    const desc = `COGS — ${calculation.period_start} s/d ${calculation.period_end}`

    // Debit lines per category
    if (calculation.total_food_cogs > 0) {
      lineNum++
      lines.push({ line_number: lineNum, account_id: cogsCoaMap.get(FOOD_CODE)!, description: `${desc} — Makanan`, debit_amount: calculation.total_food_cogs, credit_amount: 0 })
    }
    if (calculation.total_beverage_cogs > 0) {
      lineNum++
      lines.push({ line_number: lineNum, account_id: cogsCoaMap.get(BEVERAGE_CODE)!, description: `${desc} — Minuman`, debit_amount: calculation.total_beverage_cogs, credit_amount: 0 })
    }
    if (calculation.total_other_cogs > 0) {
      lineNum++
      lines.push({ line_number: lineNum, account_id: cogsCoaMap.get(OTHER_CODE)!, description: `${desc} — Lainnya`, debit_amount: calculation.total_other_cogs, credit_amount: 0 })
    }

    // Credit line: Bahan Baku (total)
    lineNum++
    lines.push({ line_number: lineNum, account_id: inventoryCoaId, description: desc, debit_amount: 0, credit_amount: calculation.total_cogs })

    const journal = await journalHeadersService.create({
      company_id: companyId,
      journal_date: journalDate,
      journal_type: 'GENERAL',
      description: desc,
      source_module: 'food_production',
      reference_type: 'cogs_calculation',
      lines,
    }, userId)

    return { id: journal.id, journal_number: journal.journal_number }
  }

  /**
   * Save calculation lines in chunks to avoid PostgreSQL parameter limit.
   * Uses client for transaction participation.
   */
  private async saveLinesBatch(client: PoolClient, calculationId: string, lines: CogsPreviewResult['lines']): Promise<void> {
    const CHUNK_SIZE = 500
    for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
      const chunk = lines.slice(i, i + CHUNK_SIZE)
      if (chunk.length === 0) continue

      const valueRows: string[] = []
      const params: unknown[] = []
      let idx = 1

      for (const l of chunk) {
        valueRows.push(`($${idx}, $${idx + 1}, $${idx + 2}, $${idx + 3}, $${idx + 4}, $${idx + 5}, $${idx + 6}, $${idx + 7}, $${idx + 8}, $${idx + 9})`)
        params.push(calculationId, l.menu_id, l.menu_name, l.category_name, l.qty_sold, l.cost_per_unit, l.total_cogs, l.revenue, l.cogs_percentage, l.has_recipe)
        idx += 10
      }

      await client.query(
        `INSERT INTO cogs_calculation_lines (calculation_id, menu_id, menu_name, category_name, qty_sold, cost_per_unit, total_cogs, revenue, cogs_percentage, has_recipe)
         VALUES ${valueRows.join(', ')}`,
        params
      )
    }
  }

  private async isFiscalPeriodOpen(companyId: string, periodStart: string, periodEnd: string): Promise<boolean> {
    const { rows } = await pool.query(
      `SELECT id FROM fiscal_periods
       WHERE company_id = $1 AND is_open = true
         AND period_start <= $2::date AND period_end >= $3::date
       LIMIT 1`,
      [companyId, periodStart, periodEnd]
    )
    return rows.length > 0
  }
}

export const cogsService = new CogsService()
