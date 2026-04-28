import { feeDiscrepancyReviewRepository } from './fee-discrepancy-review.repository'
import type { FeeDiscrepancyFilter, FeeDiscrepancySource, FeeDiscrepancyStatus, CorrectionType } from './fee-discrepancy-review.types'
import { BusinessRuleError } from '@/utils/errors.base'
import { logInfo, logError } from '@/config/logger'
import { pool } from '@/config/db'

const FEE_DISC_PURPOSE_CODE = 'FEE-DISC'

const CORRECTION_LABELS: Record<CorrectionType, string> = {
  POS_PENDING: 'POS Belum Masuk',
  REFUND_CUSTOMER: 'Refund Customer',
  PLATFORM_COMPENSATION: 'Kompensasi/Promo Platform',
  ROUNDING: 'Pembulatan',
  STAFF_DEDUCTION: 'Potongan Staff',
}

export class FeeDiscrepancyReviewService {
  constructor(private readonly repo = feeDiscrepancyReviewRepository) {}

  async getDiscrepancies(companyId: string, filter: FeeDiscrepancyFilter) {
    return this.repo.getDiscrepancies(companyId, filter)
  }

  async getSummary(companyId: string, filter: FeeDiscrepancyFilter) {
    return this.repo.getSummary(companyId, filter)
  }

  async updateStatus(
    companyId: string,
    source: FeeDiscrepancySource,
    sourceId: string,
    status: FeeDiscrepancyStatus,
    userId: string,
    notes?: string,
    correctionJournalId?: string,
  ) {
    if (status === 'CORRECTED' && !correctionJournalId) {
      throw new BusinessRuleError('correctionJournalId wajib diisi untuk status CORRECTED')
    }

    await this.repo.updateStatus(companyId, source, sourceId, status, userId, notes, correctionJournalId)

    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, after, timestamp)
         VALUES ($1, 'UPDATE', 'fee_discrepancy_review', $2, $3, NOW())`,
        [userId, sourceId, JSON.stringify({ source, sourceId, status, notes, correctionJournalId })]
      )
    } catch { /* fire-and-forget */ }

    logInfo('Fee discrepancy status updated', { source, sourceId, status, userId })
  }

  async createCorrectionJournal(
    companyId: string,
    source: FeeDiscrepancySource,
    sourceId: string,
    userId: string,
    correctionLines: Array<{ correctionType: CorrectionType; amount: number }>,
    notes?: string,
  ): Promise<{ journalId: string; journalNumber: string }> {
    // 1. Get discrepancy detail — direct query, no full scan
    const discItem = await this.repo.getDiscrepancyById(companyId, source, sourceId)
    if (!discItem) throw new BusinessRuleError('Fee discrepancy tidak ditemukan')

    // 2. Guard: jangan koreksi item yang sudah dikoreksi
    if (discItem.status === 'CORRECTED') {
      throw new BusinessRuleError(`Fee discrepancy ini sudah dikoreksi (journal: ${discItem.correctionJournalId})`)
    }

    // 3. Validate total amount matches discrepancy
    const totalAmount = Math.round(correctionLines.reduce((s, l) => s + l.amount, 0) * 100) / 100
    const discAmount = Math.round(Math.abs(discItem.discrepancyAmount) * 100) / 100
    if (Math.abs(totalAmount - discAmount) > 0.01) {
      throw new BusinessRuleError(`Total koreksi (${totalAmount}) tidak sama dengan selisih (${discAmount})`)
    }
    if (totalAmount < 1) throw new BusinessRuleError('Selisih terlalu kecil untuk dikoreksi (min. Rp 1)')

    // 4. Load FEE-DISC account
    const feeDiscAccountId = await this.loadFeeDiscAccountId(companyId)
    if (!feeDiscAccountId) throw new BusinessRuleError('Akun FEE-DISC belum dikonfigurasi di Accounting Purposes')

    // 5. Resolve all correction accounts
    const resolvedLines: Array<{ correctionType: CorrectionType; amount: number; accountId: string; label: string }> = []
    for (const line of correctionLines) {
      const accountId = await this.getCorrectionAccountId(line.correctionType, source, sourceId, companyId)
      if (!accountId) throw new BusinessRuleError(`Akun koreksi untuk tipe "${line.correctionType}" tidak ditemukan di Chart of Accounts`)
      resolvedLines.push({ ...line, accountId, label: CORRECTION_LABELS[line.correctionType] })
    }

    // 6. Find fiscal period
    const journalDate = discItem.transactionDate
    const period = await this.findFiscalPeriod(companyId, journalDate)
    if (!period) throw new BusinessRuleError(`Tidak ada periode fiskal untuk tanggal ${journalDate}`)
    if (!period.is_open) throw new BusinessRuleError(`Periode ${period.period} sudah ditutup`)

    // 7. Generate unique journal number
    const journalNumber = `FEE-CORR-${journalDate}-${sourceId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`
    const descParts = resolvedLines.map(l => l.label).join(', ')

    // 8. Create journal header (9 params: company, branch, number, type, date, period, desc, amount, source_module)
    const { rows: headerRows } = await pool.query(
      `SELECT * FROM create_journal_header_atomic($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [companyId, null, journalNumber, 'GENERAL', journalDate, period.period,
       notes || `Koreksi: ${descParts} - ${discItem.paymentMethodName || source}`, totalAmount,
       'FEE_DISCREPANCY_CORRECTION']
    )

    const header = headerRows[0]
    if (!header?.id) throw new Error('Gagal membuat journal header: response kosong')

    const journalId = header.id as string
    const actualJournalNumber = header.journal_number as string

    // 9. Build journal lines
    // disc > 0 = bank bayar kurang → asal: DR Fee Disc → reverse: CR Fee Disc, DR correction accounts
    // disc < 0 = bank bayar lebih → asal: CR Fee Disc → reverse: DR Fee Disc, CR correction accounts
    const isPositiveDisc = discItem.discrepancyAmount > 0
    let lineNum = 1

    // Line 1: Fee Discrepancy (reverse full amount)
    const lines = [
      {
        line_number: lineNum++,
        account_id: feeDiscAccountId,
        description: `Koreksi fee disc: ${descParts}`,
        debit_amount:  isPositiveDisc ? 0 : totalAmount,
        credit_amount: isPositiveDisc ? totalAmount : 0,
        currency: 'IDR', exchange_rate: 1,
        base_debit_amount:  isPositiveDisc ? 0 : totalAmount,
        base_credit_amount: isPositiveDisc ? totalAmount : 0,
      },
    ]

    // Lines 2+: Per correction type
    for (const rl of resolvedLines) {
      const amt = Math.round(rl.amount * 100) / 100
      lines.push({
        line_number: lineNum++,
        account_id: rl.accountId,
        description: `${rl.label} - ${discItem.paymentMethodName || source}`,
        debit_amount:  isPositiveDisc ? amt : 0,
        credit_amount: isPositiveDisc ? 0 : amt,
        currency: 'IDR', exchange_rate: 1,
        base_debit_amount:  isPositiveDisc ? amt : 0,
        base_credit_amount: isPositiveDisc ? 0 : amt,
      })
    }

    // 10. Post lines — function throws on error (RAISE), so use try/catch
    try {
      await pool.query(
        `SELECT * FROM post_journal_lines_atomic($1, $2::jsonb, $3::uuid[], $4::uuid[], $5)`,
        [journalId, JSON.stringify(lines), [], [], false]
      )
    } catch (linesErr) {
      logError('createCorrectionJournal: lines RPC error', { error: (linesErr as Error).message, journalId })
      await pool.query(`UPDATE journal_headers SET deleted_at = NOW() WHERE id = $1`, [journalId])
      throw new Error(`Gagal insert journal lines: ${(linesErr as Error).message}`)
    }

    // 11. Mark as CORRECTED
    await this.repo.updateStatus(companyId, source, sourceId, 'CORRECTED', userId, notes, journalId)

    // 12. Audit log
    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, after, timestamp)
         VALUES ($1, 'CREATE', 'fee_discrepancy_correction', $2, $3, NOW())`,
        [userId, journalId, JSON.stringify({ source, sourceId, journalId, journalNumber: actualJournalNumber, totalAmount, correctionLines })]
      )
    } catch { /* fire-and-forget */ }

    logInfo('Fee discrepancy correction journal created', { journalId, journalNumber: actualJournalNumber, source, sourceId, totalAmount, lineCount: resolvedLines.length })
    return { journalId, journalNumber: actualJournalNumber }
  }

  async undoCorrection(
    companyId: string,
    source: FeeDiscrepancySource,
    sourceId: string,
    userId: string,
  ): Promise<void> {
    // 1. Get current review
    const discItem = await this.repo.getDiscrepancyById(companyId, source, sourceId)
    if (!discItem) throw new BusinessRuleError('Fee discrepancy tidak ditemukan')
    if (discItem.status !== 'CORRECTED') throw new BusinessRuleError('Item ini belum dikoreksi')

    const journalId = discItem.correctionJournalId
    if (!journalId) throw new BusinessRuleError('Correction journal ID tidak ditemukan')

    // 2. Check journal exists
    const { rows: journalRows } = await pool.query(
      `SELECT id, status FROM journal_headers WHERE id = $1 AND deleted_at IS NULL`,
      [journalId]
    )
    const journal = journalRows[0]

    if (!journal) {
      throw new BusinessRuleError('Journal koreksi tidak ditemukan atau sudah dihapus')
    }

    // 3. Hard delete journal lines + header
    await pool.query(`DELETE FROM journal_lines WHERE journal_header_id = $1`, [journalId])
    await pool.query(`DELETE FROM journal_headers WHERE id = $1`, [journalId])

    // 4. Reset review status to PENDING
    await this.repo.updateStatus(companyId, source, sourceId, 'PENDING', userId, 'Undo koreksi', undefined)

    // 5. Audit log
    try {
      await pool.query(
        `INSERT INTO audit_logs (user_id, action, entity, entity_id, after, timestamp)
         VALUES ($1, 'DELETE', 'fee_discrepancy_correction', $2, $3, NOW())`,
        [userId, journalId, JSON.stringify({ source, sourceId, journalId, action: 'UNDO_CORRECTION' })]
      )
    } catch { /* fire-and-forget */ }

    logInfo('Fee discrepancy correction undone', { source, sourceId, journalId, userId })
  }

  // ── Private helpers ──

  private async loadFeeDiscAccountId(companyId: string): Promise<string | null> {
    return this.loadAccountByPurpose(companyId, FEE_DISC_PURPOSE_CODE)
  }

  private async getCorrectionAccountId(
    correctionType: CorrectionType,
    source: FeeDiscrepancySource,
    sourceId: string,
    companyId: string,
  ): Promise<string | null> {
    // POS_PENDING resolves from payment method receivable
    if (correctionType === 'POS_PENDING') {
      return this.getReceivableAccountId(source, sourceId, companyId)
    }

    // Other types resolve via accounting purposes
    const purposeCodeMap: Record<Exclude<CorrectionType, 'POS_PENDING'>, string> = {
      REFUND_CUSTOMER:       'FEE-CORR-REFUND',
      PLATFORM_COMPENSATION: 'FEE-CORR-PLATFORM',
      ROUNDING:              'FEE-CORR-ROUNDING',
      STAFF_DEDUCTION:       'FEE-CORR-STAFF',
    }

    const purposeCode = purposeCodeMap[correctionType as Exclude<CorrectionType, 'POS_PENDING'>]
    return this.loadAccountByPurpose(companyId, purposeCode)
  }

  private async loadAccountByPurpose(companyId: string, purposeCode: string): Promise<string | null> {
    const { rows: purposeRows } = await pool.query(
      `SELECT id FROM accounting_purposes
       WHERE purpose_code = $1 AND company_id = $2 AND is_active = true AND is_deleted = false`,
      [purposeCode, companyId]
    )
    if (purposeRows.length === 0) return null

    const { rows: accountRows } = await pool.query(
      `SELECT account_id FROM accounting_purpose_accounts
       WHERE purpose_id = $1 AND is_active = true AND is_deleted = false
       ORDER BY priority ASC LIMIT 1`,
      [purposeRows[0].id]
    )
    return accountRows[0]?.account_id ?? null
  }

  private async getReceivableAccountId(
    source: FeeDiscrepancySource,
    sourceId: string,
    companyId: string,
  ): Promise<string | null> {
    let paymentMethodId: number | null = null

    if (source === 'SINGLE_MATCH') {
      const { rows } = await pool.query(
        `SELECT payment_method_id FROM aggregated_transactions WHERE id = $1`,
        [sourceId]
      )
      paymentMethodId = rows[0]?.payment_method_id ?? null

    } else if (source === 'MULTI_MATCH') {
      const { rows } = await pool.query(
        `SELECT at.payment_method_id
         FROM bank_reconciliation_groups g
         INNER JOIN aggregated_transactions at ON at.id = g.aggregate_id
         WHERE g.id = $1`,
        [sourceId]
      )
      paymentMethodId = rows[0]?.payment_method_id ?? null

    } else if (source === 'SETTLEMENT_GROUP') {
      const { rows } = await pool.query(
        `SELECT at.payment_method_id
         FROM bank_settlement_aggregates bsa
         INNER JOIN aggregated_transactions at ON at.id = bsa.aggregate_id
         WHERE bsa.settlement_group_id = $1 LIMIT 1`,
        [sourceId]
      )
      paymentMethodId = rows[0]?.payment_method_id ?? null
    }

    if (!paymentMethodId) return null

    const { rows: pmRows } = await pool.query(
      `SELECT coa_account_id FROM payment_methods WHERE id = $1`,
      [paymentMethodId]
    )
    return pmRows[0]?.coa_account_id ?? null
  }

  private async findFiscalPeriod(companyId: string, date: string) {
    const { rows } = await pool.query(
      `SELECT id, period, period_start, period_end, is_open
       FROM fiscal_periods
       WHERE company_id = $1 AND period_start <= $2 AND period_end >= $2 AND deleted_at IS NULL
       LIMIT 1`,
      [companyId, date]
    )
    return (rows[0] as { id: string; period: string; is_open: boolean } | undefined) ?? null
  }
}

export const feeDiscrepancyReviewService = new FeeDiscrepancyReviewService()
