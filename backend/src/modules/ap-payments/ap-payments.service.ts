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
} from './ap-payments.types'
import {
  ApPaymentNotFoundError,
  ApPaymentInvalidStatusError,
  ApPaymentInvoiceNotPostedError,
  ApPaymentOutstandingExceededError,
  ApPaymentLinesTotalMismatchError,
  ApPaymentProofRequiredError,
  ApPaymentEmptyLinesError,
} from './ap-payments.errors'

export class ApPaymentsService {
  private async assertInvoiceLinePayable(
    client: PoolClient,
    line: { purchase_invoice_id: string; amount_paid: number },
    companyId: string,
    excludePaymentId?: string,
  ): Promise<void> {
    const pi = await apPaymentsRepository.findPostedInvoice(
      client,
      line.purchase_invoice_id,
      companyId,
    )
    if (!pi || pi.status !== 'POSTED') {
      throw new ApPaymentInvoiceNotPostedError(line.purchase_invoice_id)
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
