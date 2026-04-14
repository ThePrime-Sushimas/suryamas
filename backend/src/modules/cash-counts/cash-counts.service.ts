import { cashCountsRepository } from './cash-counts.repository'
import type {
  CashCount,
  CashCountWithRelations,
  CreateCashCountDto,
  UpdatePhysicalCountDto,
  DepositDto,
  CashCountListQuery,
} from './cash-counts.types'
import {
  CashCountNotFoundError,
  CashCountDuplicatePeriodError,
  CashCountInvalidStatusError,
  CashCountInvalidDateRangeError,
  CashCountDeficitRequiresEmployeeError,
} from './cash-counts.errors'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'
import { AuditService } from '../monitoring/monitoring.service'

export class CashCountsService {
  /**
   * Preview: show all branches x dates with system balance
   * Merges with existing cash_counts if any
   */
  async preview(startDate: string, endDate: string, paymentMethodId: number, companyId: string) {
    if (new Date(endDate) < new Date(startDate)) {
      throw new CashCountInvalidDateRangeError()
    }

    // Get system balance per branch per date
    const rows = await cashCountsRepository.previewByBranchDate(startDate, endDate, paymentMethodId)

    // Get existing cash counts for this period (all branches)
    const existing = await cashCountsRepository.findByPeriod(companyId, startDate, endDate, paymentMethodId)
    // Key: branch_name|start_date
    const existingMap = new Map<string, any>()
    for (const cc of existing) {
      existingMap.set(`${cc.branch_name || ''}|${cc.start_date}`, cc)
    }

    return rows.map((r) => {
      const cc = existingMap.get(`${r.branch_name}|${r.transaction_date}`)
      return {
        branch_name: r.branch_name,
        transaction_date: r.transaction_date,
        system_balance: r.system_balance,
        transaction_count: r.transaction_count,
        cash_count_id: cc?.id || null,
        physical_count: cc?.physical_count ?? null,
        large_denomination: cc?.large_denomination ?? null,
        small_denomination: cc?.small_denomination ?? null,
        difference: cc?.difference ?? null,
        status: cc?.status || null,
        responsible_employee_id: cc?.responsible_employee_id || null,
        deposit_amount: cc?.deposit_amount ?? null,
        deposit_date: cc?.deposit_date || null,
        notes: cc?.notes || null,
      }
    })
  }

  /**
   * Create cash count — auto-calculate system balance from aggregated_transactions
   */
  async create(dto: CreateCashCountDto, companyId: string, userId?: string): Promise<CashCountWithRelations> {
    if (new Date(dto.end_date) < new Date(dto.start_date)) {
      throw new CashCountInvalidDateRangeError()
    }

    // Check duplicate
    const existing = await cashCountsRepository.findDuplicate(
      companyId, dto.start_date, dto.end_date, dto.payment_method_id, dto.branch_name,
    )
    if (existing) throw new CashCountDuplicatePeriodError()

    // Calculate system balance
    const { totalAmount, count, dailyBreakdown } = await cashCountsRepository.calculateSystemBalance(
      companyId, dto.start_date, dto.end_date, dto.payment_method_id, dto.branch_name,
    )

    const cashCount = await cashCountsRepository.create(
      {
        company_id: companyId,
        start_date: dto.start_date,
        end_date: dto.end_date,
        branch_name: dto.branch_name,
        payment_method_id: dto.payment_method_id,
        system_balance: totalAmount,
        transaction_count: count,
        notes: dto.notes,
        created_by: userId,
      },
      dailyBreakdown.map((d) => ({
        transaction_date: d.date,
        amount: d.amount,
        transaction_count: d.count,
      })),
    )

    if (userId) {
      await AuditService.log('CREATE', 'cash_count', cashCount.id, userId, null, cashCount)
    }

    return (await cashCountsRepository.findById(cashCount.id))!
  }

  /**
   * Input physical count (OPEN → COUNTED)
   */
  async updatePhysicalCount(id: string, dto: UpdatePhysicalCountDto, userId?: string): Promise<CashCountWithRelations> {
    const existing = await cashCountsRepository.findById(id)
    if (!existing) throw new CashCountNotFoundError(id)
    if (existing.status !== 'OPEN') {
      throw new CashCountInvalidStatusError(existing.status, 'OPEN')
    }

    const physicalCount = dto.large_denomination + dto.small_denomination
    const diff = physicalCount - existing.system_balance
    if (diff < 0 && !dto.responsible_employee_id) {
      throw new CashCountDeficitRequiresEmployeeError()
    }

    await cashCountsRepository.updatePhysicalCount(
      id,
      dto.large_denomination,
      dto.small_denomination,
      diff < 0 ? (dto.responsible_employee_id || null) : null,
      dto.notes,
      userId,
    )

    if (userId) {
      await AuditService.log('UPDATE', 'cash_count', id, userId,
        { status: 'OPEN', physical_count: null },
        { status: 'COUNTED', large_denomination: dto.large_denomination, small_denomination: dto.small_denomination, physical_count: physicalCount, difference: diff },
      )
    }

    return (await cashCountsRepository.findById(id))!
  }

  /**
   * Record deposit (COUNTED → DEPOSITED)
   */
  async deposit(id: string, dto: DepositDto, userId?: string): Promise<CashCountWithRelations> {
    const existing = await cashCountsRepository.findById(id)
    if (!existing) throw new CashCountNotFoundError(id)
    if (existing.status !== 'COUNTED') {
      throw new CashCountInvalidStatusError(existing.status, 'COUNTED')
    }

    const updated = await cashCountsRepository.updateDeposit(id, dto, userId)

    if (userId) {
      await AuditService.log('UPDATE', 'cash_count', id, userId,
        { status: 'COUNTED' },
        { status: 'DEPOSITED', deposit_amount: dto.deposit_amount, deposit_date: dto.deposit_date },
      )
    }

    return (await cashCountsRepository.findById(id))!
  }

  /**
   * Close cash count (DEPOSITED → CLOSED)
   */
  async close(id: string, userId?: string): Promise<CashCountWithRelations> {
    const existing = await cashCountsRepository.findById(id)
    if (!existing) throw new CashCountNotFoundError(id)
    if (existing.status !== 'DEPOSITED') {
      throw new CashCountInvalidStatusError(existing.status, 'DEPOSITED')
    }

    await cashCountsRepository.close(id, userId)

    if (userId) {
      await AuditService.log('UPDATE', 'cash_count', id, userId,
        { status: 'DEPOSITED' },
        { status: 'CLOSED' },
      )
    }

    return (await cashCountsRepository.findById(id))!
  }

  /**
   * Get by ID
   */
  async getById(id: string): Promise<CashCountWithRelations> {
    const cashCount = await cashCountsRepository.findById(id)
    if (!cashCount) throw new CashCountNotFoundError(id)
    return cashCount
  }

  /**
   * List with pagination
   */
  async list(query: CashCountListQuery, companyId: string) {
    const { page, limit, offset } = getPaginationParams(query as any)
    const { data, total } = await cashCountsRepository.findAll(companyId, { limit, offset }, query)
    return createPaginatedResponse(data, total, page, limit)
  }

  /**
   * Soft delete (only OPEN status)
   */
  async delete(id: string, userId?: string): Promise<void> {
    const existing = await cashCountsRepository.findById(id)
    if (!existing) throw new CashCountNotFoundError(id)
    if (existing.status !== 'OPEN') {
      throw new CashCountInvalidStatusError(existing.status, 'OPEN')
    }

    await cashCountsRepository.softDelete(id)

    if (userId) {
      await AuditService.log('DELETE', 'cash_count', id, userId, existing, null)
    }
  }
}

export const cashCountsService = new CashCountsService()
