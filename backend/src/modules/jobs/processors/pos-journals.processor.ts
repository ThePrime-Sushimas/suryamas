/**
 * POS Journal Generation Processor — Rewrite v2
 *
 * Architecture:
 * - DEBIT per channel        → payment_methods.coa_account_id (ASSET or LIABILITY)
 * - DEBIT fee expense        → payment_methods.fee_coa_account_id
 * - DEBIT sales discount     → SAL-INV purpose accounts (DEBIT side, REVENUE type) ← NEW
 * - CREDIT revenue (gross)   → SAL-INV purpose accounts (CREDIT side, REVENUE type, lowest priority)
 * - CREDIT tax               → SAL-INV purpose accounts (CREDIT side, LIABILITY type, lowest priority)
 * - CREDIT fee liability     → payment_methods.fee_liability_coa_account_id
 *
 * Journal balance formula (strict):
 *   Σ DEBIT  = Σ(bill_after_discount per channel) + Σ(fee_amount) + Σ(discount_amount)
 *   Σ CREDIT = Σ(gross_amount) + Σ(tax_amount) + Σ(fee_liability)
 *            = Σ(bill + discount - discount) + Σ(tax) + Σ(fee)
 *            = Σ(gross) + Σ(tax) + Σ(fee)
 *
 * Proof:
 *   gross + tax - discount = bill_after_discount
 *   → gross = bill_after_discount + discount - tax
 *
 *   DEBIT  = bill + fee + discount
 *   CREDIT = gross + tax + fee
 *          = (bill + discount - tax) + tax + fee
 *          = bill + discount + fee  ✓
 *
 * BLOCK conditions (journal not created, goes to failed[]):
 *   1. fee_amount > 0 AND fee_coa_account_id IS NULL
 *   2. fee_amount > 0 AND fee_liability_coa_account_id IS NULL
 *   3. SAL-INV purpose not found or not active
 *   4. SAL-INV has no CREDIT REVENUE account
 *   5. tax_amount > 0 AND SAL-INV has no CREDIT LIABILITY account
 *   6. discount_amount > 0 AND SAL-INV has no DEBIT REVENUE account
 *   7. Any transaction in group is NOT reconciled (is_reconciled = false)
 *   8. Total balance mismatch after line construction
 *
 * Special payment_type handling:
 *   COMPLIMENT    → CREDIT to coa_account_id (reduces revenue)
 *   MEMBER_DEPOSIT → DEBIT to coa_account_id (reduces liability)
 *   ASSET types   → DEBIT to coa_account_id
 */

import { supabase } from '../../../config/supabase'
import { logInfo, logError, logWarn } from '../../../config/logger'
import type {
  AggregatedTransaction,
  GenerateJournalResult,
} from '../../pos-imports/pos-aggregates/pos-aggregates.types'

// ==============================
// CONFIGURATION
// ==============================
const CHUNK_SIZE = 500
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const SAL_INV_PURPOSE_CODE = 'SAL-INV'

// ==============================
// TYPES
// ==============================

export interface ProgressCallback {
  (progress: {
    current: number
    total: number
    phase: string
    message: string
  }): void
}

export interface GenerateJournalsResult {
  success: GenerateJournalResult[]
  failed: Array<{ date: string; branch: string; error: string }>
  total_transactions: number
  total_journals: number
  duration_ms: number
}

interface PaymentMethodResolved {
  id: number
  name: string
  code: string
  paymentType: string
  coaAccountId: string
  coaAccountType: string // ASSET | LIABILITY | REVENUE | EXPENSE
  feeCoaAccountId: string | null
  feeLiabilityCoaAccountId: string | null
}

interface SalInvConfig {
  revenueAccountId: string    // CREDIT REVENUE lowest priority (gross sales)
  taxAccountId: string | null // CREDIT LIABILITY lowest priority (PB1/PPN)
  discountAccountId: string | null // DEBIT REVENUE lowest priority (contra revenue) ← NEW
}

// ==============================
// UTILITIES
// ==============================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getRetryDelay(attempt: number): number {
  return RETRY_DELAY_MS * Math.pow(2, attempt - 1)
}

/** Round to 2 decimal places to avoid floating point drift */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ==============================
// LOOKUP FUNCTIONS
// ==============================

/**
 * Batch resolve payment methods with all COA fields.
 * Uses two separate queries to avoid Supabase PostgREST
 * nested join issues with foreign key aliases.
 * Returns a Map keyed by payment_method id.
 */
async function resolvePaymentMethods(
  paymentMethodIds: number[]
): Promise<Map<number, PaymentMethodResolved>> {
  const result = new Map<number, PaymentMethodResolved>()
  if (paymentMethodIds.length === 0) return result

  // Query 1: Get payment methods (no join)
  const { data: pms, error: pmError } = await supabase
    .from('payment_methods')
    .select('id, name, code, payment_type, coa_account_id, fee_coa_account_id, fee_liability_coa_account_id')
    .in('id', paymentMethodIds)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (pmError) {
    logError('resolvePaymentMethods: PM query failed', { error: pmError })
    return result
  }

  if (!pms || pms.length === 0) {
    logError('resolvePaymentMethods: no payment methods returned', { ids: paymentMethodIds })
    return result
  }

  // Query 2: Get COA account_type for all coa_account_ids
  const coaIds = [...new Set(pms.map(pm => pm.coa_account_id).filter(Boolean))]
  const coaTypeMap = new Map<string, string>()

  if (coaIds.length > 0) {
    const { data: coas, error: coaError } = await supabase
      .from('chart_of_accounts')
      .select('id, account_type')
      .in('id', coaIds)

    if (coaError) {
      logError('resolvePaymentMethods: COA query failed', { error: coaError })
    } else {
      for (const coa of coas ?? []) {
        coaTypeMap.set(coa.id, coa.account_type)
      }
    }
  }

  // Build result map
  for (const pm of pms) {
    const coaType = pm.coa_account_id
      ? (coaTypeMap.get(pm.coa_account_id) ?? 'ASSET')
      : 'ASSET'

    result.set(pm.id, {
      id: pm.id,
      name: pm.name,
      code: pm.code,
      paymentType: pm.payment_type,
      coaAccountId: pm.coa_account_id ?? '',
      coaAccountType: coaType,
      feeCoaAccountId: pm.fee_coa_account_id ?? null,
      feeLiabilityCoaAccountId: (pm as any).fee_liability_coa_account_id ?? null,
    })
  }

  logInfo('resolvePaymentMethods: resolved', {
    requested: paymentMethodIds.length,
    resolved: result.size,
  })

  return result
}

/**
 * Load SAL-INV purpose config.
 * Scoped as a factory — caller manages cache lifetime.
 */
async function loadSalInvConfig(companyId: string): Promise<SalInvConfig> {
  const { data: purpose, error: purposeError } = await supabase
    .from('accounting_purposes')
    .select('id')
    .eq('purpose_code', SAL_INV_PURPOSE_CODE)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (purposeError || !purpose) {
    throw new Error(
      `SAL-INV purpose tidak ditemukan atau tidak aktif untuk company ${companyId}`
    )
  }

  const { data: accounts, error: accountsError } = await supabase
    .from('accounting_purpose_accounts')
    .select('account_id, side, priority')
    .eq('purpose_id', purpose.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('priority', { ascending: true })

  if (accountsError) throw new Error(`Gagal load SAL-INV accounts: ${accountsError.message}`)
  if (!accounts || accounts.length === 0) throw new Error('SAL-INV tidak memiliki akun yang aktif')

  const creditAccounts = accounts.filter(a => a.side === 'CREDIT')
  const debitAccounts  = accounts.filter(a => a.side === 'DEBIT')

  if (creditAccounts.length === 0) {
    throw new Error('SAL-INV tidak memiliki akun CREDIT yang aktif')
  }

  const allCoaIds = [...new Set(accounts.map(a => a.account_id))]
  const { data: coas, error: coaError } = await supabase
    .from('chart_of_accounts')
    .select('id, account_type')
    .in('id', allCoaIds)

  if (coaError) throw new Error(`Gagal load COA types untuk SAL-INV: ${coaError.message}`)

  const coaTypeMap = new Map<string, string>()
  for (const coa of coas ?? []) coaTypeMap.set(coa.id, coa.account_type)

  const revenueAccount = creditAccounts.find(a => coaTypeMap.get(a.account_id) === 'REVENUE')
  if (!revenueAccount) throw new Error('SAL-INV tidak memiliki akun CREDIT dengan tipe REVENUE')

  const taxAccount      = creditAccounts.find(a => coaTypeMap.get(a.account_id) === 'LIABILITY') ?? null
  const discountAccount = debitAccounts.find(a => coaTypeMap.get(a.account_id) === 'REVENUE') ?? null

  const config: SalInvConfig = {
    revenueAccountId:  revenueAccount.account_id,
    taxAccountId:      taxAccount?.account_id ?? null,
    discountAccountId: discountAccount?.account_id ?? null,
  }

  logInfo('SAL-INV config loaded', config)
  return config
}

// ==============================
// BRANCH LOOKUP WITH CACHE
// ==============================

async function resolveBranch(
  branchName: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  if (cache.has(branchName)) return cache.get(branchName)!

  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .ilike('branch_name', branchName.trim())
    .eq('status', 'active')
    .maybeSingle()

  const id = error || !data ? null : data.id
  cache.set(branchName, id)
  return id
}

// ==============================
// FISCAL PERIOD VALIDATION
// ==============================

interface FiscalPeriod {
  id: string
  period: string
  period_start: string
  period_end: string
  is_open: boolean
}

function findPeriodForDate(
  date: string,
  periods: FiscalPeriod[]
): FiscalPeriod | undefined {
  return periods.find(
    p => date >= p.period_start && date <= p.period_end
  )
}

// ==============================
// JOURNAL CREATION WITH RETRY
// ==============================

interface JournalHeaderResult {
  id: string
  journalNumber: string
  isExisting: boolean
  status?: string
}

async function createJournalHeaderWithRetry(
  params: {
    companyId: string
    branchId: string | null
    journalNumber: string
    journalDate: string
    period: string
    description: string
    totalAmount: number
  },
  attempt = 0
): Promise<JournalHeaderResult | null> {
  try {
    const { data, error } = await supabase.rpc('create_journal_header_atomic', {
      p_company_id:    params.companyId,
      p_branch_id:     params.branchId,
      p_journal_number: params.journalNumber,
      p_journal_type:  'SALES',
      p_journal_date:  params.journalDate,
      p_period:        params.period,
      p_description:   params.description,
      p_total_amount:  params.totalAmount,
      p_source_module: 'POS_AGGREGATES',
    })

    if (error) throw new Error(error.message)

    const row = Array.isArray(data) ? data[0] : data
    if (!row?.id) return null

    return {
      id: row.id,
      journalNumber: row.journal_number,
      isExisting: row.is_existing ?? false,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const isRetryable =
      attempt < MAX_RETRIES &&
      (msg.includes('connection') ||
        msg.includes('timeout') ||
        msg.includes('rate limit'))

    if (isRetryable) {
      await sleep(getRetryDelay(attempt + 1))
      return createJournalHeaderWithRetry(params, attempt + 1)
    }
    throw err
  }
}

async function insertJournalLinesWithRetry(
  journalHeaderId: string,
  lines: any[],
  attempt = 0
): Promise<void> {
  if (lines.length === 0) return

  for (let i = 0; i < lines.length; i += CHUNK_SIZE) {
    const chunk = lines.slice(i, i + CHUNK_SIZE)
    try {
      const { error } = await supabase.from('journal_lines').insert(chunk)
      if (error) throw new Error(error.message)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      const isRetryable =
        attempt < MAX_RETRIES &&
        (msg.includes('connection') ||
          msg.includes('timeout') ||
          msg.includes('rate limit'))

      if (isRetryable) {
        await sleep(getRetryDelay(attempt + 1))
        return insertJournalLinesWithRetry(journalHeaderId, lines, attempt + 1)
      }
      throw err
    }
  }
}

async function rollbackJournalHeader(journalHeaderId: string): Promise<void> {
  try {
    await supabase.from('journal_headers').delete().eq('id', journalHeaderId)
    logInfo('Rolled back journal header', { journalHeaderId })
  } catch (err) {
    logError('Rollback failed', { journalHeaderId, err })
  }
}

async function checkJournalLinesExist(journalHeaderId: string): Promise<boolean> {
  const { data } = await supabase
    .from('journal_lines')
    .select('id')
    .eq('journal_header_id', journalHeaderId)
    .limit(1)
  return (data?.length ?? 0) > 0
}

async function updateTransactionsJournalId(
  transactionIds: string[],
  journalId: string
): Promise<void> {
  const { error } = await supabase
    .from('aggregated_transactions')
    .update({
      journal_id: journalId,
      status: 'PROCESSING' as const,
      updated_at: new Date().toISOString(),
    })
    .in('id', transactionIds)

  if (error) {
    logError('updateTransactionsJournalId failed', { transactionIds, journalId, error })
    throw error
  }
}

// ==============================
// JOURNAL LINE BUILDER
// ==============================

interface JournalLineInput {
  journal_header_id: string
  line_number: number
  account_id: string
  description: string
  debit_amount: number
  credit_amount: number
  currency: string
  exchange_rate: number
  base_debit_amount: number
  base_credit_amount: number
  created_at: string
}

function makeLine(
  headerId: string,
  lineNum: number,
  accountId: string,
  description: string,
  debit: number,
  credit: number
): JournalLineInput | null {
  const d = round2(debit)
  const c = round2(credit)

  // DB constraint: check_debit_or_credit — at least one must be > 0
  if (d === 0 && c === 0) {
    logWarn('makeLine: skipping zero-amount line', { accountId, description })
    return null
  }

  return {
    journal_header_id:  headerId,
    line_number:        lineNum,
    account_id:         accountId,
    description,
    debit_amount:       d,
    credit_amount:      c,
    currency:           'IDR',
    exchange_rate:      1,
    base_debit_amount:  d,
    base_credit_amount: c,
    created_at:         new Date().toISOString(),
  }
}

// ==============================
// MAIN PROCESSOR
// ==============================

export async function generateJournalsOptimized(
  transactions: AggregatedTransaction[],
  companyId: string,
  onProgress?: ProgressCallback
): Promise<GenerateJournalsResult> {
  const startTime = Date.now()

  if (transactions.length === 0) {
    return { success: [], failed: [], total_transactions: 0, total_journals: 0, duration_ms: 0 }
  }

  logInfo('Starting journal generation', {
    transaction_count: transactions.length,
    company_id: companyId,
  })

  // ── PHASE 1: Load global config (fail-fast) ──────────────────────────
  onProgress?.({ current: 5, total: 100, phase: 'config', message: 'Loading SAL-INV config...' })

  let salInvConfig: SalInvConfig
  try {
    salInvConfig = await loadSalInvConfig(companyId)
  } catch (err) {
    throw new Error(
      `Konfigurasi akuntansi tidak lengkap: ${err instanceof Error ? err.message : err}`
    )
  }

  // ── PHASE 2: Load fiscal periods ─────────────────────────────────────
  onProgress?.({ current: 10, total: 100, phase: 'fiscal', message: 'Loading fiscal periods...' })

  const { data: fiscalPeriods, error: periodError } = await supabase
    .from('fiscal_periods')
    .select('id, period, period_start, period_end, is_open')
    .eq('company_id', companyId)
    .is('deleted_at', null)

  if (periodError) throw new Error(`Gagal load fiscal periods: ${periodError.message}`)

  // ── PHASE 3: Group transactions by date + branch ──────────────────────
  onProgress?.({ current: 15, total: 100, phase: 'grouping', message: 'Grouping transactions...' })

  const txByGroup = new Map<string, AggregatedTransaction[]>()
  for (const tx of transactions) {
    const key = `${tx.transaction_date}|${tx.branch_name ?? 'Unknown'}`
    if (!txByGroup.has(key)) txByGroup.set(key, [])
    txByGroup.get(key)!.push(tx)
  }

  const groups = Array.from(txByGroup.entries())
  logInfo('Transaction groups created', { total_groups: groups.length })

  // ── PHASE 4: Resolve all payment methods in one batch ─────────────────
  onProgress?.({ current: 20, total: 100, phase: 'lookup', message: 'Resolving payment methods...' })

  const uniquePmIds = Array.from(new Set(transactions.map(t => t.payment_method_id).filter((id): id is number => typeof id === 'number')))
  const pmMap = await resolvePaymentMethods(uniquePmIds)

  // ── PHASE 5: Process each group ───────────────────────────────────────
  onProgress?.({ current: 25, total: 100, phase: 'processing', message: 'Generating journals...' })

  const successResults: GenerateJournalResult[] = []
  const failedResults: Array<{ date: string; branch: string; error: string }> = []
  const branchCache = new Map<string, string | null>()

  for (let gi = 0; gi < groups.length; gi++) {
    const [key, groupTxs] = groups[gi]
    const [date, branchName] = key.split('|')

    const progress = 25 + Math.min(65, Math.floor((gi / groups.length) * 65))
    onProgress?.({
      current: progress,
      total: 100,
      phase: 'processing',
      message: `Processing ${branchName} - ${date} (${gi + 1}/${groups.length})`,
    })

    try {
      // ── 5.1 Validate fiscal period ──────────────────────────────────
      const period = findPeriodForDate(date, fiscalPeriods ?? [])

      if (!period) {
        failedResults.push({ date, branch: branchName, error: 'Tidak ada periode fiskal untuk tanggal ini' })
        continue
      }
      if (!period.is_open) {
        failedResults.push({ date, branch: branchName, error: `Periode ${period.period} sudah ditutup` })
        continue
      }

      // ── 5.2 Resolve branch ─────────────────────────────────────────
      const branchId = await resolveBranch(branchName, branchCache)
      if (!branchId) {
        failedResults.push({
          date, branch: branchName,
          error: `Branch "${branchName}" tidak ditemukan di database atau tidak aktif. Periksa nama branch di master data.`,
        })
        continue
      }

      // ── 5.2b Validate all transactions are reconciled ──────────────
      const unreconciledTxs = groupTxs.filter(tx => !tx.is_reconciled)
      if (unreconciledTxs.length > 0) {
        failedResults.push({
          date, branch: branchName,
          error: `${unreconciledTxs.length} dari ${groupTxs.length} transaksi belum direkonsiliasi. Semua transaksi harus di-reconcile sebelum generate jurnal.`,
        })
        continue
      }

      // ── 5.3 Validate all payment methods have required COA ─────────
      const validationErrors: string[] = []

      for (const tx of groupTxs) {
        const pm = pmMap.get(tx.payment_method_id as number)

        if (!pm) {
          validationErrors.push(`Payment method id ${tx.payment_method_id} tidak ditemukan atau tidak aktif`)
          continue
        }
        if (!pm.coaAccountId) {
          validationErrors.push(`Payment method ${pm.name} tidak memiliki COA account`)
          continue
        }

        const feeAmt = Number(tx.total_fee_amount ?? 0)
        if (feeAmt > 0 && !pm.feeCoaAccountId) {
          validationErrors.push(
            `Payment method ${pm.name} memiliki fee Rp ${feeAmt.toLocaleString('id-ID')} tapi fee_coa_account_id belum dikonfigurasi`
          )
        }
        if (feeAmt > 0 && pm.feeCoaAccountId && !pm.feeLiabilityCoaAccountId) {
          validationErrors.push(
            `Payment method ${pm.name} memiliki fee tapi fee_liability_coa_account_id belum dikonfigurasi (diperlukan untuk full accrual model)`
          )
        }
      }

      if (validationErrors.length > 0) {
        failedResults.push({ date, branch: branchName, error: validationErrors.join('; ') })
        continue
      }

      // ── 5.4 Build aggregated data per payment method ───────────────
      interface PmAgg {
        pm: PaymentMethodResolved
        billTotal:     number  // bill_after_discount
        grossTotal:    number  // gross_amount (revenue before discount & tax)
        discountTotal: number  // discount_amount
        taxTotal:      number  // tax_amount (PB1/PPN)
        feeTotal:      number  // total_fee_amount
      }

      const pmAggMap = new Map<number, PmAgg>()

      for (const tx of groupTxs) {
        const pm = pmMap.get(tx.payment_method_id as number)!
        if (!pmAggMap.has(pm.id)) {
          pmAggMap.set(pm.id, {
            pm,
            billTotal:     0,
            grossTotal:    0,
            discountTotal: 0,
            taxTotal:      0,
            feeTotal:      0,
          })
        }
        const agg = pmAggMap.get(pm.id)!
        agg.billTotal     = round2(agg.billTotal     + Number(tx.bill_after_discount))
        agg.grossTotal    = round2(agg.grossTotal    + Number(tx.gross_amount))
        agg.discountTotal = round2(agg.discountTotal + Number(tx.discount_amount ?? 0))
        agg.taxTotal      = round2(agg.taxTotal      + Number(tx.tax_amount ?? 0))
        agg.feeTotal      = round2(agg.feeTotal      + Number(tx.total_fee_amount ?? 0))
      }

      const pmAggList = Array.from(pmAggMap.values())

      // ── 5.5 Compute group totals ───────────────────────────────────
      const grandBill     = round2(pmAggList.reduce((s, a) => s + a.billTotal,     0))
      const grandGross    = round2(pmAggList.reduce((s, a) => s + a.grossTotal,    0))
      const grandDiscount = round2(pmAggList.reduce((s, a) => s + a.discountTotal, 0))
      const grandTax      = round2(pmAggList.reduce((s, a) => s + a.taxTotal,      0))
      const grandFee      = round2(pmAggList.reduce((s, a) => s + a.feeTotal,      0))

      // Sanity check: gross + tax - discount should equal bill
      // gross_amount in aggregated_transactions is already net of discount
      // Formula: bill_after_discount = gross_amount + tax_amount - discount_amount
      // (this depends on how POS system computes it — log a warning if off)
      const expectedBill = round2(grandGross + grandTax - grandDiscount)
      if (Math.abs(expectedBill - grandBill) > 1) {
        logWarn('Bill amount mismatch — check aggregation formula', {
          date, branchName,
          grandBill, grandGross, grandTax, grandDiscount,
          expectedBill,
        })
      }

      // ── 5.6 Validate tax & discount config ────────────────────────
      if (grandTax > 0 && !salInvConfig.taxAccountId) {
        failedResults.push({
          date, branch: branchName,
          error: 'Ada tax_amount > 0 tapi SAL-INV tidak memiliki akun LIABILITY untuk pajak. Tambahkan akun PB1 Payable ke SAL-INV purpose (CREDIT side, account_type LIABILITY).',
        })
        continue
      }

      if (grandDiscount > 0 && !salInvConfig.discountAccountId) {
        failedResults.push({
          date, branch: branchName,
          error: 'Ada discount_amount > 0 tapi SAL-INV tidak memiliki akun REVENUE untuk diskon. Tambahkan akun 410301 (Bill Discount) ke SAL-INV purpose (DEBIT side, account_type REVENUE).',
        })
        continue
      }

      // ── 5.7 Create journal header ──────────────────────────────────
      // total_amount = total DEBIT = total CREDIT of all journal lines
      // = grandBill + grandFee + grandDiscount
      const grandTotalDebit = round2(grandBill + grandFee + grandDiscount)

      const branchSlug    = branchName.replace(/\s+/g, '-').toUpperCase()
      const journalNumber = `RCP-${branchSlug}-${date}`
      const periodCode    = period.period

      const journalHeader = await createJournalHeaderWithRetry({
        companyId,
        branchId,
        journalNumber,
        journalDate: date,
        period: periodCode,
        description: `POS Sales ${date} - ${branchName}`,
        totalAmount: grandTotalDebit, // ← total actual debit = total actual credit
      })

      if (!journalHeader) throw new Error('create_journal_header_atomic returned null')

      // ── 5.8 Idempotency check ──────────────────────────────────────
      if (journalHeader.isExisting) {
        // Fetch status untuk cek apakah sudah POSTED
        const { data: existingHeader } = await supabase
          .from('journal_headers')
          .select('status')
          .eq('id', journalHeader.id)
          .single()

        if (existingHeader?.status === 'POSTED') {
          // Jurnal sudah final — jangan sentuh apapun
          logInfo('Journal already POSTED, skipping', {
            journalId: journalHeader.id,
            date,
            branchName,
          })
          failedResults.push({
            date,
            branch: branchName,
            error: `Jurnal ${journalHeader.journalNumber} sudah berstatus POSTED dan tidak bisa di-generate ulang. Lakukan reversal terlebih dahulu jika perlu koreksi.`,
          })
          continue
        }

        // Existing tapi belum POSTED — hapus lines lama dan re-generate
        // Ini mencegah stale lines dari run sebelumnya yang mungkin sudah tidak akurat
        // (misal: amount berubah karena re-reconciliation)
        await supabase
          .from('journal_lines')
          .delete()
          .eq('journal_header_id', journalHeader.id)

        await supabase
          .from('journal_headers')
          .update({
            total_debit:  grandTotalDebit,
            total_credit: grandTotalDebit,
            description:  `POS Sales ${date} - ${branchName}`,
            updated_at:   new Date().toISOString(),
          })
          .eq('id', journalHeader.id)

        logInfo('Replacing DRAFT journal lines', {
          journalId: journalHeader.id,
          journalNumber: journalHeader.journalNumber,
          date,
          branchName,
        })
      }

      // ── 5.9 Build journal lines ────────────────────────────────────
      const lines: JournalLineInput[] = []
      let lineNum = 1

      let checkDebit  = 0
      let checkCredit = 0

      // Helper: push line only if non-zero, with consecutive line numbers
      const pushLine = (accountId: string, desc: string, debit: number, credit: number) => {
        const line = makeLine(journalHeader.id, lineNum, accountId, desc, debit, credit)
        if (line) {
          lines.push(line)
          lineNum++
          checkDebit  += debit    // raw accumulation — sama seperti sebelum refactor
          checkCredit += credit
        }
      }

      // ── DEBIT lines: channel receivables / cash ────────────────────
      for (const agg of pmAggList) {
        const { pm, billTotal, feeTotal } = agg
        const pmDesc = pm.name

        if (pm.paymentType === 'COMPLIMENT') {
          pushLine(pm.coaAccountId, `POS Sales - ${pmDesc}`, 0, billTotal)
        } else {
          pushLine(pm.coaAccountId, `POS Sales - ${pmDesc}`, billTotal, 0)
        }

        // Fee lines: Full Accrual Model
        if (feeTotal > 0 && pm.feeCoaAccountId) {
          pushLine(pm.feeCoaAccountId, `Fee - ${pmDesc}`, feeTotal, 0)

          if (pm.feeLiabilityCoaAccountId) {
            pushLine(pm.feeLiabilityCoaAccountId, `MDR Payable - ${pmDesc}`, 0, feeTotal)
          } else {
            logError('fee_liability_coa_account_id missing for accrual model', {
              payment_method: pm.name, fee_amount: feeTotal,
            })
          }
        }
      }

      // ── DEBIT: sales discount (contra revenue) ─────────────────────
      if (grandDiscount > 0 && salInvConfig.discountAccountId) {
        pushLine(salInvConfig.discountAccountId, 'Sales Discount', grandDiscount, 0)
      }

      // ── CREDIT: gross sales revenue ────────────────────────────────
      pushLine(salInvConfig.revenueAccountId, 'POS Sales Revenue', 0, grandGross)

      // ── CREDIT: PB1 / PPN tax payable ─────────────────────────────
      if (grandTax > 0 && salInvConfig.taxAccountId) {
        pushLine(salInvConfig.taxAccountId, 'PB1 Tax Payable', 0, grandTax)
      }

      // ── 5.10 Balance validation ────────────────────────────────────
      //
      // Expected:
      //   DEBIT  = Σ(bill per channel) + Σ(fee expense) + Σ(discount)
      //   CREDIT = Σ(gross revenue)    + Σ(tax payable) + Σ(fee liability)
      //
      // Proof of balance:
      //   gross = bill + discount - tax   (from aggregated_transactions formula)
      //   CREDIT = (bill + discount - tax) + tax + fee
      //          =  bill + discount + fee
      //          = DEBIT ✓
      //
      const balanceDiff = round2(Math.abs(checkDebit - checkCredit))

      if (balanceDiff > 1) {
        await rollbackJournalHeader(journalHeader.id)
        failedResults.push({
          date, branch: branchName,
          error: [
            `Journal tidak balance:`,
            `DEBIT ${checkDebit.toLocaleString('id-ID')} ≠ CREDIT ${checkCredit.toLocaleString('id-ID')}`,
            `(selisih ${balanceDiff.toLocaleString('id-ID')}).`,
            `Pastikan fee_liability_coa_account_id terkonfigurasi di semua payment methods yang memiliki fee`,
            `dan akun discount terdaftar di SAL-INV purpose.`,
          ].join(' '),
        })
        continue
      }

      // ── 5.11 Insert lines ──────────────────────────────────────────
      try {
        await insertJournalLinesWithRetry(journalHeader.id, lines)
      } catch (insertErr) {
        await rollbackJournalHeader(journalHeader.id)
        throw insertErr
      }

      // ── 5.12 Update transaction status ────────────────────────────
      await updateTransactionsJournalId(groupTxs.map(t => t.id), journalHeader.id)

      logInfo('Journal created', {
        journalId:      journalHeader.id,
        journalNumber,
        date,
        branchName,
        lines:          lines.length,
        debit:          checkDebit,
        credit:         checkCredit,
        grandBill,
        grandGross,
        grandDiscount,
        grandTax,
        grandFee,
        grandTotalDebit,
      })

      successResults.push({
        date, branch_name: branchName,
        transaction_ids: groupTxs.map(t => t.id),
        journal_id:      journalHeader.id,
        total_amount:    round2(grandGross),
        journal_number:  journalHeader.journalNumber,
      })
    } catch (err) {
      logError('Failed to generate journal for group', { date, branch: branchName, err })
      failedResults.push({
        date, branch: branchName,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  // ── PHASE 6: Done ─────────────────────────────────────────────────────
  const duration = Date.now() - startTime

  onProgress?.({
    current: 100, total: 100, phase: 'complete',
    message: `Selesai: ${successResults.length} jurnal dibuat, ${failedResults.length} gagal`,
  })

  logInfo('Journal generation complete', {
    transactions:     transactions.length,
    journals_created: successResults.length,
    journals_failed:  failedResults.length,
    duration_ms:      duration,
  })

  return {
    success:            successResults,
    failed:             failedResults,
    total_transactions: transactions.length,
    total_journals:     successResults.length,
    duration_ms:        duration,
  }
}

/** Alias without progress callback */
export async function generateJournals(
  transactions: AggregatedTransaction[],
  companyId: string
): Promise<GenerateJournalsResult> {
  return generateJournalsOptimized(transactions, companyId)
}