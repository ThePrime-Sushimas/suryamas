import { pool } from '../../config/db'
import { shortageReportRepository } from './shortage-report.repository'
import { stockAdjustmentsService } from '../stock-adjustments/stock-adjustments.service'
import { ShortageReportError } from './shortage-report.errors'
import { AuditService } from '../monitoring/monitoring.service'
import { logWarn } from '../../config/logger'
import type {
  DepartmentEmployeePreview,
  ShortageByDepartmentGroup,
  ShortageByEmployeeGroup,
  ShortageByItemGroup,
  ShortageQueryContext,
  ShortageRecord,
  ShortageReportFilter,
  ShortageReportResponse,
  ShortageReportSummary,
  ShortageResolvePayload,
  ShortageResolveResult,
  ShortageRowForResolve,
} from './shortage-report.types'

function splitEquallyIdr(total: number, count: number): number[] {
  const totalInt = Math.round(total)
  const base = Math.floor(totalInt / count)
  const amounts = Array.from({ length: count }, () => base)
  amounts[amounts.length - 1] += totalInt - base * count
  return amounts
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildContext(filter: ShortageReportFilter): ShortageQueryContext {
  return {
    branchIds: filter.branch_ids,
    startDate: toDateStr(filter.start_date),
    endDate: toDateStr(filter.end_date),
    branchId: filter.branch_id,
    positionId: filter.position_id,
    itemId: filter.item_id,
    categoryId: filter.category_id,
    resolveStatus: filter.resolve_status,
  }
}

function employeeKey(r: ShortageRecord): string | null {
  return r.deducted_employee_id ?? r.shortage_assigned_to ?? null
}

function employeeName(r: ShortageRecord): string {
  return r.deducted_employee_name ?? r.shortage_assigned_to_name ?? '-'
}

function hasDeduction(r: ShortageRecord): boolean {
  return r.deduction_mode === 'DIVISION' || employeeKey(r) != null
}

function effectiveDeductionAmount(r: ShortageRecord): number {
  if (r.deduction_mode === 'DIVISION') {
    return Number(r.deduction_amount ?? r.total_cost) || 0
  }
  if (r.deduction_amount != null && Number(r.deduction_amount) > 0) {
    return Number(r.deduction_amount)
  }
  if (employeeKey(r)) {
    return Number(r.total_cost) || 0
  }
  return 0
}

function isDeductionPending(r: ShortageRecord): boolean {
  if (r.deduction_mode === 'DIVISION') {
    if (r.resolve_status === 'UNRESOLVED') return true
    if (r.resolve_status === 'RESOLVED') {
      return r.division_alloc_count != null && r.division_alloc_count > 0
        ? !r.division_all_paid
        : true
    }
    return false
  }
  if (!hasDeduction(r)) return false
  const isPaid = !!r.deduction_paid_at
  return r.resolve_status === 'UNRESOLVED' || (r.resolve_status === 'RESOLVED' && !isPaid)
}

function computeSummary(records: ShortageRecord[]): ShortageReportSummary {
  const summary: ShortageReportSummary = {
    total_shortage_qty: 0,
    total_shortage_cost: 0,
    unresolved_count: 0,
    unresolved_cost: 0,
    resolved_count: 0,
    resolved_cost: 0,
    converted_to_waste_count: 0,
    converted_to_waste_cost: 0,
    total_deduction_amount: 0,
    pending_deduction_cost: 0,
  }

  for (const r of records) {
    const qty = Number(r.qty) || 0
    const cost = Number(r.total_cost) || 0
    summary.total_shortage_qty += qty
    summary.total_shortage_cost += cost

    if (r.resolve_status === 'UNRESOLVED') {
      summary.unresolved_count += 1
      summary.unresolved_cost += cost
    } else if (r.resolve_status === 'RESOLVED') {
      summary.resolved_count += 1
      summary.resolved_cost += cost
    } else if (r.resolve_status === 'CONVERTED_TO_WASTE') {
      summary.converted_to_waste_count += 1
      summary.converted_to_waste_cost += cost
    }

    const deduction = effectiveDeductionAmount(r)
    if (deduction > 0 && hasDeduction(r)) {
      summary.total_deduction_amount += deduction
      if (isDeductionPending(r)) {
        summary.pending_deduction_cost += deduction
      }
    }
  }

  return summary
}

export class ShortageReportService {
  async getReport(filter: ShortageReportFilter): Promise<ShortageReportResponse> {
    const records = await shortageReportRepository.getShortageRows(buildContext(filter))
    return {
      summary: computeSummary(records),
      records,
    }
  }

  async getSummary(filter: ShortageReportFilter): Promise<ShortageReportSummary> {
    const records = await shortageReportRepository.getShortageRows(buildContext(filter))
    return computeSummary(records)
  }

  async getByItem(filter: ShortageReportFilter): Promise<ShortageByItemGroup[]> {
    const records = await shortageReportRepository.getShortageRows(buildContext(filter))
    const map = new Map<string, ShortageByItemGroup>()

    for (const r of records) {
      const existing = map.get(r.item_id) ?? {
        item_id: r.item_id,
        item_name: r.item_name,
        category_name: r.category_name,
        total_qty: 0,
        total_cost: 0,
        record_count: 0,
        unresolved_count: 0,
        unresolved_cost: 0,
      }
      existing.total_qty += Number(r.qty) || 0
      existing.total_cost += Number(r.total_cost) || 0
      existing.record_count += 1
      if (r.resolve_status === 'UNRESOLVED') {
        existing.unresolved_count += 1
        existing.unresolved_cost += Number(r.total_cost) || 0
      }
      map.set(r.item_id, existing)
    }

    return [...map.values()].sort((a, b) => b.total_cost - a.total_cost)
  }

  async getByEmployee(filter: ShortageReportFilter): Promise<ShortageByEmployeeGroup[]> {
    const ctx = buildContext(filter)
    const records = await shortageReportRepository.getShortageRows(ctx)
    const allocations = await shortageReportRepository.getAllocationsInRange(ctx)

    const map = new Map<string, ShortageByEmployeeGroup>()

    const upsertDetail = (
      empId: string,
      empName: string,
      branchName: string | undefined,
      detail: ShortageByEmployeeGroup['detail'][number],
      amount: number,
      isPaid: boolean,
    ) => {
      const existing = map.get(empId) ?? {
        employee_id: empId,
        employee_name: empName,
        branch_name: branchName,
        total_deduction_amount: 0,
        shortage_count: 0,
        paid_count: 0,
        detail: [],
      }
      existing.total_deduction_amount += amount
      existing.shortage_count += 1
      if (isPaid) existing.paid_count += 1
      existing.detail.push(detail)
      map.set(empId, existing)
    }

    const withEmployee = records.filter((r) => employeeKey(r) != null && r.deduction_mode !== 'DIVISION')
    for (const r of withEmployee) {
      const empId = employeeKey(r)!
      const deduction = effectiveDeductionAmount(r)
      upsertDetail(
        empId,
        employeeName(r),
        r.branch_name,
        {
          id: r.id,
          date: r.date,
          item_name: r.item_name,
          qty: Number(r.qty) || 0,
          total_cost: Number(r.total_cost) || 0,
          deduction_amount: deduction,
          notes: r.deduction_notes ?? r.resolved_notes ?? r.shortage_note ?? undefined,
          deduction_paid_at: r.deduction_paid_at,
          resolve_status: r.resolve_status,
          is_provisional: r.resolve_status === 'UNRESOLVED' || r.deduction_amount == null,
          deduction_mode: r.deduction_mode ?? 'INDIVIDUAL',
          department_name: r.department_name,
        },
        deduction,
        !!r.deduction_paid_at,
      )
    }

    for (const a of allocations) {
      upsertDetail(
        a.employee_id,
        a.employee_name,
        a.branch_name,
        {
          id: a.vcl_id,
          allocation_id: a.allocation_id,
          date: a.date,
          item_name: a.item_name,
          qty: Number(a.qty) || 0,
          total_cost: Number(a.total_cost) || 0,
          deduction_amount: Number(a.allocation_amount) || 0,
          notes: a.notes,
          deduction_paid_at: a.deduction_paid_at,
          resolve_status: a.resolve_status as ShortageRecord['resolve_status'],
          is_provisional: false,
          deduction_mode: 'DIVISION',
          department_name: a.department_name,
        },
        Number(a.allocation_amount) || 0,
        !!a.deduction_paid_at,
      )
    }

    return [...map.values()].sort((a, b) => b.total_deduction_amount - a.total_deduction_amount)
  }

  async getByDepartment(filter: ShortageReportFilter): Promise<ShortageByDepartmentGroup[]> {
    const ctx = buildContext(filter)
    const records = await shortageReportRepository.getShortageRows(ctx)
    const allocations = await shortageReportRepository.getAllocationsInRange(ctx)
    const map = new Map<string, ShortageByDepartmentGroup>()
    const employeeSets = new Map<string, Set<string>>()

    const upsert = (
      deptId: string,
      deptName: string,
      branchName: string | undefined,
      detail: ShortageByDepartmentGroup['detail'][number],
      amount: number,
      empId?: string,
      isPaid?: boolean,
    ) => {
      const existing = map.get(deptId) ?? {
        department_id: deptId,
        department_name: deptName,
        branch_name: branchName,
        total_deduction_amount: 0,
        shortage_count: 0,
        paid_count: 0,
        employee_count: 0,
        detail: [],
      }
      existing.total_deduction_amount += amount
      existing.shortage_count += 1
      if (isPaid) existing.paid_count += 1
      existing.detail.push(detail)
      if (empId) {
        const set = employeeSets.get(deptId) ?? new Set<string>()
        set.add(empId)
        employeeSets.set(deptId, set)
        existing.employee_count = set.size
      }
      map.set(deptId, existing)
    }

    for (const a of allocations) {
      upsert(
        a.department_id,
        a.department_name,
        a.branch_name,
        {
          id: a.allocation_id,
          allocation_id: a.allocation_id,
          vcl_id: a.vcl_id,
          date: a.date,
          item_name: a.item_name,
          employee_id: a.employee_id,
          employee_name: a.employee_name,
          qty: Number(a.qty) || 0,
          total_cost: Number(a.total_cost) || 0,
          deduction_amount: Number(a.allocation_amount) || 0,
          notes: a.notes,
          deduction_paid_at: a.deduction_paid_at,
          resolve_status: a.resolve_status as ShortageRecord['resolve_status'],
          is_provisional: false,
        },
        Number(a.allocation_amount) || 0,
        a.employee_id,
        !!a.deduction_paid_at,
      )
    }

    const unresolvedMonthly = records.filter(
      (r) =>
        r.resolve_status === 'UNRESOLVED' &&
        r.source_type === 'MONTHLY_OPNAME' &&
        r.department_id,
    )

    const employeeCache = new Map<string, DepartmentEmployeePreview[]>()
    for (const r of unresolvedMonthly) {
      const deptId = r.department_id!
      const cacheKey = `${r.branch_id}:${deptId}`
      let employees = employeeCache.get(cacheKey)
      if (!employees) {
        employees = await shortageReportRepository.getActiveEmployeesInDepartment(
          pool, r.branch_id, deptId,
        )
        employeeCache.set(cacheKey, employees)
      }
      if (employees.length === 0) continue
      const amounts = splitEquallyIdr(Number(r.total_cost), employees.length)
      employees.forEach((emp, i) => {
        upsert(
          deptId,
          r.department_name ?? '-',
          r.branch_name,
          {
            id: `${r.id}:${emp.id}`,
            vcl_id: r.id,
            date: r.date,
            item_name: r.item_name,
            employee_id: emp.id,
            employee_name: emp.full_name,
            qty: Number(r.qty) || 0,
            total_cost: Number(r.total_cost) || 0,
            deduction_amount: amounts[i],
            notes: r.shortage_note,
            resolve_status: r.resolve_status,
            is_provisional: true,
          },
          amounts[i],
          emp.id,
          false,
        )
      })
    }

    return [...map.values()].sort((a, b) => b.total_deduction_amount - a.total_deduction_amount)
  }

  async getDepartmentEmployees(
    branchId: string,
    departmentId?: string,
    positionId?: string,
  ): Promise<DepartmentEmployeePreview[]> {
    return shortageReportRepository.getActiveEmployeesInDepartment(pool, branchId, departmentId ?? '', positionId)
  }

  async resolve(
    branchIds: string[],
    payload: ShortageResolvePayload,
    resolvedByUserId: string,
  ): Promise<ShortageResolveResult> {
    if (payload.action === 'CONVERT_TO_WASTE') {
      return this.resolveConvertToWaste(branchIds, payload, resolvedByUserId)
    }
    return this.resolveWithDeduction(branchIds, payload, resolvedByUserId)
  }

  private validateResolveRows(
    rows: ShortageRowForResolve[],
    vclIds: string[],
    action: ShortageResolvePayload['action'],
    resolvedNotes?: string | null,
  ): void {
    if (rows.length !== vclIds.length) {
      throw new ShortageReportError(
        'Beberapa baris tidak ditemukan atau sudah pernah diselesaikan',
      )
    }

    const branchIdsSet = new Set(rows.map((r) => r.branch_id))
    if (branchIdsSet.size > 1) {
      throw new ShortageReportError('Semua baris harus dari cabang yang sama')
    }

    if (action === 'CONVERT_TO_WASTE') {
      const notes = resolvedNotes?.trim()
      if (!notes) {
        throw new ShortageReportError('Alasan konversi wajib diisi')
      }
      const sessionKeys = new Set(
        rows.map((r) =>
          r.source_type === 'MONTHLY_OPNAME'
            ? `m:${r.monthly_opname_id}`
            : `d:${r.closing_id}`,
        ),
      )
      if (sessionKeys.size > 1) {
        throw new ShortageReportError('Konversi ke waste hanya untuk baris dari sesi opname yang sama')
      }
      const positionIds = new Set(rows.map((r) => r.position_id ?? ''))
      if (positionIds.size > 1) {
        throw new ShortageReportError('Konversi ke waste hanya untuk baris dari posisi opname yang sama')
      }
    }
  }

  /**
   * Hold row locks (FOR UPDATE) until markResolved to block concurrent convert requests.
   */
  private async resolveConvertToWaste(
    branchIds: string[],
    payload: ShortageResolvePayload,
    resolvedByUserId: string,
  ): Promise<ShortageResolveResult> {
    const notes = payload.resolved_notes!.trim()
    const client = await pool.connect()

    try {
      await client.query('BEGIN')

      const rows = await shortageReportRepository.lockUnresolvedRowsForResolve(
        client, payload.vcl_ids, branchIds,
      )
      this.validateResolveRows(rows, payload.vcl_ids, 'CONVERT_TO_WASTE', notes)

      const first = rows[0]
      const saId = await stockAdjustmentsService.createFromShortage(branchIds, {
        warehouse_id: first.warehouse_id,
        branch_id: first.branch_id,
        company_id: first.company_id,
        adjustment_date: first.closing_date,
        notes: `Converted from shortage - ${first.position_name ?? 'opname'} - ${notes}`,
        source_closing_id: first.source_type === 'DAILY_OPNAME' ? first.closing_id : null,
        source_monthly_opname_id: first.source_type === 'MONTHLY_OPNAME' ? first.monthly_opname_id : null,
        source_position_id: first.position_id,
        lines: rows.map((r) => ({
          product_id: r.product_id,
          qty: Number(r.abs_qty),
          notes: `From shortage vcl.id=${r.id}`,
        })),
        created_by: resolvedByUserId,
      })

      const confirmResult = await stockAdjustmentsService.confirm(saId, branchIds, {
        confirmed_by: resolvedByUserId,
      })

      const updated = await shortageReportRepository.markResolved(client, payload.vcl_ids, {
        resolve_status: 'CONVERTED_TO_WASTE',
        resolved_by: resolvedByUserId,
        resolved_notes: notes,
        converted_sa_id: saId,
      })
      if (updated !== payload.vcl_ids.length) {
        throw new ShortageReportError(
          'Beberapa baris tidak ditemukan atau sudah pernah diselesaikan',
        )
      }

      await client.query('COMMIT')

      await AuditService.log(
        'UPDATE', 'shortage_report', saId, resolvedByUserId, undefined,
        { action: 'CONVERT_TO_WASTE', vcl_ids: payload.vcl_ids },
      )

      return {
        success: true,
        journal_pending: confirmResult.journal_pending === true,
        converted_sa_id: saId,
      }
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  }

  private async resolveWithDeduction(
    branchIds: string[],
    payload: ShortageResolvePayload,
    resolvedByUserId: string,
  ): Promise<ShortageResolveResult> {
    let journalPending = false

    await shortageReportRepository.withTransaction(async (client) => {
      const locked = await shortageReportRepository.lockUnresolvedRowsForResolve(
        client, payload.vcl_ids, branchIds,
      )
      this.validateResolveRows(locked, payload.vcl_ids, 'RESOLVE')

      const allocationMode = payload.allocation_mode ?? 'INDIVIDUAL'

      if (allocationMode === 'DIVISION') {
        for (const row of locked) {
          const deptId = payload.department_id ?? row.department_id
          if (!deptId) {
            throw new ShortageReportError('Divisi wajib dipilih untuk potongan bagi rata')
          }
          const employees = await shortageReportRepository.getActiveEmployeesInDepartment(
            client, row.branch_id, deptId,
          )
          if (employees.length === 0) {
            throw new ShortageReportError(
              'Tidak ada karyawan aktif di divisi ini pada cabang terkait',
            )
          }
          const totalCost = Number(row.total_cost) || 0
          const amounts = splitEquallyIdr(totalCost, employees.length)
          await shortageReportRepository.markResolvedPerRow(
            client,
            [{
              id: row.id,
              deducted_employee_id: null,
              deduction_amount: totalCost,
              deduction_notes: payload.deduction_notes ?? row.shortage_note,
              deduction_mode: 'DIVISION',
              department_id: deptId,
            }],
            {
              resolve_status: 'RESOLVED',
              resolved_by: resolvedByUserId,
              resolved_notes: payload.resolved_notes?.trim() ?? null,
            },
          )
          await shortageReportRepository.insertDivisionAllocations(
            client,
            row.id,
            deptId,
            employees,
            amounts,
            payload.deduction_notes ?? row.shortage_note,
          )
        }
      } else {
        await shortageReportRepository.markResolvedPerRow(
          client,
          locked.map((row) => ({
            id: row.id,
            deducted_employee_id: payload.deducted_employee_id ?? row.shortage_assigned_to,
            deduction_amount:
              payload.deduction_amount ??
              (payload.deducted_employee_id || row.shortage_assigned_to ? Number(row.total_cost) : null),
            deduction_notes: payload.deduction_notes ?? row.shortage_note,
            deduction_mode: 'INDIVIDUAL',
          })),
          {
            resolve_status: 'RESOLVED',
            resolved_by: resolvedByUserId,
            resolved_notes: payload.resolved_notes?.trim() ?? null,
          },
        )
      }

      // Generate journal: DR Piutang Karyawan (110403), CR Persediaan Cabang (110505)
      // Best-effort within the same transaction — if COA/fiscal missing, skip journal but still resolve
      try {
        journalPending = !(await this.generateShortageResolveJournal(client, locked, resolvedByUserId))
      } catch (err) {
        // Journal generation failed — resolve still committed, log for retry
        logWarn('[ShortageResolve] Journal generation failed', { error: err instanceof Error ? err.message : String(err) })
        journalPending = true
      }
    })

    await AuditService.log(
      'UPDATE', 'shortage_report', payload.vcl_ids[0], resolvedByUserId, undefined,
      { action: 'RESOLVE', vcl_ids: payload.vcl_ids, journal_pending: journalPending },
    )

    return { success: true, journal_pending: journalPending }
  }

  /**
   * Generate journal for shortage resolve (deduction):
   *   DR 110403 (Potongan Karyawan) — total deduction value
   *   CR 110505 (Persediaan Cabang) — per product line
   *
   * All locked rows must be from the same branch/company (validated upstream + asserted here).
   * Returns true if journal was created, false if skipped (missing config).
   */
  private async generateShortageResolveJournal(
    client: import('pg').PoolClient,
    locked: ShortageRowForResolve[],
    userId: string,
  ): Promise<boolean> {
    if (locked.length === 0) return false

    const companyId = locked[0].company_id
    const branchId = locked[0].branch_id
    const journalDate = locked[0].closing_date

    // Assert all rows are same branch/company/date — fail loud if violated
    for (const row of locked) {
      if (row.branch_id !== branchId || row.company_id !== companyId) {
        throw new ShortageReportError(
          'Journal generation requires all rows from same branch and company. ' +
          `Expected branch=${branchId}, company=${companyId}, got branch=${row.branch_id}, company=${row.company_id}`
        )
      }
    }

    // Only include rows with positive cost (consistent filter for both DR and CR)
    const journalRows = locked.filter(r => (Number(r.total_cost) || 0) > 0)
    if (journalRows.length === 0) return false

    // Calculate total value from filtered rows only
    const totalValue = journalRows.reduce((sum, r) => sum + Number(r.total_cost), 0)
    if (totalValue <= 0) return false

    // Resolve fiscal period
    const fiscalPeriod = await shortageReportRepository.findOpenFiscalPeriod(companyId, journalDate, client)
    if (!fiscalPeriod) return false

    // Resolve COA accounts
    const piutangKaryawan = await shortageReportRepository.findCoaByCode(companyId, '110403', client)
    const persediaanCabang = await shortageReportRepository.findCoaByCode(companyId, '110505', client)
    if (!piutangKaryawan || !persediaanCabang) return false

    const period = fiscalPeriod.period
    const seq = await shortageReportRepository.getNextJournalSequence(client, companyId, period)
    const journalNumber = `JI-${period}-${String(seq).padStart(4, '0')}`

    const description = `Potongan shortage opname ${journalDate}`

    const journalId = await shortageReportRepository.insertJournalHeader(client, {
      companyId,
      branchId,
      journalNumber,
      sequenceNumber: seq,
      journalDate,
      period,
      description,
      totalAmount: totalValue,
      referenceId: locked[0].closing_id ?? locked[0].monthly_opname_id ?? locked[0].id,
      createdBy: userId,
    })

    let lineNumber = 1

    // DR: Piutang Karyawan (single line for total)
    await shortageReportRepository.insertJournalLine(client, {
      journalHeaderId: journalId,
      lineNumber: lineNumber++,
      accountId: piutangKaryawan.id,
      description: `Potongan shortage - ${journalRows.length} item`,
      debitAmount: totalValue,
      creditAmount: 0,
    })

    // CR: Persediaan Cabang (per product for audit trail)
    for (const row of journalRows) {
      const value = Number(row.total_cost)
      await shortageReportRepository.insertJournalLine(client, {
        journalHeaderId: journalId,
        lineNumber: lineNumber++,
        accountId: persediaanCabang.id,
        description: `Shortage - ${row.product_id}`,
        debitAmount: 0,
        creditAmount: value,
      })
    }

    // Save journal reference on VCL rows
    const vclIds = locked.map(r => r.id)
    await shortageReportRepository.saveShortageJournalId(client, vclIds, journalId)

    return true
  }

  async markDeductionPaid(
    id: string,
    branchIds: string[],
    paid: boolean,
    userId: string,
  ): Promise<ShortageRecord | null> {
    const updated = await shortageReportRepository.updateDeductionPaid(id, branchIds, paid)
    if (!updated) {
      throw new ShortageReportError('Baris shortage tidak ditemukan atau tidak memiliki potongan karyawan')
    }
    await AuditService.log('UPDATE', 'shortage_report', id, userId, undefined, { deduction_paid: paid })
    return updated
  }

  async editResolution(
    vclId: string,
    branchIds: string[],
    payload: ShortageResolvePayload,
    userId: string,
  ): Promise<ShortageResolveResult> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      if (payload.allocation_mode === 'DIVISION' && payload.department_id) {
        // Get employees by position or department
        const employees = await shortageReportRepository.getActiveEmployeesInDepartment(
          client, branchIds[0], payload.department_id,
        )
        if (employees.length === 0) {
          throw new ShortageReportError('Tidak ada karyawan aktif di position/divisi ini')
        }

        // Get the row to know total_cost
        const row = await shortageReportRepository.getShortageRowById(vclId, branchIds)
        if (!row) throw new ShortageReportError('Baris shortage tidak ditemukan')
        const totalCost = Number(row.total_cost) || 0
        const amounts = splitEquallyIdr(totalCost, employees.length)

        await shortageReportRepository.updateResolvedRow(client, vclId, branchIds, {
          resolved_by: userId,
          resolved_notes: payload.resolved_notes?.trim() ?? null,
          deducted_employee_id: null,
          deduction_amount: totalCost,
          deduction_notes: payload.deduction_notes?.trim() ?? null,
          deduction_mode: 'DIVISION',
          department_id: payload.department_id,
        })

        await shortageReportRepository.insertDivisionAllocations(
          client, vclId, payload.department_id, employees, amounts, payload.deduction_notes ?? null,
        )
      } else {
        await shortageReportRepository.updateResolvedRow(client, vclId, branchIds, {
          resolved_by: userId,
          resolved_notes: payload.resolved_notes?.trim() ?? null,
          deducted_employee_id: payload.deducted_employee_id ?? null,
          deduction_amount: payload.deduction_amount ?? null,
          deduction_notes: payload.deduction_notes?.trim() ?? null,
          deduction_mode: payload.deducted_employee_id ? 'INDIVIDUAL' : null,
          department_id: null,
        })
      }

      await client.query('COMMIT')
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }

    await AuditService.log(
      'UPDATE', 'shortage_report', vclId, userId, undefined,
      { action: 'EDIT_RESOLUTION', vcl_id: vclId },
    )

    return { success: true }
  }
}

export const shortageReportService = new ShortageReportService()
