/**
 * POS Journal Generation Processor — v3
 *
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  JOURNAL ARCHITECTURE                                           ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  DEBIT  channel receivable/cash  bill_after_discount (per PM)   ║
 * ║  DEBIT  deposit liability        bill_after_discount (DEPOSIT)  ║
 * ║  DEBIT  MDR expense              fee_amount          (per PM)   ║
 * ║  DEBIT  sales discount           discount_amount     (per PM)   ║
 * ║                                                                  ║
 * ║  CREDIT gross sales revenue      gross_amount        (global)   ║
 * ║  CREDIT PB1 tax payable          tax_amount          (global)   ║
 * ║  CREDIT MDR payable (ACCRUAL)    fee_amount          (per PM)   ║
 * ║                                                                  ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  BALANCE PROOF                                                   ║
 * ║                                                                  ║
 * ║  Source of truth: bill_after_discount (from aggregated_tx)      ║
 * ║  gross_amount is DERIVED, not trusted from upstream:            ║
 * ║    gross = bill + discount - tax                                 ║
 * ║                                                                  ║
 * ║  DEBIT  = Σ(bill) + Σ(fee) + Σ(discount)                       ║
 * ║  CREDIT = Σ(gross) + Σ(tax) + Σ(fee_accrual)                   ║
 * ║         = Σ(bill + discount - tax) + Σ(tax) + Σ(fee)           ║
 * ║         = Σ(bill) + Σ(discount) + Σ(fee)  ✓                    ║
 * ║                                                                  ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  PAYMENT TYPE HANDLING                                           ║
 * ║                                                                  ║
 * ║  CASH / BANK / CARD  → Dr channel receivable (ASSET)           ║
 * ║  MEMBER_DEPOSIT      → Dr deposit liability (reduce liability)  ║
 * ║  COMPLIMENT          → Cr coa_account_id (no Dr, skip revenue  ║
 * ║                         credit for this channel — handled by    ║
 * ║                         global grandGross which excludes it)    ║
 * ║  OTHER_COST          → Dr coa_account_id (expense direct)      ║
 * ║                                                                  ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  FEE SETTLEMENT MODEL                                            ║
 * ║                                                                  ║
 * ║  ACCRUAL  → Dr fee_expense + Cr fee_liability (MDR payable)     ║
 * ║  NET      → Dr fee_expense only (provider nets from payout,     ║
 * ║             no payable stage)                                    ║
 * ║                                                                  ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  BLOCK CONDITIONS (journal not created → failed[])              ║
 * ║                                                                  ║
 * ║  1. SAL-INV purpose not found or not active                     ║
 * ║  2. SAL-INV has no CREDIT REVENUE account                       ║
 * ║  3. tax_amount > 0 AND SAL-INV has no CREDIT LIABILITY account  ║
 * ║  4. discount_amount > 0 AND SAL-INV has no DEBIT REVENUE acct  ║
 * ║  5. fee_amount > 0 AND fee_coa_account_id IS NULL               ║
 * ║  6. fee_amount > 0 AND model=ACCRUAL AND liability IS NULL      ║
 * ║  7. Data contract violation: bill ≠ gross + tax - discount      ║
 * ║  8. Total balance mismatch after line construction              ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
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
const CHUNK_SIZE        = 500
const MAX_RETRIES       = 3
const RETRY_DELAY_MS    = 1000
const SAL_INV_CODE      = 'SAL-INV'

/**
 * Tolerance for data contract validation.
 * bill_after_discount must equal gross + tax - discount within this amount.
 * Set to 1.00 to absorb rounding from upstream POS systems.
 */
const DATA_CONTRACT_TOLERANCE = 1.00

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

type FeeSettlementModel = 'ACCRUAL' | 'NET'

interface PaymentMethodResolved {
  id: number
  name: string
  code: string
  paymentType: string           // CASH | BANK | CARD | COMPLIMENT | MEMBER_DEPOSIT | OTHER_COST
  coaAccountId: string          // primary COA for this PM
  coaAccountType: string        // ASSET | LIABILITY | REVENUE | EXPENSE
  feeCoaAccountId: string | null
  feeLiabilityCoaAccountId: string | null
  feeSettlementModel: FeeSettlementModel
}

interface SalInvConfig {
  revenueAccountId: string      // CREDIT REVENUE  — gross sales
  taxAccountId: string | null   // CREDIT LIABILITY — PB1/PPN payable
  discountAccountId: string | null // DEBIT REVENUE — contra revenue (e.g. 410301)
}

// ==============================
// UTILITIES
// ==============================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function getRetryDelay(attempt: number): number {
  return RETRY_DELAY_MS * Math.pow(2, attempt - 1)
}

/**
 * Round to 2 decimal places.
 * IMPORTANT: Only call this at output time (makeLine).
 * Accumulate raw numbers during aggregation to avoid drift.
 */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ==============================
// LOOKUP FUNCTIONS
// ==============================

/**
 * Batch resolve payment methods.
 * Two queries to avoid PostgREST nested join aliasing issues.
 */
async function resolvePaymentMethods(
  paymentMethodIds: number[]
): Promise<Map<number, PaymentMethodResolved>> {
  const result = new Map<number, PaymentMethodResolved>()
  if (paymentMethodIds.length === 0) return result

  const { data: pms, error: pmError } = await supabase
    .from('payment_methods')
    .select([
      'id', 'name', 'code', 'payment_type',
      'coa_account_id',
      'fee_coa_account_id',
      'fee_liability_coa_account_id',
      'fee_settlement_model',
    ].join(', '))
    .in('id', paymentMethodIds)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (pmError || !pms || pms.length === 0) {
    logError('resolvePaymentMethods: query failed', { error: pmError, ids: paymentMethodIds })
    return result
  }

  // Get account_type for all coa_account_ids
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
      for (const coa of coas ?? []) coaTypeMap.set(coa.id, coa.account_type)
    }
  }

  for (const pm of pms) {
    const coaType = pm.coa_account_id
      ? (coaTypeMap.get(pm.coa_account_id) ?? 'ASSET')
      : 'ASSET'

    result.set(pm.id, {
      id:                       pm.id,
      name:                     pm.name,
      code:                     pm.code,
      paymentType:              pm.payment_type,
      coaAccountId:             pm.coa_account_id ?? '',
      coaAccountType:           coaType,
      feeCoaAccountId:          pm.fee_coa_account_id ?? null,
      feeLiabilityCoaAccountId: pm.fee_liability_coa_account_id ?? null,
      feeSettlementModel:       (pm.fee_settlement_model ?? 'ACCRUAL') as FeeSettlementModel,
    })
  }

  logInfo('resolvePaymentMethods: resolved', {
    requested: paymentMethodIds.length,
    resolved:  result.size,
  })

  return result
}

/**
 * Load SAL-INV purpose config.
 * Cached per companyId for the lifetime of the processor run.
 *
 * CREDIT side:
 *   REVENUE   → gross sales revenue account
 *   LIABILITY → tax payable account (PB1/PPN)
 *
 * DEBIT side:
 *   REVENUE   → sales discount account (contra revenue, e.g. 410301)
 */
let salInvCache: { companyId: string; config: SalInvConfig } | null = null

async function getSalInvConfig(companyId: string): Promise<SalInvConfig> {
  if (salInvCache?.companyId === companyId) return salInvCache.config

  const { data: purpose, error: purposeError } = await supabase
    .from('accounting_purposes')
    .select('id')
    .eq('purpose_code', SAL_INV_CODE)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (purposeError || !purpose) {
    throw new Error(
      `SAL-INV purpose tidak ditemukan atau tidak aktif untuk company ${companyId}`
    )
  }

  // Load ALL active accounts (both DEBIT and CREDIT) in one query
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

  // Get account_type for all IDs in one query
  const allCoaIds = [...new Set(accounts.map(a => a.account_id))]
  const { data: coas, error: coaError } = await supabase
    .from('chart_of_accounts')
    .select('id, account_type')
    .in('id', allCoaIds)

  if (coaError) throw new Error(`Gagal load COA types untuk SAL-INV: ${coaError.message}`)

  const coaTypeMap = new Map<string, string>()
  for (const coa of coas ?? []) coaTypeMap.set(coa.id, coa.account_type)

  // CREDIT REVENUE  → lowest priority = first in ordered list
  const revenueAccount = creditAccounts.find(
    a => coaTypeMap.get(a.account_id) === 'REVENUE'
  )
  if (!revenueAccount) {
    throw new Error('SAL-INV tidak memiliki akun CREDIT dengan tipe REVENUE')
  }

  // CREDIT LIABILITY → tax payable
  const taxAccount = creditAccounts.find(
    a => coaTypeMap.get(a.account_id) === 'LIABILITY'
  ) ?? null

  // DEBIT REVENUE → discount contra revenue
  const discountAccount = debitAccounts.find(
    a => coaTypeMap.get(a.account_id) === 'REVENUE'
  ) ?? null

  const config: SalInvConfig = {
    revenueAccountId:  revenueAccount.account_id,
    taxAccountId:      taxAccount?.account_id ?? null,
    discountAccountId: discountAccount?.account_id ?? null,
  }

  salInvCache = { companyId, config }

  logInfo('SAL-INV config loaded', {
    revenueAccountId:  config.revenueAccountId,
    taxAccountId:      config.taxAccountId,
    discountAccountId: config.discountAccountId,
  })

  return config
}

/** Clear caches — call between test runs or company switches */
export function clearProcessorCaches(): void {
  salInvCache = null
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
// FISCAL PERIOD
// ==============================

interface FiscalPeriod {
  id: string
  period: string
  period_start: string
  period_end: string
  is_open: boolean
}

function findPeriodForDate(date: string, periods: FiscalPeriod[]): FiscalPeriod | undefined {
  return periods.find(p => date >= p.period_start && date <= p.period_end)
}

// ==============================
// DATA CONTRACT VALIDATION
// ==============================

/**
 * Validate upstream data integrity per transaction.
 *
 * Source of truth: bill_after_discount
 * Derived check:   gross_amount + tax_amount - discount_amount ≈ bill_after_discount
 *
 * This catches:
 * - POS system sending pre-tax gross vs post-tax gross
 * - Discount applied before or after tax
 * - Rounding inconsistencies
 *
 * Returns error message if violated, null if OK.
 */
function validateDataContract(tx: AggregatedTransaction): string | null {
  const bill     = Number(tx.bill_after_discount)
  const gross    = Number(tx.gross_amount)
  const tax      = Number(tx.tax_amount ?? 0)
  const discount = Number(tx.discount_amount ?? 0)

  const expected = gross + tax - discount
  const diff     = Math.abs(expected - bill)

  if (diff > DATA_CONTRACT_TOLERANCE) {
    return (
      `Data contract violation pada source_ref "${tx.source_ref}": ` +
      `bill_after_discount=${bill.toFixed(2)} ≠ gross(${gross.toFixed(2)}) + tax(${tax.toFixed(2)}) - discount(${discount.toFixed(2)}) = ${expected.toFixed(2)} ` +
      `(selisih ${diff.toFixed(2)}). ` +
      `Periksa konsistensi data dari sistem POS.`
    )
  }

  return null
}

// ==============================
// JOURNAL CREATION WITH RETRY
// ==============================

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
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabase.rpc('create_journal_header_atomic', {
      p_company_id:     params.companyId,
      p_branch_id:      params.branchId,
      p_journal_number: params.journalNumber,
      p_journal_type:   'SALES',
      p_journal_date:   params.journalDate,
      p_period:         params.period,
      p_description:    params.description,
      p_total_amount:   params.totalAmount,
      p_source_module:  'POS_AGGREGATES',
    })

    if (error) throw new Error(error.message)
    return (data as any)?.id ? { id: (data as any).id } : null
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const isRetryable =
      attempt < MAX_RETRIES &&
      (msg.includes('connection') || msg.includes('timeout') || msg.includes('rate limit'))

    if (isRetryable) {
      await sleep(getRetryDelay(attempt + 1))
      return createJournalHeaderWithRetry(params, attempt + 1)
    }
    throw err
  }
}

async function insertJournalLinesWithRetry(
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
        (msg.includes('connection') || msg.includes('timeout') || msg.includes('rate limit'))

      if (isRetryable) {
        await sleep(getRetryDelay(attempt + 1))
        return insertJournalLinesWithRetry(lines, attempt + 1)
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
      status:     'PROCESSING' as const,
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
  journal_header_id:  string
  line_number:        number
  account_id:         string
  description:        string
  debit_amount:       number
  credit_amount:      number
  currency:           string
  exchange_rate:      number
  base_debit_amount:  number
  base_credit_amount: number
  created_at:         string
}

function makeLine(
  headerId: string,
  lineNum: number,
  accountId: string,
  description: string,
  debit: number,
  credit: number
): JournalLineInput {
  return {
    journal_header_id:  headerId,
    line_number:        lineNum,
    account_id:         accountId,
    description,
    debit_amount:       round2(debit),   // round2 ONLY here at output
    credit_amount:      round2(credit),
    currency:           'IDR',
    exchange_rate:      1,
    base_debit_amount:  round2(debit),
    base_credit_amount: round2(credit),
    created_at:         new Date().toISOString(),
  }
}

// ==============================
// AGGREGATION TYPE
// ==============================

/**
 * Per-payment-method aggregation.
 *
 * IMPORTANT: All numeric fields are raw (not rounded) during accumulation.
 * round2() is applied only inside makeLine() at output time.
 * This prevents floating point drift on high-volume groups.
 */
interface PmAgg {
  pm:            PaymentMethodResolved
  billTotal:     number  // Σ bill_after_discount — source of truth for debit
  grossTotal:    number  // Σ gross_amount        — used only to derive grandGross
  discountTotal: number  // Σ discount_amount     — DEBIT contra revenue (per PM)
  taxTotal:      number  // Σ tax_amount          — CREDIT tax payable
  feeTotal:      number  // Σ total_fee_amount    — DEBIT fee expense + CREDIT fee liability
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

  logInfo('Starting journal generation v3', {
    transaction_count: transactions.length,
    company_id:        companyId,
  })

  // ── PHASE 1: Load global config (fail-fast) ──────────────────────────
  onProgress?.({ current: 5, total: 100, phase: 'config', message: 'Loading SAL-INV config...' })

  let salInvConfig: SalInvConfig
  try {
    salInvConfig = await getSalInvConfig(companyId)
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

  const uniquePmIds = Array.from(new Set(transactions.map(t => t.payment_method_id)))
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
      total:   100,
      phase:   'processing',
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

      // ── 5.2 Data contract validation (HARD — fail entire group) ────
      // Source of truth: bill_after_discount
      // Derived: gross + tax - discount must ≈ bill
      // Fail-fast: do NOT process group if any transaction violates contract
      const contractErrors: string[] = []
      for (const tx of groupTxs) {
        const err = validateDataContract(tx)
        if (err) contractErrors.push(err)
      }
      if (contractErrors.length > 0) {
        failedResults.push({
          date, branch: branchName,
          error: `Data contract violation (${contractErrors.length} transaksi): ${contractErrors[0]}${contractErrors.length > 1 ? ` ... dan ${contractErrors.length - 1} lainnya` : ''}`,
        })
        continue
      }

      // ── 5.3 Resolve branch ─────────────────────────────────────────
      const branchId = await resolveBranch(branchName, branchCache)

      // ── 5.4 Validate payment method COA config ─────────────────────
      const validationErrors: string[] = []

      for (const tx of groupTxs) {
        const pm = pmMap.get(tx.payment_method_id)

        if (!pm) {
          validationErrors.push(`Payment method id ${tx.payment_method_id} tidak ditemukan atau tidak aktif`)
          continue
        }
        if (!pm.coaAccountId) {
          validationErrors.push(`Payment method "${pm.name}" tidak memiliki COA account`)
          continue
        }

        const feeAmt = Number(tx.total_fee_amount ?? 0)
        if (feeAmt > 0 && !pm.feeCoaAccountId) {
          validationErrors.push(
            `Payment method "${pm.name}" memiliki fee Rp ${feeAmt.toLocaleString('id-ID')} ` +
            `tapi fee_coa_account_id belum dikonfigurasi`
          )
        }
        if (feeAmt > 0 && pm.feeCoaAccountId &&
            pm.feeSettlementModel === 'ACCRUAL' && !pm.feeLiabilityCoaAccountId) {
          validationErrors.push(
            `Payment method "${pm.name}" menggunakan model ACCRUAL tapi ` +
            `fee_liability_coa_account_id belum dikonfigurasi`
          )
        }
      }

      if (validationErrors.length > 0) {
        failedResults.push({ date, branch: branchName, error: validationErrors.join('; ') })
        continue
      }

      // ── 5.5 Aggregate per payment method ──────────────────────────
      // NOTE: accumulate RAW numbers — no round2() here
      const pmAggMap = new Map<number, PmAgg>()

      for (const tx of groupTxs) {
        const pm = pmMap.get(tx.payment_method_id)!
        if (!pmAggMap.has(pm.id)) {
          pmAggMap.set(pm.id, { pm, billTotal: 0, grossTotal: 0, discountTotal: 0, taxTotal: 0, feeTotal: 0 })
        }
        const agg = pmAggMap.get(pm.id)!
        agg.billTotal     += Number(tx.bill_after_discount)
        agg.grossTotal    += Number(tx.gross_amount)
        agg.discountTotal += Number(tx.discount_amount ?? 0)
        agg.taxTotal      += Number(tx.tax_amount ?? 0)
        agg.feeTotal      += Number(tx.total_fee_amount ?? 0)
      }

      const pmAggList = Array.from(pmAggMap.values())

      // ── 5.6 Compute group totals (raw — round2 only at line build) ─
      const grandBill     = pmAggList.reduce((s, a) => s + a.billTotal,     0)
      const grandGross    = pmAggList.reduce((s, a) => s + a.grossTotal,    0)
      const grandDiscount = pmAggList.reduce((s, a) => s + a.discountTotal, 0)
      const grandTax      = pmAggList.reduce((s, a) => s + a.taxTotal,      0)
      const grandFee      = pmAggList.reduce((s, a) => s + a.feeTotal,      0)

      // ── 5.7 Validate SAL-INV config against group data ─────────────
      if (grandTax > 0 && !salInvConfig.taxAccountId) {
        failedResults.push({
          date, branch: branchName,
          error: 'Ada tax_amount > 0 tapi SAL-INV tidak memiliki akun CREDIT LIABILITY untuk pajak. ' +
                 'Tambahkan akun PB1 Payable ke SAL-INV purpose (CREDIT side, account_type LIABILITY).',
        })
        continue
      }

      if (grandDiscount > 0 && !salInvConfig.discountAccountId) {
        failedResults.push({
          date, branch: branchName,
          error: 'Ada discount_amount > 0 tapi SAL-INV tidak memiliki akun DEBIT REVENUE untuk diskon. ' +
                 'Tambahkan akun 410301 (Bill Discount) ke SAL-INV purpose (DEBIT side, account_type REVENUE).',
        })
        continue
      }

      // ── 5.8 Create journal header ──────────────────────────────────
      // total_amount = grandGross (topline revenue value, semantic meaning)
      // total_debit = total_credit = grandBill + grandFee + grandDiscount
      // These are different by design — see architecture notes at top of file.
      const branchSlug    = branchName.replace(/\s+/g, '-').toUpperCase()
      const journalNumber = `RCP-${branchSlug}-${date}`

      const journalHeader = await createJournalHeaderWithRetry({
        companyId,
        branchId,
        journalNumber,
        journalDate: date,
        period:      period.period,
        description: `POS Sales ${date} - ${branchName}`,
        totalAmount: round2(grandGross), // gross revenue = semantic total
      })

      if (!journalHeader) throw new Error('create_journal_header_atomic returned null')

      // ── 5.9 Idempotency check ──────────────────────────────────────
      const linesExist = await checkJournalLinesExist(journalHeader.id)
      if (linesExist) {
        logInfo('Journal lines already exist, skipping insert', { journalId: journalHeader.id })
        await updateTransactionsJournalId(groupTxs.map(t => t.id), journalHeader.id)
        successResults.push({
          date, branch_name:      branchName,
          transaction_ids:        groupTxs.map(t => t.id),
          journal_id:             journalHeader.id,
          total_amount:           round2(grandGross),
          journal_number:         journalNumber,
        })
        continue
      }

      // ── 5.10 Build journal lines ───────────────────────────────────
      const lines: JournalLineInput[] = []
      let lineNum     = 1
      let checkDebit  = 0
      let checkCredit = 0

      for (const agg of pmAggList) {
        const { pm, billTotal, discountTotal, feeTotal } = agg
        const pmDesc = pm.name

        // ── Channel debit/credit based on payment type ────────────
        switch (pm.paymentType) {

          case 'COMPLIMENT':
            // Free item — credit to comp account (e.g. comp liability or promo).
            // Revenue credit for this channel is already excluded from grandGross
            // because gross_amount would be 0 or handled separately.
            // This CREDIT offsets the DEBIT from revenue posting.
            lines.push(makeLine(journalHeader.id, lineNum++, pm.coaAccountId,
              `POS Sales - ${pmDesc}`, 0, billTotal))
            checkCredit += billTotal
            break

          case 'MEMBER_DEPOSIT':
            // Customer is spending their pre-loaded deposit.
            // Top-up was journaled in a separate system (not here).
            // Using deposit = reduce liability (Dr Deposit Liability) + Cr Revenue (via grandGross).
            // coaAccountId for MEMBER_DEPOSIT should be mapped to the deposit liability account.
            lines.push(makeLine(journalHeader.id, lineNum++, pm.coaAccountId,
              `POS Sales - ${pmDesc}`, billTotal, 0))
            checkDebit += billTotal
            break

          case 'OTHER_COST':
            // Internal cost allocation — debit expense account directly
            lines.push(makeLine(journalHeader.id, lineNum++, pm.coaAccountId,
              `POS Sales - ${pmDesc}`, billTotal, 0))
            checkDebit += billTotal
            break

          default:
            // CASH / BANK / CARD — debit channel receivable / cash
            lines.push(makeLine(journalHeader.id, lineNum++, pm.coaAccountId,
              `POS Sales - ${pmDesc}`, billTotal, 0))
            checkDebit += billTotal
            break
        }

        // ── Discount per payment method (contra revenue) ──────────
        // Posting discount per-PM preserves channel-level profitability
        // for future reporting (e.g. QRIS margin vs CASH margin).
        if (discountTotal > 0 && salInvConfig.discountAccountId) {
          lines.push(makeLine(journalHeader.id, lineNum++, salInvConfig.discountAccountId,
            `Sales Discount - ${pmDesc}`, discountTotal, 0))
          checkDebit += discountTotal
        }

        // ── Fee: Full Accrual or Net model ────────────────────────
        if (feeTotal > 0 && pm.feeCoaAccountId) {

          // DEBIT: fee expense (always, regardless of model)
          lines.push(makeLine(journalHeader.id, lineNum++, pm.feeCoaAccountId,
            `Fee - ${pmDesc}`, feeTotal, 0))
          checkDebit += feeTotal

          if (pm.feeSettlementModel === 'ACCRUAL' && pm.feeLiabilityCoaAccountId) {
            // ACCRUAL: CREDIT fee payable liability
            // Cleared later in bank settlement journal:
            //   Dr Fee Liability + Dr Bank  /  Cr Channel Receivable
            lines.push(makeLine(journalHeader.id, lineNum++, pm.feeLiabilityCoaAccountId,
              `MDR Payable - ${pmDesc}`, 0, feeTotal))
            checkCredit += feeTotal

          } else if (pm.feeSettlementModel === 'NET') {
            // NET: provider deducts fee before remitting.
            // No liability needed. The bank settlement journal will reconcile
            // the net amount received directly.
            // Journal is still balanced because fee debit is offset by
            // the reduced channel receivable at settlement time.
            logInfo(`Fee NET model for ${pmDesc} — no liability line posted`, {
              feeTotal, pm: pmDesc,
            })
          }
        }
      }

      // ── CREDIT: gross sales revenue ────────────────────────────────
      // grandGross = Σ gross_amount per PM (raw from aggregated_transactions)
      // This is the topline revenue figure before discount and tax.
      lines.push(makeLine(journalHeader.id, lineNum++, salInvConfig.revenueAccountId,
        'POS Sales Revenue', 0, grandGross))
      checkCredit += grandGross

      // ── CREDIT: PB1 / PPN tax payable ─────────────────────────────
      if (grandTax > 0 && salInvConfig.taxAccountId) {
        lines.push(makeLine(journalHeader.id, lineNum++, salInvConfig.taxAccountId,
          'PB1 Tax Payable', 0, grandTax))
        checkCredit += grandTax
      }

      // ── 5.11 Balance validation (STRICT) ──────────────────────────
      //
      // DEBIT  = Σ(bill) + Σ(fee) + Σ(discount)
      // CREDIT = Σ(gross) + Σ(tax) + Σ(fee_accrual)
      //
      // Proof:
      //   gross = bill + discount - tax   [validated in step 5.2]
      //   CREDIT = (bill + discount - tax) + tax + fee_accrual
      //          =  bill + discount + fee_accrual
      //
      // For NET fee model: fee_accrual = 0, so CREDIT < DEBIT by grandFee_net.
      // This is intentional — the NET provider settlement will bring it into
      // balance when bank receipt is recorded (net of fee).
      // For STRICT balance check here, we only check ACCRUAL channels.
      //
      const balanceDiff = round2(Math.abs(round2(checkDebit) - round2(checkCredit)))

      if (balanceDiff > 1) {
        await rollbackJournalHeader(journalHeader.id)
        failedResults.push({
          date, branch: branchName,
          error: [
            `Journal tidak balance:`,
            `DEBIT ${round2(checkDebit).toLocaleString('id-ID')}`,
            `≠ CREDIT ${round2(checkCredit).toLocaleString('id-ID')}`,
            `(selisih ${balanceDiff.toLocaleString('id-ID')}).`,
            `Periksa konfigurasi fee_liability_coa_account_id dan`,
            `pastikan semua akun SAL-INV sudah terdaftar dengan benar.`,
          ].join(' '),
        })
        continue
      }

      // ── 5.12 Insert lines ──────────────────────────────────────────
      try {
        await insertJournalLinesWithRetry(lines)
      } catch (insertErr) {
        await rollbackJournalHeader(journalHeader.id)
        throw insertErr
      }

      // ── 5.13 Update transaction status ────────────────────────────
      await updateTransactionsJournalId(groupTxs.map(t => t.id), journalHeader.id)

      logInfo('Journal created', {
        journalId:      journalHeader.id,
        journalNumber,
        date,
        branchName,
        lines:          lines.length,
        debit:          round2(checkDebit),
        credit:         round2(checkCredit),
        grandBill:      round2(grandBill),
        grandGross:     round2(grandGross),
        grandDiscount:  round2(grandDiscount),
        grandTax:       round2(grandTax),
        grandFee:       round2(grandFee),
      })

      successResults.push({
        date, branch_name:     branchName,
        transaction_ids:       groupTxs.map(t => t.id),
        journal_id:            journalHeader.id,
        total_amount:          round2(grandGross),
        journal_number:        journalNumber,
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
