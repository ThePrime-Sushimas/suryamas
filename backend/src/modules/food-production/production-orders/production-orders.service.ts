import { pool } from '../../../config/db'
import { BusinessRuleError } from '../../../utils/errors.base'
import { AuditService } from '../../monitoring/monitoring.service'
import { productionOrdersRepository } from './production-orders.repository'
import { WipRepository } from '../wip/wip.repository'
import {
  ProductionOrderNotFoundError, ProductionOrderNotDraftError,
  ProductionOrderNotCompletedError, ProductionOrderNotVoidableError,
  WasteExceedsActualError, FiscalPeriodClosedError, COANotFoundError,
  OrderNumberCollisionError
} from './production-orders.errors'
import type {
  ProductionOrder, ProductionOrderWithDetails,
  CreateProductionOrderDto, CompleteProductionOrderDto, VoidProductionOrderDto,
  MaterialUsageSummary, DailySummary, ProductionOrderWithBranch
} from './production-orders.types'

const wipRepository = new WipRepository()

class ProductionOrdersService {

  async list(companyId: string, pagination: { page: number; limit: number }, filter?: {
    branch_id?: string; status?: string; date_from?: string; date_to?: string
  }): Promise<{ data: ProductionOrderWithBranch[]; total: number }> {
    const offset = (pagination.page - 1) * pagination.limit
    return productionOrdersRepository.findAll(companyId, { limit: pagination.limit, offset }, filter)
  }

  async getById(id: string, companyId: string): Promise<ProductionOrderWithDetails> {
    const order = await productionOrdersRepository.findById(id, companyId)
    if (!order) throw new ProductionOrderNotFoundError(id)
    return order
  }

  async create(dto: CreateProductionOrderDto): Promise<ProductionOrder> {
    // Validate user has access to the target branch
    if (!dto.created_by) {
      throw new BusinessRuleError('User tidak teridentifikasi')
    }
    const accessCheck = await pool.query(
      `SELECT 1 FROM employee_branches eb
       JOIN employees e ON e.id = eb.employee_id
       WHERE e.user_id = $1 AND eb.branch_id = $2 AND eb.deleted_at IS NULL
       LIMIT 1`,
      [dto.created_by, dto.branch_id]
    )
    if (accessCheck.rows.length === 0) {
      throw new BusinessRuleError('Anda tidak memiliki akses ke cabang ini')
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Generate order number with retry
      const orderNumber = await this.generateOrderNumber(client, dto.company_id, dto.branch_id, dto.production_date)

      // Insert header
      const order = await productionOrdersRepository.insertHeader(client, {
        company_id: dto.company_id,
        branch_id: dto.branch_id,
        order_number: orderNumber,
        production_date: dto.production_date,
        notes: dto.notes,
        created_by: dto.created_by,
      })

      // For each WIP line: snapshot + explode ingredients
      for (let i = 0; i < dto.lines.length; i++) {
        const lineDto = dto.lines[i]
        const wip = await wipRepository.findByIdWithIngredients(lineDto.wip_id, dto.company_id)
        if (!wip) continue

        const line = await productionOrdersRepository.insertLine(client, {
          production_order_id: order.id,
          wip_id: wip.id,
          wip_name: wip.wip_name,
          wip_code: wip.wip_code,
          yield_per_batch: wip.yield_qty,
          uom: wip.uom,
          cost_per_batch: wip.estimated_cost,
          planned_batch_qty: lineDto.planned_batch_qty,
          sort_order: i,
        })

        // Explode ingredients → materials
        for (let j = 0; j < (wip.ingredients?.length || 0); j++) {
          const ingredient = wip.ingredients[j]

          const costPerUnit = ingredient.cost_per_unit > 0
            ? ingredient.cost_per_unit
            : 0 // fallback handled below
          const costSource = ingredient.cost_per_unit > 0
            ? 'wip_ingredient'
            : 'average_cost'

          // If wip_ingredient cost is 0, try products.average_cost
          let finalCost = costPerUnit
          if (finalCost === 0) {
            const prodRes = await client.query(
              `SELECT average_cost FROM products WHERE id = $1`, [ingredient.product_id]
            )
            finalCost = prodRes.rows[0]?.average_cost || 0
          }

          await productionOrdersRepository.insertMaterial(client, {
            production_order_id: order.id,
            production_line_id: line.id,
            product_id: ingredient.product_id,
            product_name: ingredient.product_name || '',
            product_code: ingredient.product_code || '',
            planned_qty: ingredient.qty * lineDto.planned_batch_qty,
            uom: ingredient.uom,
            cost_per_unit: finalCost,
            cost_source: costSource,
            sort_order: j,
          })
        }
      }

      await client.query('COMMIT')

      await AuditService.log('CREATE', 'production_order', order.id, dto.created_by || '', undefined, order)
      return order
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async complete(id: string, companyId: string, dto: CompleteProductionOrderDto): Promise<void> {
    const order = await productionOrdersRepository.findById(id, companyId)
    if (!order) throw new ProductionOrderNotFoundError(id)
    if (order.status !== 'DRAFT') throw new ProductionOrderNotDraftError()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      let totalMaterialCost = 0
      let totalWasteCost = 0

      for (const lineDto of dto.lines) {
        const line = await productionOrdersRepository.getLine(lineDto.id, id)
        if (!line) continue

        const totalYield = lineDto.actual_batch_qty * line.yield_per_batch
        const totalLineCost = lineDto.actual_batch_qty * line.cost_per_batch

        await productionOrdersRepository.updateLine(client, line.id, {
          actual_batch_qty: lineDto.actual_batch_qty,
          total_yield: totalYield,
          total_cost: totalLineCost,
        })

        for (const matDto of lineDto.materials) {
          const mat = await productionOrdersRepository.getMaterial(matDto.id, id)
          if (!mat) continue

          const wasteQty = matDto.waste_qty ?? 0
          if (wasteQty > matDto.actual_qty) {
            throw new WasteExceedsActualError(mat.product_name)
          }

          const totalCost = matDto.actual_qty * mat.cost_per_unit
          const wasteCost = wasteQty * mat.cost_per_unit

          await productionOrdersRepository.updateMaterial(client, mat.id, {
            actual_qty: matDto.actual_qty,
            waste_qty: wasteQty,
            waste_reason: matDto.waste_reason ?? null,
            total_cost: totalCost,
          })

          totalMaterialCost += totalCost
          totalWasteCost += wasteCost
        }
      }

      await productionOrdersRepository.updateHeaderStatus(client, id, {
        status: 'COMPLETED',
        total_material_cost: totalMaterialCost,
        total_waste_cost: totalWasteCost,
        completed_by: dto.user_id,
        completed_at: new Date(),
        updated_by: dto.user_id,
      })

      await client.query('COMMIT')

      await AuditService.log('UPDATE', 'production_order', id, dto.user_id, { status: 'DRAFT' }, { status: 'COMPLETED', totalMaterialCost, totalWasteCost })
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async generateJournal(id: string, companyId: string, userId: string, employeeId?: string): Promise<{ journal_id: string }> {
    const order = await productionOrdersRepository.findById(id, companyId)
    if (!order) throw new ProductionOrderNotFoundError(id)
    if (order.status !== 'COMPLETED') throw new ProductionOrderNotCompletedError()

    // Check fiscal period is open + get period string in one query
    const fpRes = await pool.query(
      `SELECT id, period FROM fiscal_periods
       WHERE company_id = $1 AND is_open = true
         AND period_start <= $2::date AND period_end >= $2::date
       LIMIT 1`,
      [companyId, order.production_date]
    )
    if (fpRes.rows.length === 0) throw new FiscalPeriodClosedError()
    const fiscalPeriod = fpRes.rows[0].period as string

    // Get COA accounts (filter by company_id — ada 2 row per code)
    const getCOA = async (code: string) => {
      const { rows } = await pool.query(
        `SELECT id, account_name FROM chart_of_accounts WHERE company_id = $1 AND account_code = $2 LIMIT 1`,
        [companyId, code]
      )
      if (!rows[0]) throw new COANotFoundError(code)
      return rows[0]
    }

    const bahanBaku = await getCOA('110501')
    const barangDalamProses = await getCOA('110502')
    const selisihHPP = await getCOA('510301')

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      const period = fiscalPeriod

      // Get next sequence
      const seqRes = await client.query(
        `SELECT get_next_journal_sequence($1, $2, 'GENERAL')`,
        [companyId, period]
      )
      const seq = seqRes.rows[0].get_next_journal_sequence
      const journalNumber = `JG-${period}-${String(seq).padStart(4, '0')}`

      const totalDebit = order.total_material_cost
      const productionCost = order.total_material_cost - order.total_waste_cost

      // Insert journal header
      const headerRes = await client.query(
        `INSERT INTO journal_headers (
          company_id, branch_id, journal_number, sequence_number,
          journal_type, journal_date, period, description,
          total_debit, total_credit, currency, exchange_rate,
          status, source_module, reference_type, reference_id, reference_number,
          is_auto, posted_at, created_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'GENERAL', $5, $6, $7, $8, $8, 'IDR', 1,
          'POSTED', 'food_production', 'production_order', $9, $10,
          true, NOW(), $11, NOW(), NOW())
        RETURNING id`,
        [companyId, order.branch_id, journalNumber, seq,
         order.production_date, period,
         `Produksi ${order.production_date} - ${order.branch_name}`,
         totalDebit, order.id, order.order_number, employeeId || null]
      )
      const journalId = headerRes.rows[0].id

      // Insert journal lines
      let lineNum = 1

      // DEBIT: Barang Dalam Proses
      if (productionCost > 0) {
        await client.query(
          `INSERT INTO journal_lines (journal_header_id, line_number, account_id, description, debit_amount, credit_amount, base_debit_amount, base_credit_amount)
           VALUES ($1, $2, $3, $4, $5, 0, $5, 0)`,
          [journalId, lineNum++, barangDalamProses.id, 'Produksi - Barang Dalam Proses', productionCost]
        )
      }

      // DEBIT: Selisih HPP (waste)
      if (order.total_waste_cost > 0) {
        await client.query(
          `INSERT INTO journal_lines (journal_header_id, line_number, account_id, description, debit_amount, credit_amount, base_debit_amount, base_credit_amount)
           VALUES ($1, $2, $3, $4, $5, 0, $5, 0)`,
          [journalId, lineNum++, selisihHPP.id, 'Produksi - Selisih HPP (Waste)', order.total_waste_cost]
        )
      }

      // CREDIT: Bahan Baku
      await client.query(
        `INSERT INTO journal_lines (journal_header_id, line_number, account_id, description, debit_amount, credit_amount, base_debit_amount, base_credit_amount)
         VALUES ($1, $2, $3, $4, 0, $5, 0, $5)`,
        [journalId, lineNum, bahanBaku.id, 'Produksi - Pemakaian Bahan Baku', totalDebit]
      )

      // Update production order with journal link
      await productionOrdersRepository.updateHeaderStatus(client, id, {
        status: 'JOURNALED',
        journal_id: journalId,
        updated_by: userId,
      })

      await client.query('COMMIT')

      await AuditService.log('UPDATE', 'production_order', id, userId, { status: 'COMPLETED' }, { status: 'JOURNALED', journal_id: journalId })
      return { journal_id: journalId }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async voidOrder(id: string, companyId: string, dto: VoidProductionOrderDto): Promise<void> {
    const order = await productionOrdersRepository.findById(id, companyId)
    if (!order) throw new ProductionOrderNotFoundError(id)
    if (order.status === 'VOID') throw new ProductionOrderNotVoidableError()

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // If JOURNALED, reverse the journal
      if (order.status === 'JOURNALED') {
        if (!order.journal_id) {
          // Inconsistent state: JOURNALED but no journal_id — just void without reversal
        } else {
          // Get original journal lines
          const linesRes = await client.query(
            `SELECT account_id, description, debit_amount, credit_amount FROM journal_lines WHERE journal_header_id = $1 ORDER BY line_number`,
            [order.journal_id]
          )

        // Get period
        const periodRes = await client.query(
          `SELECT period FROM journal_headers WHERE id = $1`, [order.journal_id]
        )
        const period = periodRes.rows[0]?.period || ''

        // Get next sequence for reversal
        const seqRes = await client.query(
          `SELECT get_next_journal_sequence($1, $2, 'GENERAL')`, [companyId, period]
        )
        const seq = seqRes.rows[0].get_next_journal_sequence
        const reversalNumber = `JG-${period}-${String(seq).padStart(4, '0')}`

        const totalAmount = order.total_material_cost

        // Create reversal journal
        const revRes = await client.query(
          `INSERT INTO journal_headers (
            company_id, branch_id, journal_number, sequence_number,
            journal_type, journal_date, period, description,
            total_debit, total_credit, currency, exchange_rate,
            status, source_module, reference_type, reference_id, reference_number,
            is_auto, posted_at, created_by, created_at, updated_at, reversal_of_journal_id
          ) VALUES ($1, $2, $3, $4, 'GENERAL', $5, $6, $7, $8, $8, 'IDR', 1,
            'POSTED', 'food_production', 'production_order', $9, $10,
            true, NOW(), $11, NOW(), NOW(), $12)
          RETURNING id`,
          [companyId, order.branch_id, reversalNumber, seq,
           order.production_date, period,
           `[REVERSAL] Produksi ${order.production_date} - ${order.branch_name}`,
           totalAmount, order.id, order.order_number, dto.user_id, order.journal_id]
        )
        const reversalId = revRes.rows[0].id

        // Insert reversed lines (swap debit/credit)
        for (let i = 0; i < linesRes.rows.length; i++) {
          const line = linesRes.rows[i]
          await client.query(
            `INSERT INTO journal_lines (journal_header_id, line_number, account_id, description, debit_amount, credit_amount, base_debit_amount, base_credit_amount)
             VALUES ($1, $2, $3, $4, $5, $6, $5, $6)`,
            [reversalId, i + 1, line.account_id, `[REVERSAL] ${line.description}`, line.credit_amount, line.debit_amount]
          )
        }

        // Mark original as reversed
        await client.query(
          `UPDATE journal_headers SET is_reversed = true, reversed_by_journal_id = $1, reversal_date = NOW(), reversal_reason = $2, updated_at = NOW()
           WHERE id = $3`,
          [reversalId, dto.reason, order.journal_id]
        )
        }
      }

      // Update production order status
      await productionOrdersRepository.updateHeaderStatus(client, id, {
        status: 'VOID',
        voided_by: dto.user_id,
        voided_at: new Date(),
        void_reason: dto.reason,
        updated_by: dto.user_id,
      })

      await client.query('COMMIT')

      await AuditService.log('UPDATE', 'production_order', id, dto.user_id, { status: order.status }, { status: 'VOID', reason: dto.reason })
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    const deleted = await productionOrdersRepository.softDelete(id, companyId, userId)
    if (!deleted) throw new ProductionOrderNotFoundError(id)
    await AuditService.log('DELETE', 'production_order', id, userId)
  }

  async getSummary(companyId: string, dateFrom: string, dateTo: string, branchId?: string): Promise<DailySummary[]> {
    return productionOrdersRepository.getDailySummary(companyId, dateFrom, dateTo, branchId)
  }

  async getMaterialsReport(companyId: string, dateFrom: string, dateTo: string, branchId?: string): Promise<MaterialUsageSummary[]> {
    return productionOrdersRepository.getMaterialsReport(companyId, dateFrom, dateTo, branchId)
  }

  // ─── Private ───

  private async generateOrderNumber(client: import('pg').PoolClient, companyId: string, branchId: string, date: string): Promise<string> {
    // Get branch code
    const branchRes = await client.query(`SELECT branch_code FROM branches WHERE id = $1`, [branchId])
    const branchCode = branchRes.rows[0]?.branch_code || 'XXX'

    const dateStr = date.replace(/-/g, '')
    const prefix = `PRD-${branchCode}-${dateStr}`

    // Retry up to 3 times on collision
    for (let attempt = 0; attempt < 3; attempt++) {
      const last = await productionOrdersRepository.getLastOrderNumber(companyId, prefix)
      const lastSeq = last ? parseInt(last.split('-').pop() || '0') : 0
      const nextSeq = lastSeq + 1 + attempt
      const orderNumber = `${prefix}-${String(nextSeq).padStart(3, '0')}`

      // Check if exists (race condition guard)
      const exists = await client.query(
        `SELECT 1 FROM production_orders WHERE company_id = $1 AND order_number = $2`,
        [companyId, orderNumber]
      )
      if (exists.rows.length === 0) return orderNumber
    }

    throw new OrderNumberCollisionError()
  }
}

export const productionOrdersService = new ProductionOrdersService()
