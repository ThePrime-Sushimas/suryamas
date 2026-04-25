import { feeDiscrepancyReviewRepository } from './fee-discrepancy-review.repository'
import type { FeeDiscrepancyFilter, FeeDiscrepancySource, FeeDiscrepancyStatus, CorrectionType } from './fee-discrepancy-review.types'
import { BusinessRuleError } from '@/utils/errors.base'
import { logInfo, logError } from '@/config/logger'
import { supabase } from '@/config/supabase'

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
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'UPDATE',
        entity: 'fee_discrepancy_review',
        entity_id: sourceId,
        after: JSON.stringify({ source, sourceId, status, notes, correctionJournalId }),
        timestamp: new Date().toISOString(),
      })
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

    // 8. Create journal header
    const { data: headerData, error: headerError } = await supabase.rpc('create_journal_header_atomic', {
      p_company_id: companyId,
      p_branch_id: null,
      p_journal_number: journalNumber,
      p_journal_type: 'GENERAL',
      p_journal_date: journalDate,
      p_period: period.period,
      p_description: notes || `Koreksi: ${descParts} - ${discItem.paymentMethodName || source}`,
      p_total_amount: totalAmount,
      p_source_module: 'FEE_DISCREPANCY_CORRECTION',
    })

    if (headerError) {
      logError('createCorrectionJournal: header RPC error', { error: headerError.message })
      throw new Error(`Gagal membuat journal header: ${headerError.message}`)
    }
    const header = Array.isArray(headerData) ? headerData[0] : headerData
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

    // 10. Post lines
    const { error: linesError } = await supabase.rpc('post_journal_lines_atomic', {
      p_journal_header_id: journalId,
      p_lines: lines,
      p_bank_statement_ids: [],
      p_aggregate_ids: [],
      p_set_processing: false,
    })

    if (linesError) {
      logError('createCorrectionJournal: lines RPC error', { error: linesError.message, journalId })
      await supabase.from('journal_headers').update({ deleted_at: new Date().toISOString() }).eq('id', journalId)
      throw new Error(`Gagal insert journal lines: ${linesError.message}`)
    }

    // 11. Mark as CORRECTED
    await this.repo.updateStatus(companyId, source, sourceId, 'CORRECTED', userId, notes, journalId)

    // 12. Audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId, action: 'CREATE', entity: 'fee_discrepancy_correction', entity_id: journalId,
        after: JSON.stringify({ source, sourceId, journalId, journalNumber: actualJournalNumber, totalAmount, correctionLines }),
        timestamp: new Date().toISOString(),
      })
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
    const { data: journal } = await supabase
      .from('journal_headers')
      .select('id, status')
      .eq('id', journalId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!journal) {
      throw new BusinessRuleError('Journal koreksi tidak ditemukan atau sudah dihapus')
    }

    // 3. Hard delete journal lines + header
    await supabase.from('journal_lines').delete().eq('journal_header_id', journalId)
    await supabase.from('journal_headers').delete().eq('id', journalId)

    // 4. Reset review status to PENDING
    await this.repo.updateStatus(companyId, source, sourceId, 'PENDING', userId, 'Undo koreksi', undefined)

    // 5. Audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId, action: 'DELETE', entity: 'fee_discrepancy_correction', entity_id: journalId,
        after: JSON.stringify({ source, sourceId, journalId, action: 'UNDO_CORRECTION' }),
        timestamp: new Date().toISOString(),
      })
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

  /** Load account_id from accounting_purposes + accounting_purpose_accounts */
  private async loadAccountByPurpose(companyId: string, purposeCode: string): Promise<string | null> {
    const { data: purpose } = await supabase
      .from('accounting_purposes')
      .select('id')
      .eq('purpose_code', purposeCode)
      .eq('company_id', companyId)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .maybeSingle()

    if (!purpose) return null

    const { data: accounts } = await supabase
      .from('accounting_purpose_accounts')
      .select('account_id')
      .eq('purpose_id', purpose.id)
      .eq('is_active', true)
      .eq('is_deleted', false)
      .order('priority', { ascending: true })
      .limit(1)

    return (accounts?.[0]?.account_id as string) || null
  }

  private async getReceivableAccountId(
    source: FeeDiscrepancySource,
    sourceId: string,
    companyId: string,
  ): Promise<string | null> {
    let paymentMethodId: number | null = null

    if (source === 'SINGLE_MATCH') {
      const { data } = await supabase
        .from('aggregated_transactions')
        .select('payment_method_id')
        .eq('id', sourceId)
        .maybeSingle()
      paymentMethodId = (data?.payment_method_id as number) || null

    } else if (source === 'MULTI_MATCH') {
      const { data } = await supabase
        .from('bank_reconciliation_groups')
        .select('aggregated_transactions(payment_method_id)')
        .eq('id', sourceId)
        .maybeSingle()
      paymentMethodId = (data?.aggregated_transactions as unknown as { payment_method_id: number })?.payment_method_id || null

    } else if (source === 'SETTLEMENT_GROUP') {
      const { data: settleAgg } = await supabase
        .from('bank_settlement_aggregates')
        .select('aggregate_id')
        .eq('settlement_group_id', sourceId)
        .limit(1)
      if (settleAgg?.[0]) {
        const { data: agg } = await supabase
          .from('aggregated_transactions')
          .select('payment_method_id')
          .eq('id', settleAgg[0].aggregate_id)
          .maybeSingle()
        paymentMethodId = (agg?.payment_method_id as number) || null
      }
    }

    if (!paymentMethodId) return null

    const { data: pm } = await supabase
      .from('payment_methods')
      .select('coa_account_id')
      .eq('id', paymentMethodId)
      .maybeSingle()

    return (pm?.coa_account_id as string) || null
  }

  private async findFiscalPeriod(companyId: string, date: string) {
    const { data } = await supabase
      .from('fiscal_periods')
      .select('id, period, period_start, period_end, is_open')
      .eq('company_id', companyId)
      .lte('period_start', date)
      .gte('period_end', date)
      .is('deleted_at', null)
      .maybeSingle()

    return data as { id: string; period: string; is_open: boolean } | null
  }
}

export const feeDiscrepancyReviewService = new FeeDiscrepancyReviewService()
