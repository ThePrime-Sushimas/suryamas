import { journalHeadersService } from '../accounting/journals/journal-headers/journal-headers.service'
import { journalHeadersRepository } from '../accounting/journals/journal-headers/journal-headers.repository'
import { AuditService } from '../monitoring/monitoring.service'
import { notificationDispatcher } from '../notifications/notification-dispatcher.service'
import { NOTIFICATION_EVENT_KEYS } from '../notifications/notification-events'
import { storageService } from '../../services/storage.service'
import { resolveDocumentUploadExtension } from '../../utils/document-upload.util'
import { logInfo } from '../../config/logger'
import { BusinessRuleError } from '../../utils/errors.base'
import {
  generalInvoiceRepository,
  generalPaymentRepository,
  generalTemplateRepository,
  vendorRepository,
  amortizationRepository,
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
  UpdateGeneralInvoiceTemplateDto,
  GenerateFromTemplateDto,
  GeneralInvoiceTemplate,
  GeneralApDashboard,
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
  GeneralTemplateInvalidBankAccountError,
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

    // Build journal lines: DR tiap expense/prepaid account, CR liability account
    // If a line has tax_account_id, tax gets its own journal line (e.g. PPN Masukan)
    // If tax_account_id is NULL, tax is bundled into the main account debit
    const journalLines: Array<{
      line_number: number
      account_id: string
      description: string
      debit_amount: number
      credit_amount: number
    }> = []

    let lineNum = 1
    for (const line of existing.lines) {
      const lineAmount = Number(line.amount)
      const taxAmount = Number(line.tax_amount)

      if (line.tax_account_id && taxAmount > 0) {
        // Tax has its own account → debit main account for base amount only
        journalLines.push({
          line_number: lineNum++,
          account_id: line.account_id,
          description: line.description ?? existing.vendor_name,
          debit_amount: lineAmount,
          credit_amount: 0,
        })
        // Separate debit for tax account (e.g. PPN Masukan)
        journalLines.push({
          line_number: lineNum++,
          account_id: line.tax_account_id,
          description: `PPN — ${line.description ?? existing.vendor_name}`,
          debit_amount: taxAmount,
          credit_amount: 0,
        })
      } else {
        // No separate tax account → bundle tax into main account debit (legacy behavior)
        journalLines.push({
          line_number: lineNum++,
          account_id: line.account_id,
          description: line.description ?? existing.vendor_name,
          debit_amount: Number(line.total_amount),
          credit_amount: 0,
        })
      }
    }

    // CR: Hutang Usaha Umum (total termasuk pajak)
    journalLines.push({
      line_number: lineNum,
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
          description: `Tagihan ${existing.vendor_name} (${existing.invoice_number})`,
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

    // Create amortization schedules for PREPAID lines (idempotent — skips if already exists)
    const prepaidLines = existing.lines.filter((l) => l.transaction_type === 'PREPAID')
    if (prepaidLines.length > 0) {
      await generalInvoiceRepository.withTransaction(async (client) => {
        for (const line of prepaidLines) {
          if (!line.expense_account_id || !line.total_periods || !line.amortization_start_date) continue

          // Reconciliation: skip if schedule already exists for this line
          const { rows: existingAmort } = await client.query(
            `SELECT id FROM general_invoice_amortizations WHERE invoice_line_id = $1`,
            [line.id],
          )
          if (existingAmort.length > 0) continue

          // Amortisasi atas base amount saja jika PPN terpisah (tax_account_id ada)
          // Kalau PPN bundled (tax_account_id null), amortisasi atas total (base + tax)
          const lineAmount = (line.tax_account_id && Number(line.tax_amount) > 0)
            ? Number(line.amount)
            : Number(line.total_amount)
          const totalPeriods = line.total_periods
          const amountPerPeriod = Math.floor((lineAmount / totalPeriods) * 10000) / 10000
          const startDate = new Date(line.amortization_start_date)

          // Calculate end date
          const endDate = new Date(startDate)
          endDate.setMonth(endDate.getMonth() + totalPeriods - 1)

          // Create amortization header
          const { rows: [amort] } = await client.query<{ id: string }>(
            `INSERT INTO general_invoice_amortizations (
              company_id, branch_id, invoice_id, invoice_line_id,
              total_amount, total_periods, amount_per_period,
              start_date, end_date,
              prepaid_account_id, expense_account_id,
              created_by
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            RETURNING id`,
            [
              companyId, existing.branch_id, id, line.id,
              lineAmount, totalPeriods, amountPerPeriod,
              line.amortization_start_date, endDate.toISOString().slice(0, 10),
              line.account_id, line.expense_account_id,
              userId,
            ],
          )

          // Create entries for each period — last period absorbs rounding difference
          for (let p = 1; p <= totalPeriods; p++) {
            const periodDate = new Date(startDate)
            periodDate.setMonth(periodDate.getMonth() + (p - 1))
            const amount = p === totalPeriods
              ? lineAmount - amountPerPeriod * (totalPeriods - 1)
              : amountPerPeriod

            await client.query(
              `INSERT INTO general_invoice_amortization_entries
                (amortization_id, period_number, period_date, amount)
               VALUES ($1,$2,$3,$4)`,
              [amort.id, p, periodDate.toISOString().slice(0, 10), amount],
            )
          }
        }
      })
      logInfo('Amortization schedules created', { invoice_id: id, prepaid_lines: prepaidLines.length })
    }

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
      // Cancel active amortization schedules
      await amortizationRepository.cancelByInvoiceId(client, id)
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

  /**
   * Force delete (hard delete) — hapus total invoice beserta semua data terkait:
   * - Payment journals (direct delete, bypass forceDeleteAsUser to avoid double-cascade)
   * - Payments (hard delete)
   * - Invoice posting journal (direct delete)
   * - Amortization journals (direct delete)
   * - Amortization entries & headers (hard delete)
   * - Invoice lines (hard delete)
   * - Invoice header (hard delete)
   *
   * Requires `release` permission on general_invoices module.
   *
   * NOTE: Kita TIDAK pakai forceDeleteAsUser karena handler di journal service
   * akan trigger cascade balik (double-cascade). Langsung clear references + delete journal record.
   */
  async forceDelete(id: string, branchIds: string[], userId: string): Promise<void> {
    const existing = await this.requireById(id, branchIds)
    const invoiceNumber = existing.invoice_number

    // Collect all journal IDs to delete
    const journalIdsToDelete: string[] = []

    // 1. Payment journals + CC settlement journals
    const payments = await generalPaymentRepository.findAllByInvoiceId(id)
    for (const payment of payments) {
      // CC_OWNER settlement cleanup: hapus settlement journal + record
      if (payment.cc_settlement_id) {
        const settlement = await generalPaymentRepository.findSettlementById(payment.cc_settlement_id)
        if (settlement?.journal_id) {
          journalIdsToDelete.push(settlement.journal_id)
        }
      }
      // Payment journal
      if (payment.journal_id) journalIdsToDelete.push(payment.journal_id)
    }

    // 2. Invoice posting journal
    if (existing.journal_id) {
      journalIdsToDelete.push(existing.journal_id)
    }

    // 3. Amortization journals
    const amortJournalIds = await amortizationRepository.findJournalIdsByInvoiceId(id)
    journalIdsToDelete.push(...amortJournalIds)

    // 4. Delete all journals directly (bypass forceDeleteAsUser to avoid double-cascade)
    for (const journalId of journalIdsToDelete) {
      try {
        await journalHeadersRepository.clearReversalReferences(journalId)
        await journalHeadersRepository.clearJournalReferences(journalId)
        await journalHeadersRepository.delete(journalId, userId)
      } catch {
        // Journal mungkin sudah dihapus — skip
      }
    }

    // 5. Hard delete everything in one transaction
    await generalInvoiceRepository.withTransaction(async (client) => {
      // Delete settlement records for CC_OWNER payments
      for (const payment of payments) {
        if (payment.cc_settlement_id) {
          await generalPaymentRepository.deleteSettlementRecord(client, payment.cc_settlement_id)
        }
      }
      await generalPaymentRepository.hardDeleteByInvoiceId(client, id)
      await generalInvoiceRepository.hardDelete(client, id)
    })

    await AuditService.log('FORCE_DELETE', 'general_invoices', id, userId, {
      invoice_number: invoiceNumber,
      status: existing.status,
      had_payment: payments.length > 0,
      had_amortization: amortJournalIds.length > 0,
      journals_deleted: journalIdsToDelete.length,
    }, null)
    logInfo('General invoice force deleted (hard delete)', { id, invoice_number: invoiceNumber })
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
   * TRANSFER/CASH:
   *   DR  Hutang Usaha Umum (GEN-AP-LIABILITY)  xxx
   *       CR  Bank                                    xxx
   *
   * CC_OWNER:
   *   DR  Hutang Usaha Umum (GEN-AP-LIABILITY)  xxx
   *       CR  Hutang CC Owner (21060x)                xxx
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
    // Proof wajib untuk TRANSFER/CASH, opsional untuk CC_OWNER (screenshot marketplace)
    if (!existing.proof_url && existing.payment_method !== 'CC_OWNER') {
      throw new GeneralPaymentProofRequiredError()
    }

    // Ambil COA debit: Hutang Usaha Umum
    const liabilityAccountId = await generalInvoiceRepository.findLiabilityAccountId(companyId)
    if (!liabilityAccountId) throw new GeneralInvoiceLiabilityCoaMissingError()

    // Ambil COA credit: Bank atau Hutang CC Owner
    let creditAccountId: string
    if (existing.payment_method === 'CC_OWNER') {
      if (!existing.owner_credit_card_id) {
        throw new BusinessRuleError('CC_OWNER payment harus memiliki owner_credit_card_id')
      }
      const ccCoaId = await generalPaymentRepository.findCcOwnerCoaId(existing.owner_credit_card_id, companyId)
      if (!ccCoaId) throw new BusinessRuleError('COA untuk kartu kredit tidak ditemukan. Pastikan coa_code di owner_credit_cards sudah terdaftar di chart_of_accounts.')
      creditAccountId = ccCoaId
    } else {
      if (!existing.bank_account_id) {
        throw new BusinessRuleError('TRANSFER/CASH payment harus memiliki bank_account_id')
      }
      const bankCoaId = await generalPaymentRepository.findBankCoaId(existing.bank_account_id)
      if (!bankCoaId) throw new GeneralInvoiceBankCoaMissingError(existing.bank_account_id)
      creditAccountId = bankCoaId
    }

    const resolvedDate = paymentDate ?? new Date().toISOString().slice(0, 10)
    const amount = Number(existing.total_amount)
    const desc = existing.payment_method === 'CC_OWNER'
      ? `Bayar hutang via CC Owner ${existing.invoice_number} — ${existing.vendor_name}`
      : `Bayar hutang ${existing.invoice_number} — ${existing.vendor_name}`

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
              account_id: creditAccountId,
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
    if (dto.preferred_vendor_bank_account_id != null) {
      const valid = await generalTemplateRepository.isVendorBankAccount(
        dto.vendor_id,
        dto.preferred_vendor_bank_account_id,
      )
      if (!valid) throw new GeneralTemplateInvalidBankAccountError()
    }
    const companyId = (await getCompanyIdForBranch(branchId)) ?? ''
    const { id } = await generalTemplateRepository.withTransaction(async (client) => {
      return generalTemplateRepository.create(client, companyId, branchId, dto, userId)
    })
    await AuditService.log('CREATE', 'general_invoice_templates', id, userId, null, { template_name: dto.template_name })
    return this.getById(id, companyIds)
  }

  async updatePreferredBankAccount(
    id: string,
    dto: UpdateGeneralInvoiceTemplateDto,
    companyIds: string[],
    userId: string,
  ): Promise<GeneralInvoiceTemplate> {
    const existing = await this.getById(id, companyIds)
    if (dto.preferred_vendor_bank_account_id != null) {
      const valid = await generalTemplateRepository.isVendorBankAccount(
        existing.vendor_id,
        dto.preferred_vendor_bank_account_id,
      )
      if (!valid) throw new GeneralTemplateInvalidBankAccountError()
    }
    await generalTemplateRepository.withTransaction(async (client) => {
      await generalTemplateRepository.updatePreferredBankAccount(
        client,
        id,
        existing.company_id,
        dto.preferred_vendor_bank_account_id,
        userId,
      )
    })
    await AuditService.log(
      'UPDATE',
      'general_invoice_templates',
      id,
      userId,
      { preferred_vendor_bank_account_id: existing.preferred_vendor_bank_account_id },
      { preferred_vendor_bank_account_id: dto.preferred_vendor_bank_account_id },
    )
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

      // Calculate amortization_start_date from template offset
      let amortizationStartDate: string | undefined
      if (tl.transaction_type === 'PREPAID' && tl.amortization_start_offset_days != null) {
        const start = new Date(new Date(dto.invoice_date).getTime() + tl.amortization_start_offset_days * 86400000)
        amortizationStartDate = start.toISOString().slice(0, 10)
      }

      return {
        line_number: tl.line_number,
        account_id: tl.account_id,
        description: tl.description ?? undefined,
        amount,
        tax_amount: override?.tax_amount ?? 0,
        tax_account_id: tl.tax_account_id ?? undefined,
        transaction_type: tl.transaction_type,
        expense_account_id: tl.expense_account_id ?? undefined,
        total_periods: tl.total_periods ?? undefined,
        amortization_start_date: amortizationStartDate,
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

    // Dispatch notification: request tagihan masuk
    const branchName = await generalInvoiceRepository.withTransaction(async (client) => {
      const { rows } = await client.query<{ branch_name: string }>(
        `SELECT branch_name FROM branches WHERE id = $1`,
        [invoice.branch_id],
      )
      return rows[0]?.branch_name ?? ''
    })

    await notificationDispatcher.dispatch(
      NOTIFICATION_EVENT_KEYS.GENERAL_INVOICE_REQUESTED,
      template.company_id,
      {
        entityId: invoice.id,
        variables: {
          template_name: template.template_name,
          branch_name: branchName,
          amount: new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(invoice.total_amount)),
          invoice_number: invoice.invoice_number,
          vendor_name: template.vendor_name,
        },
        excludeUserIds: [userId],
      },
    )

    return invoice
  }

  async delete(id: string, companyIds: string[], userId: string): Promise<void> {
    const existing = await this.getById(id, companyIds)
    await generalTemplateRepository.withTransaction(async (client) => {
      await generalTemplateRepository.softDelete(client, id, existing.company_id, userId)
    })
    await AuditService.log('DELETE', 'general_invoice_templates', id, userId, null, null)
  }

  // ── Amortization ─────────────────────────────────────────────
  async listAmortizations(branchIds: string[], opts: {
    branch_id?: string
    status?: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
    overdue?: boolean
    include_confidential?: boolean
    page?: number
    limit?: number
  }) {
    const scopedBranches = opts.branch_id
      ? branchIds.filter((id) => id === opts.branch_id)
      : branchIds

    const page = opts.page ?? 1
    const limit = Math.min(opts.limit ?? 20, 100)
    const offset = (page - 1) * limit

    const rows = await amortizationRepository.findAll({
      branchIds: scopedBranches,
      status: opts.status,
      overdue: opts.overdue,
      includeConfidential: opts.include_confidential ?? false,
      limit,
      offset,
    })

    const ids = rows.map((r) => r.id as string)
    const entries = await amortizationRepository.findEntriesByAmortizationIds(ids)

    const entryMap = new Map<string, Array<Record<string, unknown>>>()
    for (const e of entries) {
      const amortId = e.amortization_id as string
      const list = entryMap.get(amortId) ?? []
      list.push(e)
      entryMap.set(amortId, list)
    }

    const today = new Date().toISOString().slice(0, 10)
    return rows.map((r) => {
      const amortEntries = entryMap.get(r.id as string) ?? []
      const nextEntry = amortEntries.find((e) => !e.journal_id)
      return {
        ...r,
        entries: amortEntries,
        next_period_date: (nextEntry?.period_date as string) ?? null,
        is_overdue: nextEntry ? (nextEntry.period_date as string) <= today : false,
      }
    })
  }

  async executeAmortizationEntry(
    amortizationId: string,
    periodNumber: number,
    periodDate: string | undefined,
    branchIds: string[],
    userId: string,
    canViewConfidential = false,
  ) {
    // Get amortization
    const amort = await amortizationRepository.findById(amortizationId)
    if (!amort) throw new BusinessRuleError('Amortization not found or not active')
    if (!branchIds.includes(amort.branch_id as string)) throw new BusinessRuleError('No access to this branch')

    // Guard confidential access
    if (amort.is_confidential && !canViewConfidential) {
      throw new BusinessRuleError('Akses tidak diizinkan untuk amortisasi ini')
    }

    // Get entry
    const entry = await amortizationRepository.findEntry(amortizationId, periodNumber)
    if (!entry) throw new BusinessRuleError('Entry not found')
    if (entry.journal_id) throw new BusinessRuleError('Entry already executed (idempotency guard)')

    // Secondary idempotency: detect orphaned journals from partial failures
    const orphanJournalIds = await amortizationRepository.countJournalsForAmortization(amortizationId)
    if (orphanJournalIds.length > (amort.periods_executed as number)) {
      throw new BusinessRuleError(
        `Detected orphaned journal from a previous partial failure. ` +
        `Journal IDs: ${orphanJournalIds.join(', ')}. ` +
        `Expected ${amort.periods_executed} journals but found ${orphanJournalIds.length}. ` +
        `Void the orphaned journal manually, then retry.`,
      )
    }

    const journalDate = periodDate ?? (entry.period_date as string)
    const entryAmount = Number(entry.amount)

    // Use SELECT FOR UPDATE inside a transaction to prevent concurrent execution
    let journalId: string | null = null
    try {
      const journal = await journalHeadersService.create(
        {
          company_id: amort.company_id as string,
          branch_id: amort.branch_id as string,
          journal_date: journalDate,
          journal_type: 'GENERAL',
          description: `Amortisasi ${amort.vendor_name} — ${amort.invoice_number} (periode ${periodNumber}/${amort.total_periods})`,
          source_module: 'general_invoices',
          reference_type: 'amortization',
          reference_id: amortizationId,
          reference_number: amort.invoice_number as string,
          currency: 'IDR',
          exchange_rate: 1,
          lines: [
            {
              line_number: 1,
              account_id: amort.expense_account_id as string,
              description: `Amortisasi beban periode ${periodNumber}`,
              debit_amount: entryAmount,
              credit_amount: 0,
            },
            {
              line_number: 2,
              account_id: amort.prepaid_account_id as string,
              description: `Pengurangan prepaid asset periode ${periodNumber}`,
              debit_amount: 0,
              credit_amount: entryAmount,
            },
          ],
        },
        userId,
      )
      journalId = journal.id

      await journalHeadersService.submitAsUser(journalId, userId)
      await journalHeadersService.approveAsUser(journalId, userId)
      await journalHeadersService.postAsUser(journalId, userId)
    } catch (err) {
      if (journalId) {
        await journalHeadersService.forceDeleteAsUser(journalId, userId).catch(() => undefined)
      }
      throw err
    }

    // Update entry + amortization header in one transaction
    // markEntryExecuted uses conditional UPDATE (WHERE journal_id IS NULL) as concurrency guard
    const newExecuted = (amort.periods_executed as number) + 1
    const isComplete = newExecuted >= (amort.total_periods as number)

    let marked = false
    await amortizationRepository.withTransaction(async (client) => {
      marked = await amortizationRepository.markEntryExecuted(client, entry.id as string, journalId!, userId)
      if (!marked) return // concurrent request already marked it — skip progress update
      await amortizationRepository.updateProgress(client, amortizationId, newExecuted, journalDate, isComplete ? 'COMPLETED' : 'ACTIVE')
    })

    // If mark failed, another request already executed this entry — cleanup our journal
    if (!marked) {
      await journalHeadersService.forceDeleteAsUser(journalId!, userId).catch(() => undefined)
      throw new BusinessRuleError('Entry was already executed by a concurrent request. Journal has been cleaned up.')
    }

    logInfo('Amortization entry executed', { amortization_id: amortizationId, period: periodNumber, journal_id: journalId })
    return { journal_id: journalId, period_number: periodNumber, status: isComplete ? 'COMPLETED' : 'ACTIVE' }
  }
}

// Singleton exports
export const vendorService = new VendorService()
export const generalInvoiceService = new GeneralInvoiceService()
export const generalInvoicePaymentService = new GeneralInvoicePaymentService()
export const generalInvoiceTemplateService = new GeneralInvoiceTemplateService()
