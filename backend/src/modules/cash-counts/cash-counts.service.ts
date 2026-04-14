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
   * Create cash count — auto-calculate system balance from aggregated_transactions
   */
  async create(dto: CreateCashCountDto, companyId: string, userId?: string): Promise<CashCountWithRelations> {
    if (new Date(dto.end_date) < new Date(dto.start_date)) {
      throw new CashCountInvalidDateRangeError()
    }

    // Check duplicate
    const existing = await cashCountsRepository.findDuplicate(
      companyId, dto.start_date, dto.end_date, dto.payment_method_id, dto.branch_id,
    )
    if (existing) throw new CashCountDuplicatePeriodError()

    // Calculate system balance
    const { totalAmount, count, dailyBreakdown } = await cashCountsRepository.calculateSystemBalance(
      companyId, dto.start_date, dto.end_date, dto.payment_method_id, dto.branch_id,
    )

    const cashCount = await cashCountsRepository.create(
      {
        company_id: companyId,
        start_date: dto.start_date,
        end_date: dto.end_date,
        branch_id: dto.branch_id,
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

    // Check deficit accountability
    const diff = dto.physical_count - existing.system_balance
    if (diff < 0 && !dto.responsible_employee_id) {
      throw new CashCountDeficitRequiresEmployeeError()
    }

    const updated = await cashCountsRepository.updatePhysicalCount(
      id,
      dto.physical_count,
      diff < 0 ? (dto.responsible_employee_id || null) : null,
      dto.notes,
      userId,
    )

    if (userId) {
      await AuditService.log('UPDATE', 'cash_count', id, userId,
        { status: 'OPEN', physical_count: null },
        { status: 'COUNTED', physical_count: dto.physical_count, difference: diff },
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
  async list(query: CashCountListQuery) {
    const { page, limit, offset } = getPaginationParams(query as any)
    const { data, total } = await cashCountsRepository.findAll({ limit, offset }, query)
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
