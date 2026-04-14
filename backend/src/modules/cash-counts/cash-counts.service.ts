import { cashCountsRepository } from './cash-counts.repository'
import type {
  CashCountWithRelations, CreateCashCountDto, UpdatePhysicalCountDto,
  CreateDepositDto, CashDepositWithRelations, CashCountListQuery,
} from './cash-counts.types'
import {
  CashCountNotFoundError, CashCountDuplicatePeriodError,
  CashCountInvalidStatusError, CashCountInvalidDateRangeError,
  CashCountDeficitRequiresEmployeeError, CashCountOperationError,
} from './cash-counts.errors'
import { getPaginationParams, createPaginatedResponse } from '../../utils/pagination.util'
import { AuditService } from '../monitoring/monitoring.service'

export class CashCountsService {
  // ── Preview ──
  async preview(startDate: string, endDate: string, paymentMethodId: number, companyId: string) {
    if (new Date(endDate) < new Date(startDate)) throw new CashCountInvalidDateRangeError()

    const rows = await cashCountsRepository.previewByBranchDate(startDate, endDate, paymentMethodId)
    const existing = await cashCountsRepository.findByPeriod(companyId, startDate, endDate, paymentMethodId)
    const existingMap = new Map<string, any>()
    for (const cc of existing) existingMap.set(`${cc.branch_name || ''}|${cc.start_date}`, cc)

    return rows.map((r) => {
      const cc = existingMap.get(`${r.branch_name}|${r.transaction_date}`)
      return {
        branch_name: r.branch_name, transaction_date: r.transaction_date,
        system_balance: r.system_balance, transaction_count: r.transaction_count,
        cash_count_id: cc?.id || null,
        physical_count: cc?.physical_count ?? null,
        large_denomination: cc?.large_denomination ?? null,
        small_denomination: cc?.small_denomination ?? null,
        difference: cc?.difference ?? null,
        status: cc?.status || null,
        cash_deposit_id: cc?.cash_deposit_id || null,
        responsible_employee_id: cc?.responsible_employee_id || null,
        notes: cc?.notes || null,
      }
    })
  }

  // ── Create cash count ──
  async create(dto: CreateCashCountDto, companyId: string, userId?: string): Promise<CashCountWithRelations> {
    if (new Date(dto.end_date) < new Date(dto.start_date)) throw new CashCountInvalidDateRangeError()

    const existing = await cashCountsRepository.findDuplicate(companyId, dto.start_date, dto.end_date, dto.payment_method_id, dto.branch_name)
    if (existing) throw new CashCountDuplicatePeriodError()

    const { totalAmount, count } = await cashCountsRepository.calculateSystemBalance(companyId, dto.start_date, dto.end_date, dto.payment_method_id, dto.branch_name)

    const cc = await cashCountsRepository.create({
      company_id: companyId, start_date: dto.start_date, end_date: dto.end_date,
      branch_name: dto.branch_name, payment_method_id: dto.payment_method_id,
      system_balance: totalAmount, transaction_count: count, notes: dto.notes, created_by: userId,
    })

    if (userId) await AuditService.log('CREATE', 'cash_count', cc.id, userId, null, cc)
    return (await cashCountsRepository.findById(cc.id))!
  }

  // ── Update physical count (OPEN → COUNTED) ──
  async updatePhysicalCount(id: string, dto: UpdatePhysicalCountDto, userId?: string): Promise<CashCountWithRelations> {
    const existing = await cashCountsRepository.findById(id)
    if (!existing) throw new CashCountNotFoundError(id)
    if (existing.status !== 'OPEN' && existing.status !== 'COUNTED') {
      throw new CashCountInvalidStatusError(existing.status, 'OPEN atau COUNTED')
    }

    const physicalCount = dto.large_denomination + dto.small_denomination
    const diff = physicalCount - existing.system_balance
    if (diff < 0 && !dto.responsible_employee_id) throw new CashCountDeficitRequiresEmployeeError()

    await cashCountsRepository.updatePhysicalCount(
      id, dto.large_denomination, dto.small_denomination,
      diff < 0 ? (dto.responsible_employee_id || null) : null, dto.notes, userId,
    )

    if (userId) {
      await AuditService.log('UPDATE', 'cash_count', id, userId,
        { status: existing.status }, { status: 'COUNTED', large_denomination: dto.large_denomination, small_denomination: dto.small_denomination },
      )
    }
    return (await cashCountsRepository.findById(id))!
  }

  // ── Create deposit (COUNTED → DEPOSITED) ──
  async createDeposit(dto: CreateDepositDto, companyId: string, userId?: string): Promise<CashDepositWithRelations> {
    // Validate all cash counts
    const cashCounts = await Promise.all(dto.cash_count_ids.map((id) => cashCountsRepository.findById(id)))
    for (let i = 0; i < cashCounts.length; i++) {
      const cc = cashCounts[i]
      if (!cc) throw new CashCountNotFoundError(dto.cash_count_ids[i])
      if (cc.status !== 'COUNTED') throw new CashCountInvalidStatusError(cc.status, 'COUNTED')
      if (cc.cash_deposit_id) throw new CashCountOperationError('deposit', `Cash count ${cc.id} sudah ada deposit`)
    }

    // Calculate deposit amount = SUM(large_denomination)
    const depositAmount = cashCounts.reduce((s, cc) => s + (cc!.large_denomination || 0), 0)
    if (depositAmount <= 0) throw new CashCountOperationError('deposit', 'Total pecahan besar harus > 0')

    const dates = cashCounts.map((cc) => cc!.start_date).sort()
    const branchName = cashCounts[0]!.branch_name
    const pmId = cashCounts[0]!.payment_method_id

    const deposit = await cashCountsRepository.createDeposit({
      company_id: companyId, deposit_amount: depositAmount, deposit_date: dto.deposit_date,
      bank_account_id: dto.bank_account_id, reference: dto.reference,
      branch_name: branchName || undefined, payment_method_id: pmId,
      period_start: dates[0], period_end: dates[dates.length - 1],
      item_count: cashCounts.length, notes: dto.notes, created_by: userId,
    })

    await cashCountsRepository.linkCashCountsToDeposit(dto.cash_count_ids, deposit.id, userId)

    if (userId) {
      await AuditService.log('CREATE', 'cash_deposit', deposit.id, userId, null, {
        deposit_amount: depositAmount, cash_count_ids: dto.cash_count_ids, bank_account_id: dto.bank_account_id,
      })
    }

    return (await cashCountsRepository.findDepositById(deposit.id))!
  }

  // ── Close (DEPOSITED → CLOSED) ──
  async close(id: string, userId?: string): Promise<CashCountWithRelations> {
    const existing = await cashCountsRepository.findById(id)
    if (!existing) throw new CashCountNotFoundError(id)
    if (existing.status !== 'DEPOSITED') throw new CashCountInvalidStatusError(existing.status, 'DEPOSITED')

    await cashCountsRepository.close(id, userId)
    if (userId) await AuditService.log('UPDATE', 'cash_count', id, userId, { status: 'DEPOSITED' }, { status: 'CLOSED' })
    return (await cashCountsRepository.findById(id))!
  }

  // ── Get by ID ──
  async getById(id: string): Promise<CashCountWithRelations> {
    const cc = await cashCountsRepository.findById(id)
    if (!cc) throw new CashCountNotFoundError(id)
    return cc
  }

  // ── List ──
  async list(query: CashCountListQuery, companyId: string) {
    const { page, limit, offset } = getPaginationParams(query as any)
    const { data, total } = await cashCountsRepository.findAll(companyId, { limit, offset }, query)
    return createPaginatedResponse(data, total, page, limit)
  }

  // ── Delete (only OPEN) ──
  async delete(id: string, userId?: string): Promise<void> {
    const existing = await cashCountsRepository.findById(id)
    if (!existing) throw new CashCountNotFoundError(id)
    if (existing.status !== 'OPEN') throw new CashCountInvalidStatusError(existing.status, 'OPEN')
    await cashCountsRepository.softDelete(id)
    if (userId) await AuditService.log('DELETE', 'cash_count', id, userId, existing, null)
  }

  // ── Deposit CRUD ──
  async getDeposit(id: string): Promise<CashDepositWithRelations> {
    const dep = await cashCountsRepository.findDepositById(id)
    if (!dep) throw new CashCountNotFoundError(id)
    return dep
  }

  async deleteDeposit(id: string, userId?: string): Promise<void> {
    const dep = await cashCountsRepository.findDepositById(id)
    if (!dep) throw new CashCountNotFoundError(id)
    if (dep.status === 'RECONCILED') throw new CashCountOperationError('delete_deposit', 'Deposit sudah reconciled')
    await cashCountsRepository.deleteDeposit(id)
    if (userId) await AuditService.log('DELETE', 'cash_deposit', id, userId, dep, null)
  }
}

export const cashCountsService = new CashCountsService()
