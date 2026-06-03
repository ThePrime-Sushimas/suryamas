import { cogsRepository } from './cogs.repository'
import type { SalesAggregateRow } from './cogs.repository'
import { CogsCalculationNotFoundError, CogsNoSalesDataError, CogsPeriodNotOpenError } from './cogs.errors'
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
    const periodOpen = await cogsRepository.isFiscalPeriodOpen(companyId, params.period_start, params.period_end)
    if (!periodOpen) throw new CogsPeriodNotOpenError()

    const salesData = await cogsRepository.getSalesAggregate(companyId, params.period_start, params.period_end, params.branch_id)
    if (salesData.length === 0) throw new CogsNoSalesDataError(params.period_start, params.period_end)

    const result = this.buildResult(params.period_start, params.period_end, params.branch_id ?? null, salesData)
    const coaMappings = await this.validateAndGetCoaMappings(companyId, result.summary)
    const existing = await cogsRepository.findExistingForPeriod(companyId, params.period_start, params.period_end, params.branch_id ?? null)

    const journalDate = params.journal_date || params.period_end

    // journalHeadersService.create posts in its own connection/transaction. If markJournaled
    // fails afterward, the journal may exist while cogs_calculations stays unjournaled (same
    // limitation as marketplace-po). Full atomicity needs journal layer to accept PoolClient.
    const { calculation, journal } = await cogsRepository.withTransaction(async (client) => {
      const calc = await cogsRepository.insertCalculation(client, companyId, {
        branch_id: params.branch_id ?? null,
        period_start: params.period_start,
        period_end: params.period_end,
        total_food_cogs: result.summary.total_food_cogs,
        total_beverage_cogs: result.summary.total_beverage_cogs,
        total_other_cogs: result.summary.total_other_cogs,
        total_cogs: result.summary.total_cogs,
        total_revenue: result.summary.total_revenue,
        cogs_percentage: result.summary.cogs_percentage,
        unmapped_menu_count: result.summary.unmapped_menu_count,
        notes: params.notes ?? null,
        created_by: userId,
      })

      if (existing) {
        await cogsRepository.voidAndSupersede(client, existing.id, calc.id)
      }

      await cogsRepository.insertCalculationLines(client, calc.id, result.lines)

      const journalResult = await this.generateJournal(companyId, calc, journalDate, userId, coaMappings)
      await cogsRepository.markJournaled(client, calc.id, journalResult.id)

      return { calculation: calc, journal: journalResult }
    })

    if (existing?.journal_id) {
      try {
        await journalHeadersService.reverseAsUser(existing.journal_id, 'Superseded by COGS re-calculation', userId)
      } catch (err: unknown) {
        logError('Failed to reverse old COGS journal', { journal_id: existing.journal_id, error: err instanceof Error ? err.message : 'Unknown' })
      }
    }

    await AuditService.log('CREATE', 'cogs_calculation', calculation.id, userId, undefined, {
      ...result.summary,
      journal_id: journal.id,
      journal_number: journal.journal_number,
      superseded: existing?.id ?? null,
    })

    return {
      calculation: { ...calculation, status: 'JOURNALED', journal_id: journal.id },
      journal_id: journal.id,
      journal_number: journal.journal_number,
    }
  }

  async getById(id: string, companyIds: string[]): Promise<{ calculation: CogsCalculation; lines: CogsCalculationLine[] }> {
    const calculation = await cogsRepository.findByIdAccessible(id, companyIds)
    if (!calculation) throw new CogsCalculationNotFoundError(id)
    const lines = await cogsRepository.getLines(id)
    return { calculation, lines }
  }

  async void(id: string, companyIds: string[], userId: string): Promise<void> {
    const calculation = await cogsRepository.findByIdAccessible(id, companyIds)
    if (!calculation) throw new CogsCalculationNotFoundError(id)
    if (calculation.status === 'VOID') throw new BusinessRuleError('COGS calculation sudah di-void')

    await cogsRepository.withTransaction(async (client) => {
      // Hard delete the journal if exists
      if (calculation.journal_id) {
        await client.query('DELETE FROM journal_lines WHERE journal_header_id = $1', [calculation.journal_id])
        await client.query('DELETE FROM journal_headers WHERE id = $1', [calculation.journal_id])
      }

      // Void the calculation + clear journal_id
      await client.query('UPDATE cogs_calculations SET status = $1, journal_id = NULL, updated_at = now() WHERE id = $2', ['VOID', id])
    })

    await AuditService.log('UPDATE', 'cogs_calculation', id, userId, { status: calculation.status }, { status: 'VOID' })
  }

  async list(companyIds: string[], pagination: { page: number; limit: number }, filter?: { period_start?: string; period_end?: string; branch_id?: string; status?: string }) {
    const offset = (pagination.page - 1) * pagination.limit
    const { data, total } = await cogsRepository.findAll(companyIds, { limit: pagination.limit, offset }, filter)
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

  private async validateAndGetCoaMappings(companyId: string, summary: CogsPreviewResult['summary']): Promise<CoaMappings> {
    const categories = await cogsRepository.findMenuCategoryCogsMappings(companyId)
    const cogsCoaMap = new Map(categories.map(c => [c.category_code, c.cogs_coa_id]))

    const missing: string[] = []
    if (summary.total_food_cogs > 0 && !cogsCoaMap.get(FOOD_CODE)) missing.push(FOOD_CODE)
    if (summary.total_beverage_cogs > 0 && !cogsCoaMap.get(BEVERAGE_CODE)) missing.push(BEVERAGE_CODE)
    if (summary.total_other_cogs > 0 && !cogsCoaMap.get(OTHER_CODE)) missing.push(OTHER_CODE)

    if (missing.length > 0) {
      throw new BusinessRuleError(`Missing COGS COA mapping for categories: ${missing.join(', ')}. Please set cogs_coa_id in menu_categories.`)
    }

    const inventoryCoaId = await cogsRepository.findInventoryCoaId(companyId, '110505')
    if (!inventoryCoaId) {
      throw new BusinessRuleError('Inventory COA (110505 - Persediaan Cabang) not found. Please create this account first.')
    }

    const validMap = new Map<string, string>()
    for (const [code, coaId] of cogsCoaMap) {
      if (coaId) validMap.set(code, coaId)
    }

    return { cogsCoaMap: validMap, inventoryCoaId }
  }

  private async generateJournal(companyId: string, calculation: CogsCalculation, journalDate: string, userId: string, coaMappings: CoaMappings): Promise<{ id: string; journal_number: string }> {
    const { cogsCoaMap, inventoryCoaId } = coaMappings
    const lines: Array<{ line_number: number; account_id: string; description: string; debit_amount: number; credit_amount: number }> = []
    let lineNum = 0

    const desc = `COGS — ${calculation.period_start} s/d ${calculation.period_end}`

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

    lineNum++
    lines.push({ line_number: lineNum, account_id: inventoryCoaId, description: desc, debit_amount: 0, credit_amount: calculation.total_cogs })

    const journal = await journalHeadersService.create({
      company_id: companyId,
      branch_id: calculation.branch_id ?? undefined,
      journal_date: journalDate,
      journal_type: 'GENERAL',
      description: desc,
      source_module: 'food_production',
      reference_type: 'cogs_calculation',
      lines,
    }, userId)

    // Auto-post: follow full state machine DRAFT → SUBMITTED → APPROVED → POSTED
    try {
      await journalHeadersService.submitAsUser(journal.id, userId)
      await journalHeadersService.approveAsUser(journal.id, userId)
      await journalHeadersService.postAsUser(journal.id, userId)
    } catch (postErr: unknown) {
      // Journal created but stuck in intermediate state — log but don't fail
      logError('COGS journal auto-post failed, journal may need manual posting', {
        journal_id: journal.id, journal_number: journal.journal_number,
        error: postErr instanceof Error ? postErr.message : 'Unknown',
      })
    }

    return { id: journal.id, journal_number: journal.journal_number }
  }
}

export const cogsService = new CogsService()
