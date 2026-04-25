import { feeDiscrepancyReviewRepository } from './fee-discrepancy-review.repository'
import type { FeeDiscrepancyFilter, FeeDiscrepancySource, FeeDiscrepancyStatus } from './fee-discrepancy-review.types'
import { BusinessRuleError } from '@/utils/errors.base'
import { logInfo, logError } from '@/config/logger'
import { supabase } from '@/config/supabase'

const FEE_DISC_PURPOSE_CODE = 'FEE-DISC'

function round2(n: number): number {
  return Math.round(n * 100) / 100
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

    // Audit log
    const auditPayload = {
      user_id: userId,
      action: 'UPDATE',
      entity: 'fee_discrepancy_review',
      entity_id: sourceId,
      after: JSON.stringify({ source, sourceId, status, notes, correctionJournalId }),
      timestamp: new Date().toISOString(),
    }
    try { await supabase.from('audit_logs').insert(auditPayload) } catch { /* fire-and-forget */ }

    logInfo('Fee discrepancy status updated', { source, sourceId, status, userId })
  }

  /**
   * Create correction journal to reverse fee discrepancy
   * DEBIT  610105 Fee Discrepancy  (reverse negative disc / bank bayar lebih)
   * CREDIT Receivable per channel  (clear piutang dari POS baru)
   * 
   * Or vice versa for positive disc
   */
  async createCorrectionJournal(
    companyId: string,
    source: FeeDiscrepancySource,
    sourceId: string,
    userId: string,
    notes?: string,
  ): Promise<{ journalId: string; journalNumber: string }> {
    // 1. Get discrepancy details
    const discItem = await this.getDiscrepancyDetail(companyId, source, sourceId)
    if (!discItem) throw new BusinessRuleError('Fee discrepancy tidak ditemukan')

    const amount = Math.abs(discItem.discrepancyAmount)
    if (amount < 1) throw new BusinessRuleError('Selisih terlalu kecil untuk dikoreksi')

    // 2. Load FEE-DISC account
    const feeDiscAccountId = await this.loadFeeDiscAccountId(companyId)
    if (!feeDiscAccountId) throw new BusinessRuleError('Akun FEE-DISC belum dikonfigurasi')

    // 3. Get receivable account from payment method
    const receivableAccountId = await this.getReceivableAccountId(source, sourceId, companyId)
    if (!receivableAccountId) throw new BusinessRuleError('Akun receivable tidak ditemukan untuk payment method ini')

    // 4. Find fiscal period
    const journalDate = discItem.transactionDate
    const period = await this.findFiscalPeriod(companyId, journalDate)
    if (!period) throw new BusinessRuleError(`Tidak ada periode fiskal untuk tanggal ${journalDate}`)
    if (!period.is_open) throw new BusinessRuleError(`Periode ${period.period} sudah ditutup`)

    // 5. Create journal header
    const journalNumber = `FEE-CORR-${journalDate}-${sourceId.slice(0, 8)}`

    const { data: headerData, error: headerError } = await supabase.rpc('create_journal_header_atomic', {
      p_company_id: companyId,
      p_branch_id: null,
      p_journal_number: journalNumber,
      p_journal_type: 'GENERAL',
      p_journal_date: journalDate,
      p_period: period.period,
      p_description: notes || `Koreksi fee discrepancy - ${discItem.paymentMethodName || source}`,
      p_total_amount: amount,
      p_source_module: 'FEE_DISCREPANCY_CORRECTION',
    })

    if (headerError) throw new Error(headerError.message)
    const header = Array.isArray(headerData) ? headerData[0] : headerData
    if (!header?.id) throw new Error('Gagal membuat journal header')

    const journalId = header.id as string
    const actualJournalNumber = header.journal_number as string

    // 6. Build journal lines
    // Original bank-rec journal had:
    //   disc > 0 (bank kurang): DEBIT Fee Disc
    //   disc < 0 (bank lebih):  CREDIT Fee Disc
    // Correction reverses this:
    const isPositiveDisc = discItem.discrepancyAmount > 0

    const lines = [
      {
        line_number: 1,
        account_id: feeDiscAccountId,
        description: `Koreksi fee discrepancy - ${discItem.paymentMethodName || source}`,
        debit_amount: isPositiveDisc ? 0 : amount,
        credit_amount: isPositiveDisc ? amount : 0,
        currency: 'IDR',
        exchange_rate: 1,
        base_debit_amount: isPositiveDisc ? 0 : amount,
        base_credit_amount: isPositiveDisc ? amount : 0,
      },
      {
        line_number: 2,
        account_id: receivableAccountId,
        description: `Clear receivable - ${discItem.paymentMethodName || source}`,
        debit_amount: isPositiveDisc ? amount : 0,
        credit_amount: isPositiveDisc ? 0 : amount,
        currency: 'IDR',
        exchange_rate: 1,
        base_debit_amount: isPositiveDisc ? amount : 0,
        base_credit_amount: isPositiveDisc ? 0 : amount,
      },
    ]

    // 7. Post lines
    const { error: linesError } = await supabase.rpc('post_journal_lines_atomic', {
      p_journal_header_id: journalId,
      p_lines: lines,
      p_bank_statement_ids: [],
      p_aggregate_ids: [],
      p_set_processing: false,
    })

    if (linesError) {
      // Rollback header
      await supabase.from('journal_headers').delete().eq('id', journalId)
      throw new Error(`Gagal insert journal lines: ${linesError.message}`)
    }

    // 8. Update review status to CORRECTED
    await this.repo.updateStatus(companyId, source, sourceId, 'CORRECTED', userId, notes, journalId)

    // 9. Audit log
    try {
      await supabase.from('audit_logs').insert({
        user_id: userId,
        action: 'CREATE',
        entity: 'fee_discrepancy_correction',
        entity_id: journalId,
        after: JSON.stringify({ source, sourceId, journalId, journalNumber: actualJournalNumber, amount }),
        timestamp: new Date().toISOString(),
      })
    } catch { /* fire-and-forget */ }

    logInfo('Fee discrepancy correction journal created', { journalId, journalNumber: actualJournalNumber, source, sourceId, amount })

    return { journalId, journalNumber: actualJournalNumber }
  }

  // ── Helpers ──

  private async getDiscrepancyDetail(companyId: string, source: FeeDiscrepancySource, sourceId: string) {
    const { data } = await this.repo.getDiscrepancies(companyId, { page: 1, limit: 10000 })
    return data.find(d => d.source === source && d.sourceId === sourceId) || null
  }

  private async loadFeeDiscAccountId(companyId: string): Promise<string | null> {
    const { data: purpose } = await supabase
      .from('accounting_purposes')
      .select('id')
      .eq('purpose_code', FEE_DISC_PURPOSE_CODE)
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

    return accounts?.[0]?.account_id as string || null
  }

  private async getReceivableAccountId(source: FeeDiscrepancySource, sourceId: string, companyId: string): Promise<string | null> {
    let paymentMethodId: number | null = null

    if (source === 'SINGLE_MATCH') {
      const { data } = await supabase
        .from('aggregated_transactions')
        .select('payment_method_id')
        .eq('id', sourceId)
        .maybeSingle()
      paymentMethodId = data?.payment_method_id as number || null
    } else if (source === 'MULTI_MATCH') {
      const { data } = await supabase
        .from('bank_reconciliation_groups')
        .select('aggregated_transactions ( payment_method_id )')
        .eq('id', sourceId)
        .maybeSingle()
      paymentMethodId = (data?.aggregated_transactions as unknown as { payment_method_id: number })?.payment_method_id || null
    } else if (source === 'SETTLEMENT_GROUP') {
      // Get first aggregate's payment method
      const { data } = await supabase
        .from('bank_settlement_aggregates')
        .select('aggregate_id')
        .eq('settlement_group_id', sourceId)
        .limit(1)
      if (data?.[0]) {
        const { data: agg } = await supabase
          .from('aggregated_transactions')
          .select('payment_method_id')
          .eq('id', data[0].aggregate_id)
          .maybeSingle()
        paymentMethodId = agg?.payment_method_id as number || null
      }
    }

    if (!paymentMethodId) return null

    // Get receivable COA from payment method
    const { data: pm } = await supabase
      .from('payment_methods')
      .select('coa_account_id')
      .eq('id', paymentMethodId)
      .maybeSingle()

    return pm?.coa_account_id as string || null
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
