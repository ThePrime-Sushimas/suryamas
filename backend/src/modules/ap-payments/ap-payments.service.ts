import type { PoolClient } from 'pg'
import { logInfo } from '../../config/logger'
import { AuditService } from '../monitoring/monitoring.service'
import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
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
  OutstandingInvoicesQuery,
  OutstandingInvoicesResponse,
  OutstandingInvoiceRow,
  BulkCreateApPaymentDto,
  BulkCreateApPaymentResponse,
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
  ApPaymentJournalCoaMissingError,
  ApPaymentNoJournalError,
  ApPaymentJournalAlreadyPostedError,
  ApPaymentJournalNotReadyError,
  ApBulkEmptyPaymentsError,
  ApBulkInvoiceNotFoundError,
  ApBulkInvoiceNotEligibleError,
  ApBulkOutstandingExceededError,
  ApBulkProofUploadFailedError,
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

  async getOutstandingInvoicesPaginated(
    companyId: string,
    query: OutstandingInvoicesQuery,
    branchIds?: string[],
  ): Promise<OutstandingInvoicesResponse> {
    const { data, total } = await apPaymentsRepository.findOutstandingPaginated(
      companyId,
      query,
      branchIds,
    )
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }
  }

  /**
   * Assign (or clear) a bank account to an outstanding invoice.
   * Finance uses this to indicate which company bank account should be used for payment.
   */
  async assignBankAccountToInvoice(
    invoiceId: string,
    bankAccountId: number | null,
    companyId: string,
    userId: string,
  ): Promise<void> {
    await apPaymentsRepository.assignBankAccount(invoiceId, bankAccountId, companyId, userId)
  }

  /**
   * Fetch outstanding invoices by specific IDs (for bulk-create page).
   * Much faster than paginated query since it uses primary key lookup.
   */
  async getOutstandingInvoicesByIds(
    companyId: string,
    invoiceIds: string[],
  ): Promise<OutstandingInvoiceRow[]> {
    return apPaymentsRepository.findOutstandingByIds(companyId, invoiceIds)
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
      await apPaymentsRepository.updateStatus(client, id, 'APPROVED', {
        requested_by: userId,
        requested_at: new Date().toISOString(),
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_by: userId,
      })
    })

    await AuditService.log('UPDATE', 'ap_payments', id, userId, { status: 'DRAFT' }, { status: 'APPROVED' })
    logInfo('AP payment submitted → approved (skip approval)', { id })
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

  private async createPaymentJournal(
    payment: ApPaymentDetail,
    paymentDate: string,
    companyId: string,
    actorId: string,
  ): Promise<{ id: string; journal_number: string }> {
    const coa = await apPaymentsRepository.findPurPayJournalCoa(companyId, payment.bank_account_id)
    if (!coa) {
      throw new ApPaymentJournalCoaMissingError(
        'pastikan purpose PUR-PAY aktif, akun hutang (DEBIT) ter-mapping, dan rekening bank punya COA',
      )
    }

    const amount = Number(payment.total_amount)
    const desc = `Pembayaran hutang ${payment.payment_number}${payment.supplier_name ? ` — ${payment.supplier_name}` : ''}`

    const journal = await journalHeadersService.create(
      {
        company_id: companyId,
        branch_id: payment.branch_id,
        journal_date: paymentDate,
        journal_type: 'PAYABLE',
        description: desc,
        source_module: 'ap_payments',
        reference_type: 'ap_payment',
        reference_id: payment.id,
        reference_number: payment.payment_number,
        currency: 'IDR',
        exchange_rate: 1,
        lines: [
          {
            line_number: 1,
            account_id: coa.apAccountId,
            description: desc,
            debit_amount: amount,
            credit_amount: 0,
          },
          {
            line_number: 2,
            account_id: coa.bankCoaId,
            description: desc,
            debit_amount: 0,
            credit_amount: amount,
          },
        ],
      },
      actorId,
    )

    return { id: journal.id, journal_number: journal.journal_number }
  }

  private async postJournalWorkflow(
    journalId: string,
    actorId: string,
    companyId: string,
  ): Promise<void> {
    const journal = await journalHeadersService.getById(journalId, companyId)
    if (journal.status === 'POSTED') {
      throw new ApPaymentJournalAlreadyPostedError()
    }
    if (journal.status === 'DRAFT') {
      await journalHeadersService.submit(journalId, actorId, companyId)
    }
    const refreshed = await journalHeadersService.getById(journalId, companyId)
    if (refreshed.status === 'SUBMITTED') {
      await journalHeadersService.approve(journalId, actorId, companyId)
    }
    const beforePost = await journalHeadersService.getById(journalId, companyId)
    if (beforePost.status !== 'APPROVED') {
      throw new ApPaymentJournalNotReadyError(beforePost.status)
    }
    await journalHeadersService.post(journalId, actorId, companyId)
  }

  async markPaid(
    id: string,
    paymentDate: string | undefined,
    companyId: string,
    userId: string,
    employeeId?: string,
  ): Promise<ApPaymentDetail> {
    const existing = await this.getById(id, companyId)
    if (existing.status !== 'APPROVED') {
      throw new ApPaymentInvalidStatusError(existing.status, 'APPROVED')
    }
    if (!existing.proof_url) {
      throw new ApPaymentProofRequiredError()
    }
    if (existing.journal_id) {
      throw new ApPaymentInvalidStatusError('already has journal', 'no journal')
    }

    const resolvedPaymentDate = paymentDate ?? new Date().toISOString().slice(0, 10)
    const actorId = employeeId ?? userId

    let journalId: string | null = null
    try {
      const journal = await this.createPaymentJournal(existing, resolvedPaymentDate, companyId, actorId)
      journalId = journal.id

      await apPaymentsRepository.withTransaction(async (client) => {
        await this.assertAllLinesPostedForPaid(client, id, companyId)
        await apPaymentsRepository.updateStatus(client, id, 'PAID', {
          paid_by: userId,
          paid_at: new Date().toISOString(),
          payment_date: resolvedPaymentDate,
          journal_id: journalId,
          updated_by: userId,
        })
      })
    } catch (err) {
      if (journalId) {
        await journalHeadersService.forceDelete(journalId, userId, companyId).catch(() => undefined)
      }
      throw err
    }

    await AuditService.log('UPDATE', 'ap_payments', id, userId, { status: 'APPROVED' }, {
      status: 'PAID',
      journal_id: journalId,
    })
    logInfo('AP payment marked as paid with journal', { id, journal_id: journalId })
    return this.getById(id, companyId)
  }

  async postJournal(
    id: string,
    companyId: string,
    userId: string,
    employeeId?: string,
  ): Promise<ApPaymentDetail> {
    const existing = await this.getById(id, companyId)
    if (!['PAID', 'RECONCILED'].includes(existing.status)) {
      throw new ApPaymentInvalidStatusError(existing.status, ['PAID', 'RECONCILED'])
    }
    if (!existing.journal_id) {
      throw new ApPaymentNoJournalError()
    }

    const actorId = employeeId ?? userId
    await this.postJournalWorkflow(existing.journal_id, actorId, companyId)

    await AuditService.log('POST', 'ap_payments', id, userId, undefined, {
      journal_id: existing.journal_id,
    })
    logInfo('AP payment journal posted', { id, journal_id: existing.journal_id })
    return this.getById(id, companyId)
  }

  async deleteJournal(
    id: string,
    companyId: string,
    userId: string,
  ): Promise<ApPaymentDetail> {
    const existing = await this.getById(id, companyId)
    if (!existing.journal_id) {
      throw new ApPaymentNoJournalError()
    }
    if (!['PAID', 'RECONCILED'].includes(existing.status)) {
      throw new ApPaymentInvalidStatusError(existing.status, ['PAID', 'RECONCILED'])
    }

    const journalId = existing.journal_id
    await journalHeadersService.forceDelete(journalId, userId, companyId)

    await AuditService.log('DELETE', 'ap_payments', id, userId, {
      status: existing.status,
      journal_id: journalId,
    }, {
      status: 'APPROVED',
      journal_id: null,
    })
    logInfo('AP payment journal deleted, reverted to APPROVED', { id, journal_id: journalId })
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

  async getReconcileCandidates(
    paymentId: string,
    companyId: string,
  ): Promise<Array<{ id: number; transaction_date: string; description: string; debit_amount: number; credit_amount: number; reference_number: string | null }>> {
    const payment = await this.getById(paymentId, companyId)
    return apPaymentsRepository.findReconcileCandidates(
      payment.bank_account_id,
      companyId,
      Number(payment.total_amount),
    )
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

  // ── Bulk Payment Creation ──────────────────────────────────
  async createBulk(
    dto: BulkCreateApPaymentDto,
    companyId: string,
    contextBranchId: string,
    userId: string,
  ): Promise<BulkCreateApPaymentResponse> {
    // 1. Validate payments array is not empty
    if (!dto.payments || dto.payments.length === 0) {
      throw new ApBulkEmptyPaymentsError()
    }

    // 2. Collect all unique invoice IDs from all payments' invoice_lines
    const allInvoiceIds = Array.from(
      new Set(
        dto.payments.flatMap((p) => p.invoice_lines.map((l) => l.purchase_invoice_id)),
      ),
    )

    // 3–9. Execute within a single transaction
    const result = await apPaymentsRepository.withTransaction(async (client) => {
      // 4. Validate all invoices exist and are eligible
      const invoiceRows = await apPaymentsRepository.validateInvoicesForBulk(
        client,
        allInvoiceIds,
        companyId,
      )

      // Check all IDs were found
      const foundIds = new Set(invoiceRows.map((r) => r.id))
      const missingIds = allInvoiceIds.filter((id) => !foundIds.has(id))
      if (missingIds.length > 0) {
        throw new ApBulkInvoiceNotFoundError(missingIds)
      }

      // Check all have eligible status (APPROVED or POSTED)
      const ineligibleIds = invoiceRows
        .filter((r) => !['APPROVED', 'POSTED'].includes(r.status))
        .map((r) => r.id)
      if (ineligibleIds.length > 0) {
        throw new ApBulkInvoiceNotEligibleError(ineligibleIds)
      }

      // Check amount_paid does not exceed remaining_amount (tolerance 0.01)
      const invoiceMap = new Map(invoiceRows.map((r) => [r.id, r]))
      const exceededDetails: Array<{ invoiceId: string; outstanding: number; requested: number }> = []

      for (const payment of dto.payments) {
        for (const line of payment.invoice_lines) {
          const invoice = invoiceMap.get(line.purchase_invoice_id)
          if (invoice && line.amount_paid > invoice.remaining_amount + 0.01) {
            exceededDetails.push({
              invoiceId: line.purchase_invoice_id,
              outstanding: invoice.remaining_amount,
              requested: line.amount_paid,
            })
          }
        }
      }
      if (exceededDetails.length > 0) {
        throw new ApBulkOutstandingExceededError(exceededDetails)
      }

      // Note: Proof upload is handled separately after payment creation (on detail page)

      // 6. Calculate total_amount (sum of all invoice_lines amount_paid)
      const totalAmount = dto.payments.reduce(
        (sum, p) => sum + p.invoice_lines.reduce((s, l) => s + l.amount_paid, 0),
        0,
      )

      // 7. Create batch record
      const batch = await apPaymentsRepository.createBatch(client, {
        created_by: userId,
        total_payments: dto.payments.length,
        total_amount: totalAmount,
        notes: dto.batch_notes ?? null,
      })

      // 8. Generate payment_number for each payment and build payment records
      const paymentsToCreate: Array<{
        company_id: string
        branch_id: string
        supplier_id: string
        bank_account_id: number
        payment_method: string
        total_amount: number
        payment_number: string
        bulk_payment_batch_id: string
        created_by: string
        notes?: string | null
        status: string
        paid_at: string | null
        paid_by: string | null
        payment_date: string | null
        proof_url: string | null
        proof_uploaded_at: string | null
        proof_uploaded_by: string | null
        invoice_lines: Array<{
          purchase_invoice_id: string
          amount_paid: number
        }>
      }> = []

      for (let i = 0; i < dto.payments.length; i++) {
        const payment = dto.payments[i]

        // Determine branch_id from the first invoice in this payment group
        const firstInvoice = invoiceMap.get(payment.invoice_lines[0].purchase_invoice_id)
        const branchId = firstInvoice?.branch_id ?? contextBranchId

        const branchCode = await apPaymentsRepository.findBranchCode(client, branchId)
        const paymentNumber = await apPaymentsRepository.generateApPaymentNumber(
          client,
          companyId,
          branchCode,
        )

        const paymentTotal = payment.invoice_lines.reduce((s, l) => s + l.amount_paid, 0)

        paymentsToCreate.push({
          company_id: companyId,
          branch_id: branchId,
          supplier_id: payment.supplier_id,
          bank_account_id: payment.bank_account_id,
          payment_method: payment.payment_method ?? 'TRANSFER',
          total_amount: paymentTotal,
          payment_number: paymentNumber,
          bulk_payment_batch_id: batch.id,
          created_by: userId,
          notes: payment.notes ?? null,
          status: 'DRAFT',
          paid_at: null,
          paid_by: null,
          payment_date: null,
          proof_url: null,
          proof_uploaded_at: null,
          proof_uploaded_by: null,
          invoice_lines: payment.invoice_lines,
        })
      }

      // 9. Create all payments with their invoice lines (status=DRAFT)
      const createdPayments = await apPaymentsRepository.createBulkPayments(
        client,
        paymentsToCreate,
      )

      // Build supplier name lookup from validated invoices
      const supplierNames = new Map<string, string>()
      for (const payment of paymentsToCreate) {
        if (!supplierNames.has(payment.supplier_id)) {
          // Look up supplier name from the invoice rows
          const invoiceForSupplier = invoiceRows.find(
            (r) => r.supplier_id === payment.supplier_id,
          )
          if (invoiceForSupplier) {
            // We need to get supplier name - query it
            const { rows: supplierRows } = await client.query<{ supplier_name: string }>(
              'SELECT supplier_name FROM suppliers WHERE id = $1',
              [payment.supplier_id],
            )
            if (supplierRows.length > 0) {
              supplierNames.set(payment.supplier_id, supplierRows[0].supplier_name)
            }
          }
        }
      }

      // 10. Return response
      return {
        batch_id: batch.id,
        total_payments: createdPayments.length,
        total_amount: totalAmount,
        payments: createdPayments.map((p, idx) => ({
          id: p.id,
          payment_number: p.payment_number,
          supplier_name: supplierNames.get(paymentsToCreate[idx].supplier_id) ?? '',
          total_amount: Number(p.total_amount),
        })),
      }
    })

    logInfo('Bulk AP payments created (DRAFT)', {
      batch_id: result.batch_id,
      total_payments: result.total_payments,
      total_amount: result.total_amount,
    })

    return result
  }

  // ── Verify Screenshot (OCR cross-check with Gemini) ─────────
  async verifyScreenshot(
    companyId: string,
    image: string,
    mimeType: string,
    paymentIds?: string[],
  ): Promise<import('./ap-payments.types').VerifyScreenshotResult> {
    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) throw new Error('GEMINI_API_KEY tidak dikonfigurasi di server')

    // 1. Call Gemini untuk OCR
    const prompt = `Ini adalah screenshot halaman "Transaksi Yang Belum Diotorisasi" dari BCA Bisnis internet banking.
Extract semua baris transaksi. Untuk setiap baris ambil:
1. Nomor rekening tujuan atau BCA Virtual Account (kolom "Ke Rekening / No. BCA Virtual Account") — angka saja, tanpa spasi atau tanda hubung
2. Jumlah/nominal (kolom "Jumlah") — angka saja, tanpa "Rp" dan tanpa titik pemisah ribuan
3. Jenis transfer (BCA Virtual Account atau Rekening BCA)
4. Nama tujuan jika ada

Kembalikan HANYA JSON array, tanpa teks lain:
[{"va":"07301060010003650","amount":305000,"type":"BCA Virtual Account","name":"SURYA MAS PRATAMA PT"},...]`

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,


      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: image } },
            ],
          }],
          generationConfig: { temperature: 0 },
        }),
      },
    )

    if (!geminiRes.ok) {
      const errBody = await geminiRes.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(`Gemini API error: ${errBody.error?.message ?? geminiRes.statusText}`)
    }

    const geminiData = await geminiRes.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const raw = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = raw.replace(/```json|```/g, '').trim()

    type BcaOcrRow = import('./ap-payments.types').BcaOcrRow
    let ocrRows: BcaOcrRow[]
    try {
      ocrRows = JSON.parse(clean) as BcaOcrRow[]
    } catch {
      throw new Error('Gagal membaca hasil OCR dari Gemini. Coba lagi atau periksa kualitas screenshot.')
    }

    const ocrTotal = ocrRows.reduce((s, r) => s + Number(r.amount), 0)

    // 2. Cross-check dengan AP Payments di DB
    if (!paymentIds || paymentIds.length === 0) {
      return { ocr_rows: ocrRows, ocr_total: ocrTotal, matches: [] }
    }

    const payments = await Promise.all(
      paymentIds.map((id) => this.getById(id, companyId)),
    )

    const normalizeVa = (v: string) => v.replace(/\D/g, '')

    // Build lookup: for each payment, get supplier bank accounts from invoice lines
    const paymentSupplierBanks = new Map<string, string[]>()
    for (const p of payments) {
      const bankNumbers = await apPaymentsRepository.findSupplierBankNumbersForPayment(p.id)
      paymentSupplierBanks.set(p.id, bankNumbers)
    }

    type MatchResult = import('./ap-payments.types').VerifyScreenshotResult['matches'][number]
    const matches: MatchResult[] = []
    const matchedOcrIndices = new Set<number>()

    for (const p of payments) {
      const supplierBanks = paymentSupplierBanks.get(p.id) ?? []
      const systemAmount = Number(p.total_amount)

      // Try to find OCR row matching by supplier bank number + amount
      let foundIdx = -1
      for (let i = 0; i < ocrRows.length; i++) {
        if (matchedOcrIndices.has(i)) continue
        const ocrVa = normalizeVa(ocrRows[i].va)
        const ocrAmt = Number(ocrRows[i].amount)
        const bankMatch = supplierBanks.some((b) => normalizeVa(b) === ocrVa || ocrVa.endsWith(normalizeVa(b)) || normalizeVa(b).endsWith(ocrVa))
        if (bankMatch && ocrAmt === systemAmount) {
          foundIdx = i
          break
        }
      }

      // If exact match not found, try by bank number only
      if (foundIdx === -1) {
        for (let i = 0; i < ocrRows.length; i++) {
          if (matchedOcrIndices.has(i)) continue
          const ocrVa = normalizeVa(ocrRows[i].va)
          const bankMatch = supplierBanks.some((b) => normalizeVa(b) === ocrVa || ocrVa.endsWith(normalizeVa(b)) || normalizeVa(b).endsWith(ocrVa))
          if (bankMatch) {
            foundIdx = i
            break
          }
        }
      }

      if (foundIdx === -1) {
        matches.push({
          payment_id: p.id,
          payment_number: p.payment_number,
          bank_account_number: supplierBanks[0] ?? '',
          system_amount: systemAmount,
          ocr_amount: null,
          status: 'not_found_in_screenshot',
        })
      } else {
        matchedOcrIndices.add(foundIdx)
        const ocrAmount = Number(ocrRows[foundIdx].amount)
        matches.push({
          payment_id: p.id,
          payment_number: p.payment_number,
          bank_account_number: ocrRows[foundIdx].va,
          system_amount: systemAmount,
          ocr_amount: ocrAmount,
          status: ocrAmount === systemAmount ? 'match' : 'amount_mismatch',
        })
      }
    }

    // Add OCR rows not matched to any payment
    ocrRows.forEach((r, i) => {
      if (!matchedOcrIndices.has(i)) {
        matches.push({
          payment_id: '',
          payment_number: '',
          bank_account_number: r.va,
          system_amount: 0,
          ocr_amount: Number(r.amount),
          status: 'not_found_in_system',
        })
      }
    })

    return { ocr_rows: ocrRows, ocr_total: ocrTotal, matches }
  }
}

export const apPaymentsService = new ApPaymentsService()
