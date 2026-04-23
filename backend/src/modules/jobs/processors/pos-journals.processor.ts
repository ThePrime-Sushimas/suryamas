/**
 * POS Journal Generation Processor — v3 (Extended Fields)
 *
 * Architecture:
 * - DEBIT per channel        → payment_methods.coa_account_id
 * - DEBIT fee expense        → payment_methods.fee_coa_account_id
 * - DEBIT sales discount     → SAL-INV field_mapping: bill_discount (410301)
 * - DEBIT promo discount     → SAL-INV field_mapping: promotion_discount (410304)
 * - DEBIT voucher discount   → SAL-INV field_mapping: voucher_discount (410305)
 * - CREDIT revenue (gross)   → SAL-INV field_mapping: gross_revenue (410101)
 *     (rounding absorbed here — not journaled separately)
 * - CREDIT tax (PB1)         → SAL-INV field_mapping: tax_payable (210206)
 * - CREDIT service charge    → SAL-INV field_mapping: service_charge_payable (210209)
 * - CREDIT other VAT         → SAL-INV field_mapping: other_vat_payable (210210)
 * - CREDIT order fee revenue → SAL-INV field_mapping: order_fee_revenue (410202)
 * - CREDIT delivery revenue  → SAL-INV field_mapping: delivery_revenue (410203)
 * - CREDIT fee liability     → payment_methods.fee_liability_coa_account_id
 *
 * Note: rounding is absorbed in gross revenue (not journaled separately)
 *       because bill_after_discount = grand_total POS which already includes rounding.
 *
 * Balance formula:
 *   DEBIT  = bill + fee + discount + promoDiscount + voucherDiscount
 *   CREDIT = gross + tax + fee_liability + SC + otherVat + orderFee + delivery
 *
 * Special payment_type handling:
 *   COMPLIMENT     → CREDIT to coa_account_id (reduces revenue)
 *   MEMBER_DEPOSIT → DEBIT to coa_account_id (reduces liability)
 *   ASSET types    → DEBIT to coa_account_id
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
  revenueAccountId: string              // gross_revenue          → 410101
  taxAccountId: string | null           // tax_payable            → 210206
  discountAccountId: string | null      // bill_discount          → 410301
  serviceChargeAccountId: string | null // service_charge_payable → 210209
  otherVatAccountId: string | null      // other_vat_payable      → 210210
  orderFeeAccountId: string | null      // order_fee_revenue      → 410202
  deliveryAccountId: string | null      // delivery_revenue       → 410203
  promoDiscountAccountId: string | null // promotion_discount     → 410304
  voucherDiscountAccountId: string | null // voucher_discount     → 410305
  roundingAccountId: string | null      // rounding_expense       → 610801
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
    .select('account_id, side, priority, field_mapping')
    .eq('purpose_id', purpose.id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('priority', { ascending: true })

  if (accountsError) throw new Error(`Gagal load SAL-INV accounts: ${accountsError.message}`)
  if (!accounts || accounts.length === 0) throw new Error('SAL-INV tidak memiliki akun yang aktif')

  // Build field_mapping lookup
  const byField = new Map<string, string>()
  for (const a of accounts) {
    if (a.field_mapping) byField.set(a.field_mapping, a.account_id)
  }

  // If field_mapping populated, use it directly
  if (byField.size > 0) {
    const revenueAccountId = byField.get('gross_revenue')
    if (!revenueAccountId) throw new Error('SAL-INV tidak memiliki field_mapping gross_revenue')

    const config: SalInvConfig = {
      revenueAccountId,
      taxAccountId:             byField.get('tax_payable')            ?? null,
      discountAccountId:        byField.get('bill_discount')          ?? null,
      serviceChargeAccountId:   byField.get('service_charge_payable') ?? null,
      otherVatAccountId:        byField.get('other_vat_payable')      ?? null,
      orderFeeAccountId:        byField.get('order_fee_revenue')      ?? null,
      deliveryAccountId:        byField.get('delivery_revenue')       ?? null,
      promoDiscountAccountId:   byField.get('promotion_discount')     ?? null,
      voucherDiscountAccountId: byField.get('voucher_discount')       ?? null,
      roundingAccountId:        byField.get('rounding_expense')       ?? null,
    }
    logInfo('SAL-INV config loaded (field_mapping)', config)
    return config
  }

  // Fallback: legacy logic (no field_mapping yet)
  const creditAccounts = accounts.filter(a => a.side === 'CREDIT')
  const debitAccounts  = accounts.filter(a => a.side === 'DEBIT')
  if (creditAccounts.length === 0) throw new Error('SAL-INV tidak memiliki akun CREDIT yang aktif')

  const allCoaIds = [...new Set(accounts.map(a => a.account_id))]
  const { data: coas, error: coaError } = await supabase
    .from('chart_of_accounts').select('id, account_type').in('id', allCoaIds)
  if (coaError) throw new Error(`Gagal load COA types: ${coaError.message}`)

  const coaTypeMap = new Map<string, string>()
  for (const coa of coas ?? []) coaTypeMap.set(coa.id, coa.account_type)

  const revenueAccount  = creditAccounts.find(a => coaTypeMap.get(a.account_id) === 'REVENUE')
  if (!revenueAccount) throw new Error('SAL-INV tidak memiliki akun CREDIT REVENUE')

  const config: SalInvConfig = {
    revenueAccountId:         revenueAccount.account_id,
    taxAccountId:             creditAccounts.find(a => coaTypeMap.get(a.account_id) === 'LIABILITY')?.account_id ?? null,
    discountAccountId:        debitAccounts.find(a => coaTypeMap.get(a.account_id) === 'REVENUE')?.account_id ?? null,
    serviceChargeAccountId:   null,
    otherVatAccountId:        null,
    orderFeeAccountId:        null,
    deliveryAccountId:        null,
    promoDiscountAccountId:   null,
    voucherDiscountAccountId: null,
    roundingAccountId:        null,
  }
  logInfo('SAL-INV config loaded (legacy fallback)', config)
  return config
}

// ==============================
// BRANCH LOOKUP WITH CACHE
// ==============================

async function resolveBranch(
  branchName: string,
  companyId: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  const key = `${companyId}|${branchName}`
  if (cache.has(key)) return cache.get(key)!

  const { data, error } = await supabase
    .from('branches')
    .select('id')
    .ilike('branch_name', branchName.trim())
    .eq('company_id', companyId)
    .eq('status', 'active')
    .maybeSingle()

  const id = error || !data ? null : data.id
  cache.set(key, id)
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

async function rollbackJournalHeader(journalHeaderId: string): Promise<void> {
  try {
    await supabase.from('journal_headers').delete().eq('id', journalHeaderId)
    logInfo('Rolled back journal header', { journalHeaderId })
  } catch (err) {
    logError('Rollback failed', { journalHeaderId, err })
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
      const branchId = await resolveBranch(branchName, companyId, branchCache)
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
        billTotal:            number
        grossTotal:           number
        discountTotal:        number
        taxTotal:             number
        feeTotal:             number
        serviceChargeTotal:   number
        otherVatTotal:        number
        orderFeeTotal:        number
        deliveryTotal:        number
        promoDiscountTotal:   number
        voucherDiscountTotal: number
        roundingTotal:        number
      }

      const pmAggMap = new Map<number, PmAgg>()

      for (const tx of groupTxs) {
        const pm = pmMap.get(tx.payment_method_id as number)!
        if (!pmAggMap.has(pm.id)) {
          pmAggMap.set(pm.id, {
            pm,
            billTotal: 0, grossTotal: 0, discountTotal: 0, taxTotal: 0, feeTotal: 0,
            serviceChargeTotal: 0, otherVatTotal: 0, orderFeeTotal: 0,
            deliveryTotal: 0, promoDiscountTotal: 0, voucherDiscountTotal: 0, roundingTotal: 0,
          })
        }
        const agg = pmAggMap.get(pm.id)!
        agg.billTotal            = round2(agg.billTotal            + Number(tx.bill_after_discount))
        agg.grossTotal           = round2(agg.grossTotal           + Number(tx.gross_amount))
        agg.discountTotal        = round2(agg.discountTotal        + Number(tx.discount_amount ?? 0))
        agg.taxTotal             = round2(agg.taxTotal             + Number(tx.tax_amount ?? 0))
        agg.feeTotal             = round2(agg.feeTotal             + Number(tx.total_fee_amount ?? 0))
        agg.serviceChargeTotal   = round2(agg.serviceChargeTotal   + Number(tx.service_charge_amount ?? 0))
        agg.otherVatTotal        = round2(agg.otherVatTotal        + Number(tx.other_vat_amount ?? 0))
        agg.orderFeeTotal        = round2(agg.orderFeeTotal        + Number(tx.order_fee ?? 0))
        agg.deliveryTotal        = round2(agg.deliveryTotal        + Number(tx.delivery_cost ?? 0))
        agg.promoDiscountTotal   = round2(agg.promoDiscountTotal   + Number(tx.promotion_discount_amount ?? 0))
        agg.voucherDiscountTotal = round2(agg.voucherDiscountTotal + Number(tx.voucher_discount_amount ?? 0))
        agg.roundingTotal        = round2(agg.roundingTotal        + Number(tx.rounding_amount ?? 0))
      }

      const pmAggList = Array.from(pmAggMap.values())

      // ── 5.5 Compute group totals ───────────────────────────────────
      const grandBill            = round2(pmAggList.reduce((s, a) => s + a.billTotal,            0))
      const grandGross           = round2(pmAggList.reduce((s, a) => s + a.grossTotal,           0))
      const grandDiscount        = round2(pmAggList.reduce((s, a) => s + a.discountTotal,        0))
      const grandTax             = round2(pmAggList.reduce((s, a) => s + a.taxTotal,             0))
      const grandFee             = round2(pmAggList.reduce((s, a) => s + a.feeTotal,             0))
      const grandServiceCharge   = round2(pmAggList.reduce((s, a) => s + a.serviceChargeTotal,   0))
      const grandOtherVat        = round2(pmAggList.reduce((s, a) => s + a.otherVatTotal,        0))
      const grandOrderFee        = round2(pmAggList.reduce((s, a) => s + a.orderFeeTotal,        0))
      const grandDelivery        = round2(pmAggList.reduce((s, a) => s + a.deliveryTotal,        0))
      const grandPromoDiscount   = round2(pmAggList.reduce((s, a) => s + a.promoDiscountTotal,   0))
      const grandVoucherDiscount = round2(pmAggList.reduce((s, a) => s + a.voucherDiscountTotal, 0))
      const grandRounding        = round2(pmAggList.reduce((s, a) => s + a.roundingTotal,        0))

      // ── 5.6 Validate config for non-zero amounts ────────────────────
      const configChecks: Array<[number, string | null, string]> = [
        [grandTax,             salInvConfig.taxAccountId,             'tax_payable (210206)'],
        [grandDiscount,        salInvConfig.discountAccountId,        'bill_discount (410301)'],
        [grandServiceCharge,   salInvConfig.serviceChargeAccountId,   'service_charge_payable (210209)'],
        [grandOtherVat,        salInvConfig.otherVatAccountId,        'other_vat_payable (210210)'],
        [grandOrderFee,        salInvConfig.orderFeeAccountId,        'order_fee_revenue (410202)'],
        [grandDelivery,        salInvConfig.deliveryAccountId,        'delivery_revenue (410203)'],
        [grandPromoDiscount,   salInvConfig.promoDiscountAccountId,   'promotion_discount (410304)'],
        [grandVoucherDiscount, salInvConfig.voucherDiscountAccountId, 'voucher_discount (410305)'],
      ]
      // Rounding: no configCheck needed — absorbed in revenue, not journaled separately

      const missingConfigs = configChecks
        .filter(([amount, accountId]) => amount > 0 && !accountId)
        .map(([, , label]) => label)

      if (missingConfigs.length > 0) {
        failedResults.push({
          date, branch: branchName,
          error: `SAL-INV field_mapping belum dikonfigurasi untuk: ${missingConfigs.join(', ')}. Jalankan migration_coa_field_mapping.sql.`,
        })
        continue
      }

      // ── 5.7 Create journal header ──────────────────────────────────
      // Balance formula (Simple — rounding terserap di revenue):
      //   DEBIT  = bill + fee + discount + promoDiscount + voucherDiscount
      //   CREDIT = gross + tax + fee_liability + SC + otherVat + orderFee + delivery
      //
      // Rounding sudah termasuk di bill_after_discount (= grand_total POS)
      // dan terserap di gross revenue line. Tidak dijurnal terpisah.
      const grandTotalDebit = round2(
        grandBill + grandFee + grandDiscount +
        grandPromoDiscount + grandVoucherDiscount
      )

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
      if (grandPromoDiscount > 0 && salInvConfig.promoDiscountAccountId) {
        pushLine(salInvConfig.promoDiscountAccountId, 'Promotion Discount', grandPromoDiscount, 0)
      }
      if (grandVoucherDiscount > 0 && salInvConfig.voucherDiscountAccountId) {
        pushLine(salInvConfig.voucherDiscountAccountId, 'Voucher Discount', grandVoucherDiscount, 0)
      }

      // Rounding: skip — already absorbed in bill_after_discount / gross revenue
      if (Math.abs(grandRounding) > 0) {
        logInfo('Rounding absorbed in revenue (not journaled separately)', {
          date, branchName, grandRounding,
        })
      }

      // ── CREDIT: gross sales revenue ────────────────────────────────
      pushLine(salInvConfig.revenueAccountId, 'POS Sales Revenue', 0, grandGross)

      // ── CREDIT: PB1 / PPN tax payable ─────────────────────────────
      if (grandTax > 0 && salInvConfig.taxAccountId) {
        pushLine(salInvConfig.taxAccountId, 'PB1 Tax Payable', 0, grandTax)
      }

      // ── CREDIT: service charge payable ─────────────────────────────
      if (grandServiceCharge > 0 && salInvConfig.serviceChargeAccountId) {
        pushLine(salInvConfig.serviceChargeAccountId, 'Service Charge Payable', 0, grandServiceCharge)
      }

      // ── CREDIT: other VAT payable ──────────────────────────────────
      if (grandOtherVat > 0 && salInvConfig.otherVatAccountId) {
        pushLine(salInvConfig.otherVatAccountId, 'Other VAT Payable', 0, grandOtherVat)
      }

      // ── CREDIT: order fee revenue ──────────────────────────────────
      if (grandOrderFee > 0 && salInvConfig.orderFeeAccountId) {
        pushLine(salInvConfig.orderFeeAccountId, 'Order Fee Revenue', 0, grandOrderFee)
      }

      // ── CREDIT: delivery revenue ───────────────────────────────────
      if (grandDelivery > 0 && salInvConfig.deliveryAccountId) {
        pushLine(salInvConfig.deliveryAccountId, 'Delivery Revenue', 0, grandDelivery)
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

      // Auto-correct small rounding differences (≤ Rp 100)
      // These arise from floating point drift when summing many transactions
      if (balanceDiff > 0 && balanceDiff <= 100) {
        const roundingAccountId = salInvConfig.roundingAccountId || salInvConfig.revenueAccountId
        if (checkDebit > checkCredit) {
          pushLine(roundingAccountId, 'Rounding Adjustment', 0, balanceDiff)
        } else {
          pushLine(roundingAccountId, 'Rounding Adjustment', balanceDiff, 0)
        }
        logWarn('Auto-corrected rounding difference', {
          date, branchName, balanceDiff,
          originalDebit: round2(checkDebit - (checkDebit > checkCredit ? 0 : balanceDiff)),
          originalCredit: round2(checkCredit - (checkCredit > checkDebit ? 0 : balanceDiff)),
        })
      }

      // Re-check after rounding adjustment
      const finalDebit = round2(lines.reduce((s, l) => s + l.debit_amount, 0))
      const finalCredit = round2(lines.reduce((s, l) => s + l.credit_amount, 0))
      const finalDiff = round2(Math.abs(finalDebit - finalCredit))

      if (finalDiff > 1) {
        await rollbackJournalHeader(journalHeader.id)
        failedResults.push({
          date, branch: branchName,
          error: [
            `Journal tidak balance:`,
            `DEBIT ${finalDebit.toLocaleString('id-ID')} ≠ CREDIT ${finalCredit.toLocaleString('id-ID')}`,
            `(selisih ${finalDiff.toLocaleString('id-ID')}).`,
            `Pastikan fee_liability_coa_account_id terkonfigurasi di semua payment methods yang memiliki fee`,
            `dan akun discount terdaftar di SAL-INV purpose.`,
          ].join(' '),
        })
        continue
      }

      // ── 5.11 Insert lines + link transactions (atomic) ────────────
      try {
        const linesPayload = lines.map(({ journal_header_id: _, created_at: __, ...rest }) => rest)

        const { error: rpcError } = await supabase.rpc('post_journal_lines_atomic', {
          p_journal_header_id: journalHeader.id,
          p_lines: linesPayload,
          p_bank_statement_ids: [],
          p_aggregate_ids: groupTxs.map(t => t.id),
          p_set_processing: true,
        })

        if (rpcError) throw new Error(rpcError.message)
      } catch (postErr) {
        await rollbackJournalHeader(journalHeader.id)
        throw postErr
      }

      logInfo('Journal created', {
        journalId:      journalHeader.id,
        journalNumber,
        date,
        branchName,
        lines:          lines.length,
        debit:          checkDebit,
        credit:         checkCredit,
        grandBill, grandGross, grandDiscount, grandTax, grandFee,
        grandServiceCharge, grandOtherVat, grandOrderFee, grandDelivery,
        grandPromoDiscount, grandVoucherDiscount, grandRounding,
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