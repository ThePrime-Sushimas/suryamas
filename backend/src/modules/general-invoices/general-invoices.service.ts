import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
import { AuditService } from '../monitoring/monitoring.service'
import { storageService } from '../../services/storage.service'
import { resolveDocumentUploadExtension } from '../../utils/document-upload.util'
import { logInfo } from '../../config/logger'
import { BusinessRuleError } from '../../utils/errors.base'
import {
  generalInvoiceRepository,
  generalPaymentRepository,
  generalTemplateRepository,
  vendorRepository,
} from './general-invoices.repository'
import type {
  CreateVendorDto,
  UpdateVendorDto,
  VendorListFilter,
  Vendor,
  CreateGeneralInvoiceDto,
  UpdateGeneralInvoiceDto,
  GeneralInvoiceListFilter,
  GeneralInvoice,
  GeneralInvoiceDetail,
  CreateGeneralInvoicePaymentDto,
  GeneralPaymentListFilter,
  GeneralInvoicePayment,
  CreateGeneralInvoiceTemplateDto,
  GenerateFromTemplateDto,
  GeneralInvoiceTemplate,
  GeneralApDashboard,
  ExpenseType,
} from './general-invoices.types'
import { getAccessibleBranchIds, getAccessibleCompanyIds, getCompanyIdForBranch, requireBranchAccess } from '../../utils/branch-access.util'
import {
  GeneralInvoiceNotFoundError,
  GeneralInvoiceInvalidStatusError,
  GeneralInvoiceAlreadyPaidError,
  GeneralInvoiceLiabilityCoaMissingError,
  GeneralInvoiceBankCoaMissingError,
  GeneralInvoiceLineEmptyError,
  GeneralPaymentNotFoundError,
  GeneralPaymentInvalidStatusError,
  GeneralPaymentProofRequiredError,
  GeneralPaymentJournalMissingError,
  VendorNotFoundError,
  GeneralTemplateNotFoundError,
} from './general-invoices.errors'

// ============================================================
// VENDOR SERVICE
// ============================================================
export class VendorService {
  async list(filter: VendorListFilter) {
    const { data, total } = await vendorRepository.findAll(filter)
    return { data, total, page: filter.page ?? 1, limit: filter.limit ?? 50 }
  }

  async getById(id: string, companyIds: string[]): Promise<Vendor> {
    const vendor = await vendorRepository.findById(id, companyIds)
    if (!vendor) throw new VendorNotFoundError(id)
    return vendor
  }

  async create(dto: CreateVendorDto, companyIds: string[], contextCompanyId: string, userId: string): Promise<Vendor> {
    const companyId = (contextCompanyId || companyIds[0]) ?? ''
    const vendor = await vendorRepository.withTransaction(async (client) => {
      return vendorRepository.create(client, companyId, dto, userId)
    })
    await AuditService.log('CREATE', 'vendors', vendor.id, userId, null, { vendor_code: vendor.vendor_code })
    logInfo('Vendor created', { id: vendor.id, code: vendor.vendor_code })
    return vendor
  }

  async update(id: string, dto: UpdateVendorDto, companyIds: string[], userId: string): Promise<Vendor> {
    const existing = await this.getById(id, companyIds)
    const companyId = existing.company_id
    const updated = await vendorRepository.withTransaction(async (client) => {
      return vendorRepository.update(client, id, companyId, dto, userId)
    })
    await AuditService.log('UPDATE', 'vendors', id, userId, null, dto)
    return updated
  }

  async delete(id: string, companyIds: string[], userId: string): Promise<void> {
    const existing = await this.getById(id, companyIds)
    const companyId = existing.company_id
    await vendorRepository.withTransaction(async (client) => {
      await vendorRepository.softDelete(client, id, companyId, userId)
    })
    await AuditService.log('DELETE', 'vendors', id, userId, null, null)
  }
}

// ============================================================
// GENERAL INVOICE SERVICE
// ============================================================
export class GeneralInvoiceService {
  private async requireById(id: string, branchIds: string[]): Promise<GeneralInvoiceDetail> {
    const inv = await generalInvoiceRepository.findByIdAccessible(id, branchIds)
    if (!inv) throw new GeneralInvoiceNotFoundError(id)
    return inv
  }

  async list(filter: GeneralInvoiceListFilter) {
    const { data, total } = await generalInvoiceRepository.findAll(filter)
    return { data, total, page: filter.page ?? 1, limit: filter.limit ?? 20 }
  }

  async getById(id: string, branchIds: string[]): Promise<GeneralInvoiceDetail> {
    return this.requireById(id, branchIds)
  }

  async getDashboard(branchIds: string[], includeConfidential = false): Promise<GeneralApDashboard> {
    return generalInvoiceRepository.getDashboard(branchIds, includeConfidential)
  }

  async create(
    dto: CreateGeneralInvoiceDto,
    branchIds: string[],
    contextBranchId: string,
    userId: string,
  ): Promise<GeneralInvoiceDetail> {
    if (!dto.lines || dto.lines.length === 0) throw new GeneralInvoiceLineEmptyError()

    const branchId = dto.branch_id ?? contextBranchId
    requireBranchAccess(branchId, branchIds)
    const companyId = (await getCompanyIdForBranch(branchId)) ?? ''

    const { id } = await generalInvoiceRepository.withTransaction(async (client) => {
      const branchCode = await generalInvoiceRepository.findBranchCode(client, branchId)
      const invoiceNumber = dto.invoice_number
        ?? await generalInvoiceRepository.generateInvoiceNumber(client, companyId, branchCode)

      const header = await generalInvoiceRepository.create(client, companyId, branchId, { ...dto, invoice_number: invoiceNumber }, invoiceNumber, userId)
      await generalInvoiceRepository.createLines(client, header.id, dto.lines)
      return header
    })

    await AuditService.log('CREATE', 'general_invoices', id, userId, null, {
      vendor_id: dto.vendor_id,
      expense_type: dto.expense_type,
    })
    logInfo('General invoice created', { id })
    return this.getById(id, branchIds)
  }

  async update(
    id: string,
    dto: UpdateGeneralInvoiceDto,
    branchIds: string[],
    userId: string,
  ): Promise<GeneralInvoiceDetail> {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (existing.status !== 'DRAFT') {
      throw new GeneralInvoiceInvalidStatusError(existing.status, 'DRAFT')
    }

    await generalInvoiceRepository.withTransaction(async (client) => {
      await generalInvoiceRepository.update(client, id, companyId, dto, userId)
      if (dto.lines) {
        await generalInvoiceRepository.replaceLines(client, id, dto.lines)
      }
    })

    await AuditService.log('UPDATE', 'general_invoices', id, userId, null, dto)
    return this.getById(id, branchIds)
  }

  /**
   * POST invoice → buat jurnal hutang usaha umum
   *
   * Journal:
   *   DR  Beban xxx (tiap line di invoice)   xxx
   *       CR  Hutang Usaha Umum (GEN-AP-LIABILITY)  xxx
   */
  async post(id: string, branchIds: string[], userId: string): Promise<GeneralInvoiceDetail> {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (existing.status !== 'DRAFT') {
      throw new GeneralInvoiceInvalidStatusError(existing.status, 'DRAFT')
    }
    if (existing.lines.length === 0) throw new GeneralInvoiceLineEmptyError()

    // Ambil COA hutang usaha umum dari accounting_purposes
    const liabilityAccountId = await generalInvoiceRepository.findLiabilityAccountId(companyId)
    if (!liabilityAccountId) throw new GeneralInvoiceLiabilityCoaMissingError()

    const totalAmount = Number(existing.total_amount)

    // Build journal lines: DR tiap expense account, CR liability account
    const journalLines = existing.lines.map((line, i) => ({
      line_number: i + 1,
      account_id: line.account_id,
      description: line.description ?? existing.vendor_name,
      debit_amount: Number(line.total_amount),
      credit_amount: 0,
    }))

    // CR: Hutang Usaha Umum
    journalLines.push({
      line_number: journalLines.length + 1,
      account_id: liabilityAccountId,
      description: `Hutang ${existing.vendor_name} — ${existing.invoice_number}`,
      debit_amount: 0,
      credit_amount: totalAmount,
    })

    let journalId: string | null = null
    try {
      const journal = await journalHeadersService.create(
        {
          company_id: companyId,
          branch_id: existing.branch_id,
          journal_date: existing.invoice_date,
          journal_type: 'PAYABLE',
          description: `Tagihan ${existing.expense_type} — ${existing.vendor_name} (${existing.invoice_number})`,
          source_module: 'general_invoices',
          reference_type: 'general_invoice',
          reference_id: existing.id,
          reference_number: existing.invoice_number,
          currency: 'IDR',
          exchange_rate: 1,
          lines: journalLines,
        },
        userId,
      )
      journalId = journal.id

      // Auto submit → approve → post journal
      await journalHeadersService.submitAsUser(journalId, userId)
      await journalHeadersService.approveAsUser(journalId, userId)
      await journalHeadersService.postAsUser(journalId, userId)

      // Update invoice status
      await generalInvoiceRepository.withTransaction(async (client) => {
        await generalInvoiceRepository.updateStatus(client, id, 'POSTED', {
          journal_id: journalId,
          posted_by: userId,
          posted_at: new Date().toISOString(),
          updated_by: userId,
        })
      })
    } catch (err) {
      if (journalId) {
        await journalHeadersService.forceDeleteAsUser(journalId, userId).catch(() => undefined)
      }
      throw err
    }

    await AuditService.log('UPDATE', 'general_invoices', id, userId, { status: 'DRAFT' }, { status: 'POSTED', journal_id: journalId })
    logInfo('General invoice posted', { id, journal_id: journalId })
    return this.getById(id, branchIds)
  }

  async cancel(id: string, branchIds: string[], userId: string): Promise<GeneralInvoiceDetail> {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (!['DRAFT', 'POSTED'].includes(existing.status)) {
      throw new GeneralInvoiceInvalidStatusError(existing.status, ['DRAFT', 'POSTED'])
    }

    // Kalau sudah ada payment aktif, tidak bisa cancel
    const payment = await generalPaymentRepository.findByInvoiceId(id)
    if (payment && ['APPROVED', 'PAID', 'RECONCILED'].includes(payment.status)) {
      throw new GeneralInvoiceAlreadyPaidError(payment.payment_number, payment.status)
    }

    // Hapus payment DRAFT agar tidak menggantung
    if (payment?.status === 'DRAFT') {
      await generalPaymentRepository.withTransaction(async (client) => {
        await generalPaymentRepository.softDelete(client, payment.id, userId)
      })
    }

    // Hard-delete jurnal posting (forceDelete null FK + revert POSTED→DRAFT)
    if (existing.status === 'POSTED' && existing.journal_id) {
      await journalHeadersService.forceDeleteAsUser(existing.journal_id, userId)
    }

    await generalInvoiceRepository.withTransaction(async (client) => {
      await generalInvoiceRepository.updateStatus(client, id, 'CANCELLED', {
        updated_by: userId,
        journal_id: null,
        posted_by: null,
        posted_at: null,
      })
    })

    await AuditService.log('UPDATE', 'general_invoices', id, userId, { status: existing.status }, { status: 'CANCELLED' })
    return this.getById(id, branchIds)
  }

  async delete(id: string, branchIds: string[], userId: string): Promise<void> {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (existing.status !== 'DRAFT') {
      throw new GeneralInvoiceInvalidStatusError(existing.status, 'DRAFT')
    }

    await generalInvoiceRepository.withTransaction(async (client) => {
      await generalInvoiceRepository.softDelete(client, id, companyId, userId)
    })

    await AuditService.log('DELETE', 'general_invoices', id, userId, { invoice_number: existing.invoice_number }, null)
    logInfo('General invoice deleted', { id })
  }

  async uploadAttachment(
    id: string,
    branchIds: string[],
    userId: string,
    file: Express.Multer.File,
  ): Promise<GeneralInvoiceDetail> {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (existing.status !== 'DRAFT') {
      throw new GeneralInvoiceInvalidStatusError(existing.status, 'DRAFT')
    }

    const ext = resolveDocumentUploadExtension(file)
    if (!ext) {
      throw new BusinessRuleError(
        'Format file tidak didukung. Gunakan JPG, PNG, WEBP, PDF, atau HEIC (maks. 10MB).',
      )
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const now = new Date()
    const path = `${companyId}/general-ap-invoices/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${fileName}`

    await storageService.uploadToPath(file.buffer, path, file.mimetype, 'invoices')

    await generalInvoiceRepository.withTransaction(async (client) => {
      await generalInvoiceRepository.updateAttachment(client, id, companyId, path, userId)
    })

    return this.getById(id, branchIds)
  }
}

// ============================================================
// GENERAL INVOICE PAYMENT SERVICE
// ============================================================
export class GeneralInvoicePaymentService {
  private async requireById(id: string, branchIds: string[]): Promise<GeneralInvoicePayment> {
    const payment = await generalPaymentRepository.findByIdAccessible(id, branchIds)
    if (!payment) throw new GeneralPaymentNotFoundError(id)
    return payment
  }

  async list(filter: GeneralPaymentListFilter) {
    const { data, total } = await generalPaymentRepository.findAll(filter)
    return { data, total, page: filter.page ?? 1, limit: filter.limit ?? 20 }
  }

  async getById(id: string, branchIds: string[]): Promise<GeneralInvoicePayment> {
    return this.requireById(id, branchIds)
  }

  /**
   * Buat payment saat invoice sudah POSTED.
   * Auto-draft: status = DRAFT, user confirm → APPROVED → bayar → PAID
   */
  async create(
    dto: CreateGeneralInvoicePaymentDto,
    branchIds: string[],
    contextBranchId: string,
    userId: string,
  ): Promise<GeneralInvoicePayment> {
    const invoice = await generalInvoiceRepository.findByIdAccessible(dto.general_invoice_id, branchIds)
    if (!invoice) throw new GeneralInvoiceNotFoundError(dto.general_invoice_id)
    if (invoice.status !== 'POSTED') {
      throw new GeneralInvoiceInvalidStatusError(invoice.status, 'POSTED')
    }

    // Cek belum ada payment aktif
    const existing = await generalPaymentRepository.findByInvoiceId(dto.general_invoice_id)
    if (existing && !['REJECTED'].includes(existing.status)) {
      throw new GeneralInvoiceAlreadyPaidError(existing.payment_number, existing.status)
    }

    const branchId = dto.branch_id ?? contextBranchId
    requireBranchAccess(branchId, branchIds)
    const companyId = invoice.company_id

    const { id } = await generalPaymentRepository.withTransaction(async (client) => {
      const branchCode = await generalPaymentRepository.findBranchCode(client, branchId)
      const paymentNumber = await generalPaymentRepository.generatePaymentNumber(client, companyId, branchCode)
      return generalPaymentRepository.create(client, companyId, branchId, dto, paymentNumber, userId)
    })

    await AuditService.log('CREATE', 'general_invoice_payments', id, userId, null, {
      general_invoice_id: dto.general_invoice_id,
    })
    logInfo('General payment created', { id })
    return this.getById(id, branchIds)
  }

  async approve(id: string, branchIds: string[], userId: string): Promise<GeneralInvoicePayment> {
    const existing = await this.requireById(id, branchIds)
    if (existing.status !== 'DRAFT') {
      throw new GeneralPaymentInvalidStatusError(existing.status, 'DRAFT')
    }

    await generalPaymentRepository.withTransaction(async (client) => {
      await generalPaymentRepository.updateStatus(client, id, 'APPROVED', {
        approved_by: userId,
        approved_at: new Date().toISOString(),
        updated_by: userId,
      })
    })

    await AuditService.log('UPDATE', 'general_invoice_payments', id, userId, { status: 'DRAFT' }, { status: 'APPROVED' })
    return this.getById(id, branchIds)
  }

  async reject(id: string, reason: string, branchIds: string[], userId: string): Promise<GeneralInvoicePayment> {
    const existing = await this.requireById(id, branchIds)
    if (existing.status !== 'DRAFT') {
      throw new GeneralPaymentInvalidStatusError(existing.status, 'DRAFT')
    }

    await generalPaymentRepository.withTransaction(async (client) => {
      await generalPaymentRepository.updateStatus(client, id, 'REJECTED', {
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
        updated_by: userId,
      })
    })

    await AuditService.log('UPDATE', 'general_invoice_payments', id, userId, { status: 'DRAFT' }, { status: 'REJECTED', reason })
    return this.getById(id, branchIds)
  }

  async uploadProof(
    id: string,
    proofUrl: string,
    branchIds: string[],
    userId: string,
  ): Promise<GeneralInvoicePayment> {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (!['APPROVED', 'PAID'].includes(existing.status)) {
      throw new GeneralPaymentInvalidStatusError(existing.status, ['APPROVED', 'PAID'])
    }

    await generalPaymentRepository.withTransaction(async (client) => {
      await generalPaymentRepository.updateStatus(client, id, existing.status, {
        proof_url: proofUrl,
        proof_uploaded_at: new Date().toISOString(),
        proof_uploaded_by: userId,
        updated_by: userId,
      })
    })

    return this.getById(id, branchIds)
  }

  async uploadProofFile(
    id: string,
    branchIds: string[],
    userId: string,
    file: Express.Multer.File,
  ): Promise<GeneralInvoicePayment> {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    const ext = resolveDocumentUploadExtension(file)
    if (!ext) {
      throw new BusinessRuleError(
        'Format file tidak didukung. Gunakan JPG, PNG, WEBP, PDF, atau HEIC (maks. 10MB).',
      )
    }

    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const now = new Date()
    const path = `${companyId}/general-ap-payments/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${fileName}`

    await storageService.uploadToPath(file.buffer, path, file.mimetype, 'invoices')
    return this.uploadProof(id, path, branchIds, userId)
  }

  /**
   * Mark as PAID → buat jurnal pembayaran
   *
   * Journal:
   *   DR  Hutang Usaha Umum (GEN-AP-LIABILITY)  xxx
   *       CR  Bank                                    xxx
   */
  async markPaid(
    id: string,
    paymentDate: string | undefined,
    branchIds: string[],
    userId: string,
  ): Promise<GeneralInvoicePayment> {
    const existing = await this.requireById(id, branchIds)
    const companyId = existing.company_id
    if (existing.status !== 'APPROVED') {
      throw new GeneralPaymentInvalidStatusError(existing.status, 'APPROVED')
    }
    if (!existing.proof_url) {
      throw new GeneralPaymentProofRequiredError()
    }

    // Ambil COA
    const liabilityAccountId = await generalInvoiceRepository.findLiabilityAccountId(companyId)
    if (!liabilityAccountId) throw new GeneralInvoiceLiabilityCoaMissingError()

    // Ambil COA bank dari bank_account
    const bankCoaId = await generalPaymentRepository.findBankCoaId(existing.bank_account_id)
    if (!bankCoaId) throw new GeneralInvoiceBankCoaMissingError(existing.bank_account_id)

    const resolvedDate = paymentDate ?? new Date().toISOString().slice(0, 10)
    const amount = Number(existing.total_amount)
    const desc = `Bayar hutang ${existing.invoice_number} — ${existing.vendor_name}`

    let journalId: string | null = null
    try {
      const journal = await journalHeadersService.create(
        {
          company_id: companyId,
          branch_id: existing.branch_id,
          journal_date: resolvedDate,
          journal_type: 'PAYABLE',
          description: desc,
          source_module: 'general_invoice_payments',
          reference_type: 'general_invoice_payment',
          reference_id: existing.id,
          reference_number: existing.payment_number,
          currency: 'IDR',
          exchange_rate: 1,
          lines: [
            {
              line_number: 1,
              account_id: liabilityAccountId,
              description: desc,
              debit_amount: amount,
              credit_amount: 0,
            },
            {
              line_number: 2,
              account_id: bankCoaId,
              description: desc,
              debit_amount: 0,
              credit_amount: amount,
            },
          ],
        },
        userId,
      )
      journalId = journal.id

      await journalHeadersService.submitAsUser(journalId, userId)
      await journalHeadersService.approveAsUser(journalId, userId)
      await journalHeadersService.postAsUser(journalId, userId)

      await generalPaymentRepository.withTransaction(async (client) => {
        await generalPaymentRepository.updateStatus(client, id, 'PAID', {
          paid_by: userId,
          paid_at: new Date().toISOString(),
          payment_date: resolvedDate,
          journal_id: journalId,
          updated_by: userId,
        })
      })
    } catch (err) {
      if (journalId) {
        await journalHeadersService.forceDeleteAsUser(journalId, userId).catch(() => undefined)
      }
      throw err
    }

    await AuditService.log('UPDATE', 'general_invoice_payments', id, userId, { status: 'APPROVED' }, { status: 'PAID', journal_id: journalId })
    logInfo('General payment marked paid', { id, journal_id: journalId })
    return this.getById(id, branchIds)
  }

  async deleteJournal(id: string, branchIds: string[], userId: string): Promise<GeneralInvoicePayment> {
    const existing = await this.requireById(id, branchIds)
    if (!existing.journal_id) throw new GeneralPaymentJournalMissingError()
    if (existing.status !== 'PAID') {
      throw new GeneralPaymentInvalidStatusError(existing.status, 'PAID')
    }

    const journalId = existing.journal_id
    await journalHeadersService.forceDeleteAsUser(journalId, userId)

    await AuditService.log('DELETE', 'general_invoice_payments', id, userId, { journal_id: journalId }, { journal_id: null })
    return this.getById(id, branchIds)
  }

  async delete(id: string, branchIds: string[], userId: string): Promise<void> {
    const existing = await this.requireById(id, branchIds)
    if (existing.status !== 'DRAFT') {
      throw new GeneralPaymentInvalidStatusError(existing.status, 'DRAFT')
    }

    await generalPaymentRepository.withTransaction(async (client) => {
      await generalPaymentRepository.softDelete(client, id, userId)
    })

    await AuditService.log('DELETE', 'general_invoice_payments', id, userId, { payment_number: existing.payment_number }, null)
  }
}

// ============================================================
// TEMPLATE SERVICE
// ============================================================
export class GeneralInvoiceTemplateService {
  async list(companyIds: string[]): Promise<GeneralInvoiceTemplate[]> {
    return generalTemplateRepository.findAll(companyIds)
  }

  async getById(id: string, companyIds: string[]): Promise<GeneralInvoiceTemplate> {
    const t = await generalTemplateRepository.findById(id, companyIds)
    if (!t) throw new GeneralTemplateNotFoundError(id)
    return t
  }

  async create(
    dto: CreateGeneralInvoiceTemplateDto,
    companyIds: string[],
    branchIds: string[],
    contextBranchId: string,
    userId: string,
  ): Promise<GeneralInvoiceTemplate> {
    const branchId = dto.branch_id ?? contextBranchId
    requireBranchAccess(branchId, branchIds)
    const companyId = (await getCompanyIdForBranch(branchId)) ?? ''
    const { id } = await generalTemplateRepository.withTransaction(async (client) => {
      return generalTemplateRepository.create(client, companyId, branchId, dto, userId)
    })
    await AuditService.log('CREATE', 'general_invoice_templates', id, userId, null, { template_name: dto.template_name })
    return this.getById(id, companyIds)
  }

  /**
   * Generate invoice baru dari template.
   * User tetap harus review dan POST secara manual.
   */
  async generateFromTemplate(
    dto: GenerateFromTemplateDto,
    companyIds: string[],
    branchIds: string[],
    contextBranchId: string,
    userId: string,
    invoiceService: GeneralInvoiceService,
  ): Promise<GeneralInvoiceDetail> {
    const template = await this.getById(dto.template_id, companyIds)
    const companyId = template.company_id

    const lineAmountMap = new Map(
      (dto.line_amounts ?? []).map((la) => [la.line_number, la]),
    )

    const lines = template.lines.map((tl) => {
      const override = lineAmountMap.get(tl.line_number)
      const amount = override?.amount
        ?? (template.default_amount && tl.amount_ratio
          ? template.default_amount * tl.amount_ratio
          : 0)

      return {
        line_number: tl.line_number,
        account_id: tl.account_id,
        description: tl.description ?? undefined,
        amount,
        tax_amount: override?.tax_amount ?? 0,
      }
    })

    const invoiceDate = dto.invoice_date
    const dueDate = new Date(new Date(invoiceDate).getTime() + template.due_date_offset_days * 86400000)
      .toISOString()
      .slice(0, 10)

    let invoiceNumber = dto.invoice_number
    if (!invoiceNumber) {
      const branchCode = await generalInvoiceRepository.withTransaction(async (client) =>
        generalInvoiceRepository.findBranchCode(client, template.branch_id ?? contextBranchId),
      )
      invoiceNumber = await generalInvoiceRepository.withTransaction(async (client) =>
        generalInvoiceRepository.generateInvoiceNumber(client, companyId, branchCode),
      )
    }

    const createDto: CreateGeneralInvoiceDto = {
      branch_id: template.branch_id ?? contextBranchId,
      vendor_id: template.vendor_id,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      expense_type: template.expense_type,
      is_confidential: template.is_confidential,
      template_id: template.id,
      notes: dto.notes ?? template.notes ?? undefined,
      lines,
    }

    const invoice = await invoiceService.create(createDto, branchIds, contextBranchId, userId)

    // Update last_generated_at di template
    await generalTemplateRepository.withTransaction(async (client) => {
      await generalTemplateRepository.updateLastGenerated(client, template.id, invoiceDate)
    })

    return invoice
  }

  async delete(id: string, companyIds: string[], userId: string): Promise<void> {
    const existing = await this.getById(id, companyIds)
    await generalTemplateRepository.withTransaction(async (client) => {
      await generalTemplateRepository.softDelete(client, id, existing.company_id, userId)
    })
    await AuditService.log('DELETE', 'general_invoice_templates', id, userId, null, null)
  }
}

// Singleton exports
export const vendorService = new VendorService()
export const generalInvoiceService = new GeneralInvoiceService()
export const generalInvoicePaymentService = new GeneralInvoicePaymentService()
export const generalInvoiceTemplateService = new GeneralInvoiceTemplateService()
