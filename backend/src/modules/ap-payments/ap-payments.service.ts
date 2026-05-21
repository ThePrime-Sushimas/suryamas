import type { PoolClient } from 'pg'
import { logInfo } from '../../config/logger'
import { AuditService } from '../monitoring/monitoring.service'
import { apPaymentsRepository } from './ap-payments.repository'
import type {
  ApPaymentDetail,
  ApPaymentWithRelations,
  ApOutstandingInvoice,
  ApPaymentListFilter,
  CreateApPaymentDto,
  UpdateApPaymentDto,
  RejectApPaymentDto,
  UploadProofDto,
  ReconcileApPaymentDto,
  ApDashboardResponse,
  ApDashboardInvoiceRow,
  ApDashboardAgingBucket,
  ApDashboardSupplierRow,
  ApAgingBucketKey,
  ApDueDatePivotRow,
  ApDueDatePivotGroup,
} from './ap-payments.types'
import {
  ApPaymentNotFoundError,
  ApPaymentInvalidStatusError,
  ApPaymentInvoiceNotEligibleError,
  ApPaymentInvoiceNotPostedForPaidError,
  ApPaymentOutstandingExceededError,
  ApPaymentLinesTotalMismatchError,
  ApPaymentProofRequiredError,
  ApPaymentEmptyLinesError,
  ApPaymentDuplicateInvoiceError,
} from './ap-payments.errors'

const AGING_BUCKET_DEFS: Array<{ bucket: ApAgingBucketKey; label: string }> = [
  { bucket: 'current', label: 'Belum jatuh tempo' },
  { bucket: 'days_1_30', label: '1–30 hari' },
  { bucket: 'days_31_60', label: '31–60 hari' },
  { bucket: 'days_61_90', label: '61–90 hari' },
  { bucket: 'days_90_plus', label: '> 90 hari' },
]

function emptyAgingBuckets(): ApDashboardAgingBucket[] {
  return AGING_BUCKET_DEFS.map((d) => ({
    bucket: d.bucket,
    label: d.label,
    amount: 0,
    invoice_count: 0,
  }))
}

function resolveAgingBucket(dueDate: string | null, isOverdue: boolean): ApAgingBucketKey {
  if (!isOverdue || !dueDate) return 'current'
  const due = new Date(dueDate)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  due.setHours(0, 0, 0, 0)
  const daysPast = Math.floor((today.getTime() - due.getTime()) / 86400000)
  if (daysPast <= 30) return 'days_1_30'
  if (daysPast <= 60) return 'days_31_60'
  if (daysPast <= 90) return 'days_61_90'
  return 'days_90_plus'
}

export class ApPaymentsService {
  private async assertInvoiceLinePayable(
    client: PoolClient,
    line: { purchase_invoice_id: string; amount_paid: number },
    companyId: string,
    excludePaymentId?: string,
  ): Promise<void> {
    const pi = await apPaymentsRepository.findPayableInvoice(
      client,
      line.purchase_invoice_id,
      companyId,
    )
    if (!pi) {
      throw new ApPaymentInvoiceNotEligibleError(line.purchase_invoice_id)
    }

    const active = await apPaymentsRepository.findActivePaymentForInvoice(
      line.purchase_invoice_id,
      client,
    )
    if (active && active.id !== excludePaymentId) {
      throw new ApPaymentDuplicateInvoiceError(pi.invoice_number, active.payment_number)
    }

    const totalPaid = await apPaymentsRepository.sumPaidByInvoice(
      line.purchase_invoice_id,
      excludePaymentId,
      client,
    )
    const outstanding = Number(pi.total_amount) - totalPaid
    if (line.amount_paid > outstanding + 0.01) {
      throw new ApPaymentOutstandingExceededError(
        pi.invoice_number,
        outstanding,
        line.amount_paid,
      )
    }
  }

  private async assertAllLinesPostedForPaid(
    client: PoolClient,
    paymentId: string,
    companyId: string,
  ): Promise<void> {
    const payment = await apPaymentsRepository.findById(paymentId, companyId)
    if (!payment) throw new ApPaymentNotFoundError(paymentId)

    for (const line of payment.lines) {
      const pi = await apPaymentsRepository.findPayableInvoice(
        client,
        line.purchase_invoice_id,
        companyId,
      )
      if (!pi || pi.status !== 'POSTED') {
        throw new ApPaymentInvoiceNotPostedForPaidError(line.invoice_number)
      }
    }
  }

  private buildDashboardFromRows(rows: ApDashboardInvoiceRow[]): ApDashboardResponse {
    const agingTotals = emptyAgingBuckets()
    const supplierMap = new Map<string, ApDashboardSupplierRow>()

    for (const row of rows) {
      const out = row.outstanding
      const bucketKey = resolveAgingBucket(row.due_date, row.is_overdue)
      const bucketIdx = agingTotals.findIndex((b) => b.bucket === bucketKey)
      if (bucketIdx >= 0) {
        agingTotals[bucketIdx].amount += out
        agingTotals[bucketIdx].invoice_count += 1
      }

      let supplier = supplierMap.get(row.supplier_id)
      if (!supplier) {
        supplier = {
          supplier_id: row.supplier_id,
          supplier_name: row.supplier_name,
          supplier_code: row.supplier_code,
          pending_post_amount: 0,
          pending_post_count: 0,
          ready_to_pay_amount: 0,
          ready_to_pay_count: 0,
          total_outstanding: 0,
          overdue_amount: 0,
          aging: emptyAgingBuckets(),
        }
        supplierMap.set(row.supplier_id, supplier)
      }

      supplier.total_outstanding += out
      if (row.is_overdue) supplier.overdue_amount += out

      if (row.invoice_status === 'APPROVED') {
        supplier.pending_post_amount += out
        supplier.pending_post_count += 1
      } else {
        supplier.ready_to_pay_amount += out
        supplier.ready_to_pay_count += 1
      }

      const sBucketIdx = supplier.aging.findIndex((b) => b.bucket === bucketKey)
      if (sBucketIdx >= 0) {
        supplier.aging[sBucketIdx].amount += out
        supplier.aging[sBucketIdx].invoice_count += 1
      }
    }

    const suppliers = Array.from(supplierMap.values()).sort((a, b) =>
      b.total_outstanding - a.total_outstanding,
    )

    const summary = suppliers.reduce(
      (acc, s) => ({
        pending_post_amount: acc.pending_post_amount + s.pending_post_amount,
        pending_post_count: acc.pending_post_count + s.pending_post_count,
        ready_to_pay_amount: acc.ready_to_pay_amount + s.ready_to_pay_amount,
        ready_to_pay_count: acc.ready_to_pay_count + s.ready_to_pay_count,
        total_outstanding: acc.total_outstanding + s.total_outstanding,
        overdue_amount: acc.overdue_amount + s.overdue_amount,
        supplier_count: acc.supplier_count + 1,
      }),
      {
        pending_post_amount: 0,
        pending_post_count: 0,
        ready_to_pay_amount: 0,
        ready_to_pay_count: 0,
        total_outstanding: 0,
        overdue_amount: 0,
        supplier_count: 0,
      },
    )

    return { summary, aging_totals: agingTotals, suppliers, due_date_pivot: [] }
  }

  private dueDatePivotLabel(dueDate: string | null, today: Date): string {
    if (!dueDate) return 'Tanpa due date'

    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000)

    if (diffDays < -1) return `${Math.abs(diffDays)} hari lalu`
    if (diffDays === -1) return 'Kemarin'
    if (diffDays === 0) return 'Hari ini'
    if (diffDays === 1) return 'Besok'
    if (diffDays <= 7) return `${diffDays} hari lagi`

    return due.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  private buildDueDatePivot(rows: ApDueDatePivotRow[]): ApDueDatePivotGroup[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayKey = today.toISOString().slice(0, 10)

    const groupMap = new Map<string, ApDueDatePivotGroup>()

    for (const row of rows) {
      const key = row.due_date ?? '__null__'

      if (!groupMap.has(key)) {
        const isToday = row.due_date === todayKey
        groupMap.set(key, {
          due_date: row.due_date,
          due_date_label: this.dueDatePivotLabel(row.due_date, today),
          is_overdue: false,
          is_today: isToday,
          total_outstanding: 0,
          total_invoice_count: 0,
          rows: [],
        })
      }

      const group = groupMap.get(key)!
      group.total_outstanding += row.outstanding
      group.total_invoice_count += row.invoice_count
      group.is_overdue = group.is_overdue || row.is_overdue
      group.rows.push(row)
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })
  }

  async getDashboard(
    companyId: string,
    branchId?: string,
    branchIds?: string[],
  ): Promise<ApDashboardResponse> {
    const [rows, pivotRows] = await Promise.all([
      apPaymentsRepository.findDashboardInvoiceRows(companyId, branchId, branchIds),
      apPaymentsRepository.findDueDatePivotRows(companyId, branchId, branchIds),
    ])

    const base = this.buildDashboardFromRows(rows)
    const due_date_pivot = this.buildDueDatePivot(pivotRows)

    return { ...base, due_date_pivot }
  }

  /**
   * Auto-draft AP saat PI APPROVED (1 PI = 1 payment DRAFT).
   * Idempotent — skip jika sudah ada payment aktif untuk invoice ini.
   */
  async createDraftFromApprovedInvoice(
    purchaseInvoiceId: string,
    companyId: string,
    userId: string,
  ): Promise<ApPaymentDetail | null> {
    const existing = await apPaymentsRepository.findActivePaymentForInvoice(purchaseInvoiceId)
    if (existing) {
      logInfo('AP auto-draft skipped: active payment exists', {
        purchaseInvoiceId,
        paymentId: existing.id,
      })
      return null
    }

    const payment = await apPaymentsRepository.withTransaction(async (client) => {
      const pi = await apPaymentsRepository.findPayableInvoice(
        client,
        purchaseInvoiceId,
        companyId,
      )
      if (!pi || pi.status !== 'APPROVED') return null

      const bankAccountId = await apPaymentsRepository.findDefaultCompanyBankAccountId(
        companyId,
        client,
      )
      if (!bankAccountId) {
        logInfo('AP auto-draft skipped: no default bank account', { companyId, purchaseInvoiceId })
        return null
      }

      const totalPaid = await apPaymentsRepository.sumPaidByInvoice(purchaseInvoiceId, undefined, client)
      const outstanding = Number(pi.total_amount) - totalPaid
      if (outstanding <= 0.01) return null

      const branchCode = await apPaymentsRepository.findBranchCode(client, pi.branch_id)
      const paymentNumber = await apPaymentsRepository.generateApPaymentNumber(
        client,
        companyId,
        branchCode,
      )

      const header = await apPaymentsRepository.create(client, {
        branch_id: pi.branch_id,
        supplier_id: pi.supplier_id,
        bank_account_id: bankAccountId,
        payment_method: 'TRANSFER',
        total_amount: outstanding,
        notes: `Auto-generated dari PI ${pi.invoice_number}`,
        lines: [],
        payment_number: paymentNumber,
        company_id: companyId,
        created_by: userId,
      })

      await apPaymentsRepository.createLines(client, header.id, [
        { purchase_invoice_id: purchaseInvoiceId, amount_paid: outstanding },
      ])

      return header
    })

    if (!payment) return null

    await AuditService.log('CREATE', 'ap_payments', payment.id, userId, null, {
      payment_number: payment.payment_number,
      source: 'PI_APPROVED_AUTO_DRAFT',
      purchase_invoice_id: purchaseInvoiceId,
    })
    logInfo('AP auto-draft created from PI approve', {
      paymentId: payment.id,
      purchaseInvoiceId,
    })
    return this.getById(payment.id, companyId)
  }

  async cancelDraftPaymentsForRejectedInvoice(
    purchaseInvoiceId: string,
    userId: string,
  ): Promise<void> {
    await apPaymentsRepository.withTransaction(async (client) => {
      await apPaymentsRepository.softDeleteDraftPaymentsForInvoice(
        client,
        purchaseInvoiceId,
        userId,
      )
    })
  }

  async list(filter: ApPaymentListFilter): Promise<{
    data: ApPaymentWithRelations[]
    total: number
    page: number
    limit: number
  }> {
    const { data, total } = await apPaymentsRepository.findAll(filter)
    return { data, total, page: filter.page ?? 1, limit: filter.limit ?? 20 }
  }

  async getById(id: string, companyId: string): Promise<ApPaymentDetail> {
    const payment = await apPaymentsRepository.findById(id, companyId)
    if (!payment) throw new ApPaymentNotFoundError(id)
    return payment
  }

  async getOutstandingInvoices(
    companyId: string,
    supplierId?: string,
    branchId?: string,
    overdueOnly?: boolean,
  ): Promise<ApOutstandingInvoice[]> {
    return apPaymentsRepository.findOutstandingInvoices(
      companyId,
      supplierId,
      branchId,
      overdueOnly,
    )
  }

  async create(
    dto: CreateApPaymentDto,
    companyId: string,
    contextBranchId: string,
    userId: string,
  ): Promise<ApPaymentDetail> {
    if (!dto.lines || dto.lines.length === 0) throw new ApPaymentEmptyLinesError()

    const branchId = dto.branch_id ?? contextBranchId

    const linesTotal = dto.lines.reduce((sum, l) => sum + l.amount_paid, 0)
    if (Math.abs(linesTotal - dto.total_amount) > 0.01) {
      throw new ApPaymentLinesTotalMismatchError(linesTotal, dto.total_amount)
    }

    const payment = await apPaymentsRepository.withTransaction(async (client) => {
      const branchCode = await apPaymentsRepository.findBranchCode(client, branchId)
      const paymentNumber = await apPaymentsRepository.generateApPaymentNumber(
        client,
        companyId,
        branchCode,
      )

      for (const line of dto.lines) {
        await this.assertInvoiceLinePayable(client, line, companyId)
      }

      const header = await apPaymentsRepository.create(client, {
        ...dto,
        branch_id: branchId,
        payment_number: paymentNumber,
        company_id: companyId,
        created_by: userId,
      })

      await apPaymentsRepository.createLines(client, header.id, dto.lines)
      return header
    })

    await AuditService.log(
      'CREATE',
      'ap_payments',
      payment.id,
      userId,
      null,
      { payment_number: payment.payment_number },
    )

    logInfo('AP payment created', { id: payment.id, payment_number: payment.payment_number })
    return this.getById(payment.id, companyId)
  }

  async update(
    id: string,
    dto: UpdateApPaymentDto,
    companyId: string,
    userId: string,
  ): Promise<ApPaymentDetail> {
    const existing = await this.getById(id, companyId)
    if (existing.status !== 'DRAFT') {
      throw new ApPaymentInvalidStatusError(existing.status, 'DRAFT')
    }

    const newTotal = dto.total_amount ?? parseFloat(String(existing.total_amount))
    const newLines =
      dto.lines ??
      existing.lines.map((l) => ({
        purchase_invoice_id: l.purchase_invoice_id,
        amount_paid: parseFloat(String(l.amount_paid)),
        notes: l.notes,
      }))

    const linesTotal = newLines.reduce((sum, l) => sum + l.amount_paid, 0)
    if (Math.abs(linesTotal - newTotal) > 0.01) {
      throw new ApPaymentLinesTotalMismatchError(linesTotal, newTotal)
    }

    await apPaymentsRepository.withTransaction(async (client) => {
      await apPaymentsRepository.update(client, id, { ...dto, updated_by: userId })
      if (dto.lines) {
        for (const line of dto.lines) {
          await this.assertInvoiceLinePayable(client, line, companyId, id)
        }
        await apPaymentsRepository.replaceLines(client, id, dto.lines)
      }
    })

    logInfo('AP payment updated', { id })
    return this.getById(id, companyId)
  }

  async submit(id: string, companyId: string, userId: string): Promise<ApPaymentDetail> {
    const existing = await this.getById(id, companyId)
    if (existing.status !== 'DRAFT') {
      throw new ApPaymentInvalidStatusError(existing.status, 'DRAFT')
    }

    await apPaymentsRepository.withTransaction(async (client) => {
      await apPaymentsRepository.updateStatus(client, id, 'PENDING_APPROVAL', {
        requested_by: userId,
        requested_at: new Date().toISOString(),
        updated_by: userId,
      })
    })

    await AuditService.log('UPDATE', 'ap_payments', id, userId, { status: 'DRAFT' }, { status: 'PENDING_APPROVAL' })
    logInfo('AP payment submitted', { id })
    return this.getById(id, companyId)
  }

  async approve(id: string, companyId: string, userId: string): Promise<ApPaymentDetail> {
    const existing = await this.getById(id, companyId)
    if (existing.status !== 'PENDING_APPROVAL') {
      throw new ApPaymentInvalidStatusError(existing.status, 'PENDING_APPROVAL')
    }

    await apPaymentsRepository.withTransaction(async (client) => {
      await apPaymentsRepository.updateStatus(client, id, 'APPROVED', {
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_by: userId,
      })
    })

    await AuditService.log('UPDATE', 'ap_payments', id, userId, { status: 'PENDING_APPROVAL' }, { status: 'APPROVED' })
    logInfo('AP payment approved', { id })
    return this.getById(id, companyId)
  }

  async reject(
    id: string,
    dto: RejectApPaymentDto,
    companyId: string,
    userId: string,
  ): Promise<ApPaymentDetail> {
    const existing = await this.getById(id, companyId)
    if (existing.status !== 'PENDING_APPROVAL') {
      throw new ApPaymentInvalidStatusError(existing.status, 'PENDING_APPROVAL')
    }

    await apPaymentsRepository.withTransaction(async (client) => {
      await apPaymentsRepository.updateStatus(client, id, 'REJECTED', {
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: dto.rejection_reason,
        updated_by: userId,
      })
    })

    await AuditService.log('UPDATE', 'ap_payments', id, userId, { status: 'PENDING_APPROVAL' }, {
      status: 'REJECTED',
      rejection_reason: dto.rejection_reason,
    })
    logInfo('AP payment rejected', { id })
    return this.getById(id, companyId)
  }

  async uploadProof(
    id: string,
    dto: UploadProofDto,
    companyId: string,
    userId: string,
  ): Promise<ApPaymentDetail> {
    const existing = await this.getById(id, companyId)
    if (!['APPROVED', 'PAID'].includes(existing.status)) {
      throw new ApPaymentInvalidStatusError(existing.status, ['APPROVED', 'PAID'])
    }

    await apPaymentsRepository.withTransaction(async (client) => {
      await apPaymentsRepository.updateStatus(client, id, existing.status, {
        proof_url: dto.proof_url,
        proof_uploaded_at: new Date().toISOString(),
        proof_uploaded_by: userId,
        updated_by: userId,
      })
    })

    logInfo('AP payment proof uploaded', { id })
    return this.getById(id, companyId)
  }

  async markPaid(
    id: string,
    paymentDate: string | undefined,
    companyId: string,
    userId: string,
  ): Promise<ApPaymentDetail> {
    const existing = await this.getById(id, companyId)
    if (existing.status !== 'APPROVED') {
      throw new ApPaymentInvalidStatusError(existing.status, 'APPROVED')
    }
    if (!existing.proof_url) {
      throw new ApPaymentProofRequiredError()
    }

    await apPaymentsRepository.withTransaction(async (client) => {
      await this.assertAllLinesPostedForPaid(client, id, companyId)
      await apPaymentsRepository.updateStatus(client, id, 'PAID', {
        paid_by: userId,
        paid_at: new Date().toISOString(),
        payment_date: paymentDate ?? new Date().toISOString().slice(0, 10),
        updated_by: userId,
      })
    })

    await AuditService.log('UPDATE', 'ap_payments', id, userId, { status: 'APPROVED' }, { status: 'PAID' })
    logInfo('AP payment marked as paid', { id })
    return this.getById(id, companyId)
  }

  async reconcile(
    id: string,
    dto: ReconcileApPaymentDto,
    companyId: string,
    userId: string,
  ): Promise<ApPaymentDetail> {
    const existing = await this.getById(id, companyId)
    if (existing.status !== 'PAID') {
      throw new ApPaymentInvalidStatusError(existing.status, 'PAID')
    }

    await apPaymentsRepository.withTransaction(async (client) => {
      await apPaymentsRepository.updateStatus(client, id, 'RECONCILED', {
        bank_statement_id: dto.bank_statement_id,
        reconciled_by: userId,
        reconciled_at: new Date().toISOString(),
        updated_by: userId,
      })
    })

    await AuditService.log('UPDATE', 'ap_payments', id, userId, { status: 'PAID' }, {
      status: 'RECONCILED',
      bank_statement_id: dto.bank_statement_id,
    })
    logInfo('AP payment reconciled', { id })
    return this.getById(id, companyId)
  }

  async delete(id: string, companyId: string, userId: string): Promise<void> {
    const existing = await this.getById(id, companyId)
    if (existing.status !== 'DRAFT') {
      throw new ApPaymentInvalidStatusError(existing.status, 'DRAFT')
    }

    await apPaymentsRepository.withTransaction(async (client) => {
      await apPaymentsRepository.softDelete(client, id, userId)
    })

    await AuditService.log('DELETE', 'ap_payments', id, userId, { payment_number: existing.payment_number }, null)
    logInfo('AP payment deleted', { id })
  }
}

export const apPaymentsService = new ApPaymentsService()
