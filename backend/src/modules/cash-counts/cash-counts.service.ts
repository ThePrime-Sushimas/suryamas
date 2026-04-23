import { cashCountsRepository } from './cash-counts.repository'
import type {
  CashCountWithRelations, CreateCashCountDto, UpdatePhysicalCountDto,
  CreateDepositDto, ConfirmDepositDto, CashDepositWithRelations, CashCountListQuery,
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

    // Re-calculate system_balance dari aggregated_transactions (snapshot saat count)
    const { totalAmount, count } = await cashCountsRepository.calculateSystemBalance(
      existing.company_id, existing.start_date, existing.end_date,
      existing.payment_method_id, existing.branch_name,
    )

    const physicalCount = dto.large_denomination + dto.small_denomination
    const diff = physicalCount - totalAmount
    if (diff < 0 && !dto.responsible_employee_id) throw new CashCountDeficitRequiresEmployeeError()

    await cashCountsRepository.updatePhysicalCount(
      id, dto.large_denomination, dto.small_denomination,
      totalAmount, count,
      diff < 0 ? (dto.responsible_employee_id || null) : null, dto.notes, userId,
    )

    if (userId) {
      await AuditService.log('UPDATE', 'cash_count', id, userId,
        { status: existing.status, system_balance: existing.system_balance },
        { status: 'COUNTED', system_balance: totalAmount, large_denomination: dto.large_denomination, small_denomination: dto.small_denomination, difference: diff },
      )
    }
    return (await cashCountsRepository.findById(id))!
  }

  // ── Create deposit (COUNTED → DEPOSITED) ──
  async createDeposit(dto: CreateDepositDto, companyId: string, userId?: string): Promise<CashDepositWithRelations> {
    // Validate all cash counts (batch fetch instead of N individual queries)
    const allCashCounts = await cashCountsRepository.findByIds(dto.cash_count_ids)
    const cashCountMap = new Map(allCashCounts.map((cc) => [cc.id, cc]))
    const cashCounts = dto.cash_count_ids.map((id) => cashCountMap.get(id) || null)
    for (let i = 0; i < cashCounts.length; i++) {
      const cc = cashCounts[i]
      if (!cc) throw new CashCountNotFoundError(dto.cash_count_ids[i])
      if (cc.status !== 'COUNTED') throw new CashCountInvalidStatusError(cc.status, 'COUNTED')
      if (cc.cash_deposit_id) throw new CashCountOperationError('deposit', `Cash count ${cc.id} sudah ada deposit`)
    }

    // Calculate deposit amounts
    const totalLarge = cashCounts.reduce((s, cc) => s + (cc!.large_denomination || 0), 0)
    const totalSmall = cashCounts.reduce((s, cc) => s + (cc!.small_denomination || 0), 0)
    const totalPhysical = totalLarge + totalSmall

    // Manual override: user specifies exact deposit amount (rounded to large bills)
    // owner_top_up = totalPhysical - depositAmount (remainder = uang kecil kept as modal)
    let depositAmount: number
    let largeAmount: number
    let smallAmount: number

    if (dto.deposit_amount != null && dto.deposit_amount > 0) {
      depositAmount = dto.deposit_amount
      if (depositAmount > totalPhysical) {
        throw new CashCountOperationError('deposit', `Jumlah setor (${depositAmount}) tidak boleh melebihi total fisik (${totalPhysical})`)
      }
      largeAmount = depositAmount
      smallAmount = totalPhysical - depositAmount
    } else {
      largeAmount = totalLarge
      smallAmount = totalSmall
      depositAmount = largeAmount + smallAmount
    }

    if (depositAmount <= 0) throw new CashCountOperationError('deposit', 'Total setoran harus > 0')

    const dates = cashCounts.map((cc) => cc!.start_date).sort()
    const branchNames = [...new Set(cashCounts.map((cc) => cc!.branch_name).filter(Boolean))]
    const branchName = branchNames.length === 1 ? branchNames[0] : branchNames.join(', ')
    const pmId = cashCounts[0]!.payment_method_id

    const deposit = await cashCountsRepository.createDeposit({
      company_id: companyId, deposit_amount: depositAmount,
      large_amount: largeAmount, owner_top_up: smallAmount,
      deposit_date: dto.deposit_date,
      bank_account_id: dto.bank_account_id, reference: dto.reference,
      branch_name: branchName || undefined, payment_method_id: pmId,
      period_start: dates[0], period_end: dates[dates.length - 1],
      item_count: cashCounts.length, notes: dto.notes, created_by: userId,
    })

    await cashCountsRepository.linkCashCountsToDeposit(dto.cash_count_ids, deposit.id, userId)

    if (userId) {
      await AuditService.log('CREATE', 'cash_deposit', deposit.id, userId, null, {
        deposit_amount: depositAmount, large_amount: largeAmount, owner_top_up: smallAmount,
        cash_count_ids: dto.cash_count_ids, bank_account_id: dto.bank_account_id,
      })
    }

    return (await cashCountsRepository.findDepositById(deposit.id))!
  }

  // ── Confirm deposit (PENDING → DEPOSITED) ──
  async confirmDeposit(id: string, dto: ConfirmDepositDto, userId?: string): Promise<CashDepositWithRelations> {
    const dep = await cashCountsRepository.findDepositById(id)
    if (!dep) throw new CashCountNotFoundError(id)
    if (dep.status !== 'PENDING') throw new CashCountOperationError('confirm_deposit', `Deposit status ${dep.status}, harus PENDING`)

    const depositedAt = dto.deposited_at || new Date().toISOString()
    await cashCountsRepository.confirmDeposit(id, dto.proof_url, depositedAt, userId)

    if (userId) {
      await AuditService.log('UPDATE', 'cash_deposit', id, userId,
        { status: 'PENDING' },
        { status: 'DEPOSITED', proof_url: dto.proof_url, deposited_at: depositedAt },
      )
    }
    return (await cashCountsRepository.findDepositById(id))!
  }

  // ── Revert deposit (DEPOSITED → PENDING) ──
  async revertDeposit(id: string, userId?: string): Promise<void> {
    const dep = await cashCountsRepository.findDepositById(id)
    if (!dep) throw new CashCountNotFoundError(id)
    if (dep.status !== 'DEPOSITED') throw new CashCountOperationError('revert_deposit', `Deposit status ${dep.status}, harus DEPOSITED`)

    await cashCountsRepository.revertDepositToPending(id)

    if (userId) {
      await AuditService.log('DELETE', 'cash_deposit', id, userId,
        { status: 'DEPOSITED', deposit_amount: dep.deposit_amount },
        null,
      )
    }
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

  async listDeposits(companyId: string, page: number = 1, limit: number = 20) {
    const offset = (page - 1) * limit
    const { data, total } = await cashCountsRepository.listDeposits(companyId, { limit, offset })

    // Batch fetch bank account names
    const baIds = [...new Set(data.map((d: any) => d.bank_account_id).filter(Boolean))]
    let baMap: Record<number, string> = {}
    if (baIds.length > 0) {
      const { data: bas } = await (await import('../../config/supabase')).supabase
        .from('bank_accounts').select('id, account_name, banks(bank_name)').in('id', baIds)
      if (bas) baMap = bas.reduce((a: any, b: any) => {
        a[b.id] = `${(b.banks as any)?.bank_name || ''} - ${b.account_name}`; return a
      }, {})
    }

    const mapped = data.map((d: any) => ({ ...d, bank_account_name: d.bank_account_id ? baMap[d.bank_account_id] || null : null }))
    return { data: mapped, pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 } }
  }

  async deleteDeposit(id: string, userId?: string): Promise<void> {
    const dep = await cashCountsRepository.findDepositById(id)
    if (!dep) throw new CashCountNotFoundError(id)
    if (dep.status === 'RECONCILED') throw new CashCountOperationError('delete_deposit', 'Deposit sudah reconciled')
    await cashCountsRepository.deleteDeposit(id)
    if (userId) await AuditService.log('DELETE', 'cash_deposit', id, userId, dep, null)
  }

  async getCapitalTopUpReport(companyId: string, startDate: string, endDate: string) {
    const rows = await cashCountsRepository.getCapitalTopUpReport(companyId, startDate, endDate)

    // Group by branch
    const byBranch: Record<string, { branch_name: string; total: number; count: number; deposits: any[] }> = {}
    for (const row of rows) {
      const branch = row.branch_name || 'Tidak diketahui'
      if (!byBranch[branch]) byBranch[branch] = { branch_name: branch, total: 0, count: 0, deposits: [] }
      byBranch[branch].total += Number(row.owner_top_up) || 0
      byBranch[branch].count++
      byBranch[branch].deposits.push(row)
    }

    const grandTotal = rows.reduce((s, r) => s + (Number(r.owner_top_up) || 0), 0)

    return {
      period: { start_date: startDate, end_date: endDate },
      grand_total: grandTotal,
      total_deposits: rows.length,
      by_branch: Object.values(byBranch).sort((a, b) => b.total - a.total),
    }
  }
}

export const cashCountsService = new CashCountsService()
