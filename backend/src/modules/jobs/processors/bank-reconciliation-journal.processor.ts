/**
 * Bank Reconciliation Journal Processor
 *
 * Architecture:
 * - Source: bank_statements (reconciled, via bank_reconciliation)
 * - Purpose: BANK-REC
 *
 * Journal entry per reconciled bank statement (credit side):
 *   DEBIT:  bank_accounts.coa_account_id  (110201/110202/etc — actual bank account)
 *   CREDIT: BANK-REC purpose CREDIT account (110301 — Cash sales receivable)
 *
 * Grouping strategy: per bank_account_id + journal_date
 * (one journal per bank account per day, same pattern as POS processor)
 *
 * BLOCK conditions (journal not created):
 *   1. bank_accounts.coa_account_id IS NULL
 *   2. BANK-REC purpose not found or not active for company
 *   3. BANK-REC has no CREDIT account
 *   4. bank_statement already has journal_id (idempotency)
 *   5. Journal balance mismatch
 *   6. Fiscal period not found or closed
 *
 * Debit-only statements (bank expenses/fees) are handled separately:
 *   Phase 2 — for now, debit-only rows are skipped with a warning
 */

import { supabase } from '@/config/supabase'
import { logInfo, logError, logWarn } from '@/config/logger'

// ============================================================
// CONFIGURATION
// ============================================================
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 1000
const BANK_REC_PURPOSE_CODE = 'BANK-REC'
const BANK_FEE_PURPOSE_CODE = 'BANK-FEE'

// ============================================================
// TYPES
// ============================================================

export interface BankRecJournalResult {
  bank_account_id: number
  bank_account_number: string
  journal_date: string
  journal_id: string
  journal_number: string
  statement_ids: string[]
  total_credit: number
  total_debit: number
}

export interface GenerateBankRecJournalsResult {
  success: BankRecJournalResult[]
  failed: Array<{ bank_account_id: number; journal_date: string; error: string }>
  total_statements: number
  total_journals: number
  duration_ms: number
}

export interface ProgressCallback {
  (progress: { current: number; total: number; phase: string; message: string }): void
}

interface BankAccountResolved {
  id: number
  account_number: string
  account_name: string
  coa_account_id: string
  company_id: string
}

interface BankRecConfig {
  creditAccountId: string // 110301 Cash sales receivable
}

interface BankFeeConfig {
  debitAccountId: string // 610104 Bank Charges
}

interface FiscalPeriod {
  id: string
  period: string
  period_start: string
  period_end: string
  is_open: boolean
}

interface BankStatement {
  id: string
  bank_account_id: number
  company_id: string
  transaction_date: string
  description: string | null
  credit_amount: number | null
  debit_amount: number | null
  is_reconciled: boolean
  is_pending: boolean
  journal_id: string | null
  payment_method_id: number | null
  reconciliation_id: string | null
}

interface JournalLine {
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

// ============================================================
// UTILITIES
// ============================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function getRetryDelay(attempt: number): number {
  return RETRY_DELAY_MS * Math.pow(2, attempt - 1)
}

// ============================================================
// LOOKUP FUNCTIONS
// ============================================================

/**
 * Load BANK-REC purpose config for a company
 * Returns the CREDIT account_id (Cash sales receivable)
 * DEBIT account comes from bank_accounts.coa_account_id at runtime
 */
async function loadBankRecConfig(companyId: string): Promise<BankRecConfig> {
  const { data: purpose, error: purposeError } = await supabase
    .from('accounting_purposes')
    .select('id')
    .eq('purpose_code', BANK_REC_PURPOSE_CODE)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .maybeSingle()

  if (purposeError || !purpose) {
    throw new Error(
      `BANK-REC purpose tidak ditemukan atau tidak aktif untuk company ${companyId}. ` +
      `Pastikan purpose BANK-REC sudah dibuat via SQL migration.`
    )
  }

  const { data: accounts, error: accountsError } = await supabase
    .from('accounting_purpose_accounts')
    .select('account_id, side, priority')
    .eq('purpose_id', purpose.id)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .order('priority', { ascending: true })

  if (accountsError) throw new Error(`Gagal load BANK-REC accounts: ${accountsError.message}`)
  if (!accounts || accounts.length === 0) {
    throw new Error('BANK-REC tidak memiliki akun yang aktif. Tambahkan account mapping via SQL.')
  }

  const creditAccount = accounts.find(a => a.side === 'CREDIT')
  if (!creditAccount) {
    throw new Error('BANK-REC tidak memiliki akun CREDIT. Tambahkan 110301 sebagai CREDIT account.')
  }

  const config: BankRecConfig = {
    creditAccountId: creditAccount.account_id as string,
  }

  logInfo('BANK-REC config loaded', config)
  return config
}

/**
 * Load BANK-FEE purpose config for a company
 * Returns the DEBIT account_id (610104 Bank Charges)
 * CREDIT account comes from bank_accounts.coa_account_id at runtime
 */
async function loadBankFeeConfig(companyId: string): Promise<BankFeeConfig | null> {
  const { data: purpose } = await supabase
    .from('accounting_purposes')
    .select('id')
    .eq('purpose_code', BANK_FEE_PURPOSE_CODE)
    .eq('company_id', companyId)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .maybeSingle()

  if (!purpose) return null

  const { data: accounts } = await supabase
    .from('accounting_purpose_accounts')
    .select('account_id, side')
    .eq('purpose_id', purpose.id)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .eq('side', 'DEBIT')
    .order('priority', { ascending: true })
    .limit(1)

  if (!accounts || accounts.length === 0) return null

  const config: BankFeeConfig = {
    debitAccountId: accounts[0].account_id as string,
  }

  logInfo('BANK-FEE config loaded', config)
  return config
}

/**
 * Resolve bank accounts with their COA account_id
 */
async function resolveBankAccounts(
  bankAccountIds: number[],
  companyId: string
): Promise<Map<number, BankAccountResolved>> {
  const result = new Map<number, BankAccountResolved>()
  if (bankAccountIds.length === 0) return result

  const { data, error } = await supabase
    .from('bank_accounts')
    .select('id, account_number, account_name, coa_account_id, owner_id')
    .in('id', bankAccountIds)
    .eq('owner_id', companyId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (error || !data) {
    logError('resolveBankAccounts failed', { error })
    return result
  }

  for (const ba of data) {
    result.set(ba.id as number, {
      id: ba.id as number,
      account_number: ba.account_number as string,
      account_name: ba.account_name as string,
      coa_account_id: (ba.coa_account_id ?? '') as string,
      company_id: (ba.owner_id ?? '') as string,
    })
  }

  return result
}

// ============================================================
// JOURNAL HEADER WITH RETRY
// ============================================================

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
): Promise<{ id: string; journalNumber: string; isExisting: boolean } | null> {
  try {
    const { data, error } = await supabase.rpc('create_journal_header_atomic', {
      p_company_id:     params.companyId,
      p_branch_id:      params.branchId,
      p_journal_number: params.journalNumber,
      p_journal_type:   'GENERAL',
      p_journal_date:   params.journalDate,
      p_period:         params.period,
      p_description:    params.description,
      p_total_amount:   params.totalAmount,
      p_source_module:  'BANK_RECONCILIATION',
    })

    if (error) throw new Error(error.message)

    const row = Array.isArray(data) ? data[0] : data
    if (!row?.id) return null

    return {
      id: row.id as string,
      journalNumber: row.journal_number as string,
      isExisting: (row.is_existing ?? false) as boolean,
    }
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

async function rollbackJournalHeader(journalHeaderId: string): Promise<void> {
  try {
    await supabase.from('journal_headers').delete().eq('id', journalHeaderId)
    logInfo('Rolled back journal header', { journalHeaderId })
  } catch (err) {
    logError('Rollback failed', { journalHeaderId, err })
  }
}

// ============================================================
// MAIN PROCESSOR
// ============================================================

export async function generateBankRecJournals(
  bankStatementIds: string[],
  companyId: string,
  onProgress?: ProgressCallback,
  branchId?: string
): Promise<GenerateBankRecJournalsResult> {
  const startTime = Date.now()

  if (bankStatementIds.length === 0) {
    return { success: [], failed: [], total_statements: 0, total_journals: 0, duration_ms: 0 }
  }

  logInfo('Starting bank reconciliation journal generation', {
    statement_count: bankStatementIds.length,
    company_id: companyId,
  })

  // ── PHASE 1: Load BANK-REC config ────────────────────────────────────
  onProgress?.({ current: 5, total: 100, phase: 'config', message: 'Loading config...' })

  let bankRecConfig: BankRecConfig
  try {
    bankRecConfig = await loadBankRecConfig(companyId)
  } catch (err) {
    throw new Error(
      `Konfigurasi BANK-REC tidak lengkap: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  const bankFeeConfig = await loadBankFeeConfig(companyId)
  if (bankFeeConfig) {
    logInfo('BANK-FEE config available, debit statements will be processed')
  } else {
    logWarn('BANK-FEE config not found, debit-only statements will be skipped')
  }

  // ── PHASE 2: Load fiscal periods ─────────────────────────────────────
  onProgress?.({ current: 10, total: 100, phase: 'fiscal', message: 'Loading fiscal periods...' })

  const { data: fiscalPeriods, error: periodError } = await supabase
    .from('fiscal_periods')
    .select('id, period, period_start, period_end, is_open')
    .eq('company_id', companyId)
    .is('deleted_at', null)

  if (periodError) throw new Error(`Gagal load fiscal periods: ${periodError.message}`)

  const periods = (fiscalPeriods ?? []) as FiscalPeriod[]

  // ── PHASE 3: Fetch bank statements ───────────────────────────────────
  onProgress?.({ current: 15, total: 100, phase: 'fetch', message: 'Fetching bank statements...' })

  const { data: statementsRaw, error: stmtError } = await supabase
    .from('bank_statements')
    .select(`
      id,
      bank_account_id,
      company_id,
      transaction_date,
      description,
      credit_amount,
      debit_amount,
      is_reconciled,
      is_pending,
      journal_id,
      payment_method_id,
      reconciliation_id
    `)
    .in('id', bankStatementIds)
    .eq('company_id', companyId)
    .is('deleted_at', null)

  if (stmtError) throw new Error(`Gagal fetch bank statements: ${stmtError.message}`)
  if (!statementsRaw || statementsRaw.length === 0) {
    return { success: [], failed: [], total_statements: 0, total_journals: 0, duration_ms: 0 }
  }

  const statements = statementsRaw as BankStatement[]

  // ── PHASE 4: Filter valid statements ─────────────────────────────────
  onProgress?.({ current: 20, total: 100, phase: 'validate', message: 'Validating statements...' })

  const eligible = statements.filter(s => {
    if (s.journal_id) {
      logWarn('Statement already has journal_id, skipping', { id: s.id, journal_id: s.journal_id })
      return false
    }
    if (!s.is_reconciled) {
      logWarn('Statement not reconciled, skipping', { id: s.id })
      return false
    }
    if (s.is_pending) {
      logWarn('Statement is pending, skipping', { id: s.id })
      return false
    }
    // Skip debit-only if BANK-FEE config not available
    if ((s.credit_amount ?? 0) === 0 && (s.debit_amount ?? 0) > 0 && !bankFeeConfig) {
      logWarn('Debit-only statement skipped (no BANK-FEE config)', { id: s.id })
      return false
    }
    if ((s.credit_amount ?? 0) === 0 && (s.debit_amount ?? 0) === 0) {
      logWarn('Zero-amount statement skipped', { id: s.id })
      return false
    }
    return true
  })

  logInfo('Eligible statements after filter', {
    total: statements.length,
    eligible: eligible.length,
    skipped: statements.length - eligible.length,
  })

  // ── PHASE 5: Group by bank_account_id + transaction_date ─────────────
  onProgress?.({ current: 25, total: 100, phase: 'grouping', message: 'Grouping statements...' })

  const groupMap = new Map<string, BankStatement[]>()
  for (const stmt of eligible) {
    const key = `${stmt.bank_account_id}|${stmt.transaction_date}`
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(stmt)
  }

  const groups = Array.from(groupMap.entries())
  logInfo('Statement groups created', { total_groups: groups.length })

  // ── PHASE 6: Resolve bank accounts ───────────────────────────────────
  onProgress?.({ current: 30, total: 100, phase: 'lookup', message: 'Resolving bank accounts...' })

  const uniqueBankIds = [...new Set(eligible.map(s => s.bank_account_id))]
  const bankAccountMap = await resolveBankAccounts(uniqueBankIds, companyId)

  // ── PHASE 7: Process each group ───────────────────────────────────────
  onProgress?.({ current: 35, total: 100, phase: 'processing', message: 'Generating journals...' })

  const successResults: BankRecJournalResult[] = []
  const failedResults: Array<{ bank_account_id: number; journal_date: string; error: string }> = []

  for (let gi = 0; gi < groups.length; gi++) {
    const [key, groupStmts] = groups[gi]
    const [bankAccountIdStr, journalDate] = key.split('|')
    const bankAccountId = Number(bankAccountIdStr)

    const progress = 35 + Math.min(55, Math.floor((gi / groups.length) * 55))
    onProgress?.({
      current: progress,
      total: 100,
      phase: 'processing',
      message: `Processing bank account ${bankAccountId} - ${journalDate} (${gi + 1}/${groups.length})`,
    })

    try {
      // ── 7.1 Resolve bank account ─────────────────────────────────
      const bankAccount = bankAccountMap.get(bankAccountId)
      if (!bankAccount) {
        failedResults.push({
          bank_account_id: bankAccountId,
          journal_date:    journalDate,
          error:           `Bank account ${bankAccountId} tidak ditemukan atau tidak aktif`,
        })
        continue
      }

      if (!bankAccount.coa_account_id) {
        failedResults.push({
          bank_account_id: bankAccountId,
          journal_date:    journalDate,
          error:
            `Bank account ${bankAccount.account_number} belum memiliki coa_account_id. ` +
            `Update bank_accounts.coa_account_id terlebih dahulu.`,
        })
        continue
      }

      // ── 7.2 Validate fiscal period ───────────────────────────────
      const period = periods.find(
        p => journalDate >= p.period_start && journalDate <= p.period_end
      )

      if (!period) {
        failedResults.push({
          bank_account_id: bankAccountId,
          journal_date:    journalDate,
          error:           `Tidak ada periode fiskal untuk tanggal ${journalDate}`,
        })
        continue
      }

      if (!period.is_open) {
        failedResults.push({
          bank_account_id: bankAccountId,
          journal_date:    journalDate,
          error:           `Periode ${period.period} sudah ditutup`,
        })
        continue
      }

      // ── 7.3 Compute totals ───────────────────────────────────────
      const totalCredit = round2(groupStmts.reduce((s, r) => s + Number(r.credit_amount ?? 0), 0))
      const totalDebit  = round2(groupStmts.reduce((s, r) => s + Number(r.debit_amount ?? 0), 0))
      const netAmount   = round2(totalCredit - totalDebit)
      const isDebitOnly = totalCredit === 0 && totalDebit > 0

      if (netAmount === 0) {
        logWarn('Net amount = 0 for group, skipping', { bankAccountId, journalDate })
        failedResults.push({
          bank_account_id: bankAccountId,
          journal_date:    journalDate,
          error:           `Net amount = 0. Tidak ada yang perlu dijurnal.`,
        })
        continue
      }

      if (!isDebitOnly && netAmount < 0) {
        logWarn('Mixed group with negative net, skipping', { bankAccountId, journalDate, netAmount })
        failedResults.push({
          bank_account_id: bankAccountId,
          journal_date:    journalDate,
          error:           `Net amount ${netAmount} < 0 pada group campuran. Periksa data.`,
        })
        continue
      }

      if (isDebitOnly && !bankFeeConfig) {
        failedResults.push({
          bank_account_id: bankAccountId,
          journal_date:    journalDate,
          error:           'Debit-only statement tapi BANK-FEE config tidak tersedia',
        })
        continue
      }


      const journalAmount = isDebitOnly ? totalDebit : netAmount

      // -- 7.4 Create journal header (with DRAFT cleanup) ---------------
      const acctSuffix    = bankAccount.account_number.slice(-4)
      const journalPrefix = isDebitOnly ? 'BANK-FEE' : 'BANK-REC'
      const journalNumber = `${journalPrefix}-${acctSuffix}-${journalDate}`

      // Check existing active journal (not soft-deleted)
      const { data: existingJournal } = await supabase
        .from('journal_headers')
        .select('id, status')
        .eq('company_id', companyId)
        .eq('journal_number', journalNumber)
        .is('deleted_at', null)
        .maybeSingle()

      if (existingJournal) {
        if (existingJournal.status === 'POSTED') {
          failedResults.push({
            bank_account_id: bankAccountId,
            journal_date:    journalDate,
            error:           `Jurnal ${journalNumber} sudah POSTED. Lakukan reversal untuk koreksi.`,
          })
          continue
        }

        // Active DRAFT -> clean up lines & references, then hard delete to recreate
        await supabase.from('journal_lines').delete().eq('journal_header_id', existingJournal.id)
        await supabase.from('bank_statements')
          .update({ journal_id: null, updated_at: new Date().toISOString() })
          .eq('journal_id', existingJournal.id)
        await supabase.from('journal_headers').delete().eq('id', existingJournal.id)

        logInfo('Cleaned up existing DRAFT journal for re-generation', {
          journalId: existingJournal.id, journalNumber,
        })
      }

      const journalHeader = await createJournalHeaderWithRetry({
        companyId,
        branchId: null,
        journalNumber,
        journalDate,
        period:      period.period,
        description: isDebitOnly
          ? `Bank Fee ${bankAccount.account_name} (${bankAccount.account_number}) - ${journalDate}`
          : `Bank Reconciliation ${bankAccount.account_name} (${bankAccount.account_number}) - ${journalDate}`,
        totalAmount: journalAmount,
      })

      if (!journalHeader) throw new Error('create_journal_header_atomic returned null')

      // ── 7.5b Re-validate reconciliation status ───────────────────
      const revalidateIds = groupStmts.map(s => s.id)
      const { data: revalidated } = await supabase
        .from('bank_statements')
        .select('id, is_reconciled')
        .in('id', revalidateIds)
        .eq('is_reconciled', true)
        .is('deleted_at', null)

      const stillReconciledIds = new Set((revalidated || []).map((r: any) => String(r.id)))
      const invalidated = groupStmts.filter(s => !stillReconciledIds.has(String(s.id)))

      if (invalidated.length > 0) {
        logWarn('Some statements were unreconciled since fetch, skipping group', {
          bank_account_id: bankAccountId,
          journal_date: journalDate,
          invalidated_ids: invalidated.map(s => s.id),
        })
        failedResults.push({
          bank_account_id: bankAccountId,
          journal_date: journalDate,
          error: `${invalidated.length} statement tidak lagi reconciled saat journal akan dibuat. Silakan generate ulang.`,
        })
        await rollbackJournalHeader(journalHeader.id)
        continue
      }

      // ── 7.6 Build journal lines ──────────────────────────────────
      const now = new Date().toISOString()
      let lines: JournalLine[]


      if (isDebitOnly) {
        // BANK-FEE: DEBIT Bank Charges, CREDIT Bank Account
        lines = [
          {
            journal_header_id:  journalHeader.id,
            line_number:        1,
            account_id:         bankFeeConfig!.debitAccountId,
            description:        `Bank fee - ${bankAccount.account_name} (${bankAccount.account_number})`,
            debit_amount:       journalAmount,
            credit_amount:      0,
            currency:           'IDR',
            exchange_rate:      1,
            base_debit_amount:  journalAmount,
            base_credit_amount: 0,
            created_at:         now,
          },
          {
            journal_header_id:  journalHeader.id,
            line_number:        2,
            account_id:         bankAccount.coa_account_id,
            description:        `Bank charge deducted - ${bankAccount.account_number}`,
            debit_amount:       0,
            credit_amount:      journalAmount,
            currency:           'IDR',
            exchange_rate:      1,
            base_debit_amount:  0,
            base_credit_amount: journalAmount,
            created_at:         now,
          },
        ]
      } else {
        // BANK-REC: Full accrual journal from reconciled bank statements
        // DEBIT  Bank Account         = total nett (credit_amount from bank)
        // DEBIT  MDR Payable per ch    = actual_fee from aggregated_transactions
        // CREDIT Receivable per ch     = bill_after_discount (clear full piutang)
        // DEBIT/CREDIT Fee Discrepancy = fee_discrepancy (if any)

        const creditStmts = groupStmts.filter(s => (s.credit_amount ?? 0) > 0)

        // Fetch linked aggregated_transactions for fee data
        const reconIds = creditStmts.map(s => s.reconciliation_id).filter(Boolean) as string[]

        const { data: linkedAggs, error: aggError } = await supabase
          .from('aggregated_transactions')
          .select('id, bill_after_discount, total_fee_amount, actual_fee_amount, fee_discrepancy, payment_method_id')
          .in('id', reconIds.length > 0 ? reconIds : ['__none__'])

        // Build reconciliation_id → aggregate map
        const aggMap: Record<string, any> = {}
        for (const agg of linkedAggs || []) aggMap[agg.id] = agg

        // Fetch payment methods with COA accounts
        const allPmIds = [...new Set([
          ...creditStmts.map(s => s.payment_method_id),
          ...(linkedAggs || []).map(a => a.payment_method_id),
        ].filter(Boolean))] as number[]

        let pmMap: Record<number, { coa_account_id: string; fee_liability_coa_account_id: string | null; name: string }> = {}
        if (allPmIds.length > 0) {
          const { data: pms } = await supabase
            .from('payment_methods')
            .select('id, name, coa_account_id, fee_liability_coa_account_id')
            .in('id', allPmIds)
          for (const pm of pms || []) {
            pmMap[pm.id] = {
              coa_account_id: pm.coa_account_id || '',
              fee_liability_coa_account_id: (pm as any).fee_liability_coa_account_id || null,
              name: pm.name,
            }
          }
        }

        // Aggregate per COA account
        interface ChannelAgg {
          receivableAmount: number  // bill_after_discount (credit receivable)
          actualFee: number         // actual_fee_amount (debit MDR payable)
          feeDiscrepancy: number    // fee_discrepancy
          name: string
          feeCoaId: string | null
        }
        const channelMap: Record<string, ChannelAgg> = {}

        for (const stmt of creditStmts) {
          const agg = stmt.reconciliation_id ? aggMap[stmt.reconciliation_id] : null
          const pmId = agg?.payment_method_id || stmt.payment_method_id
          const pm = pmId ? pmMap[pmId] : null
          const coaId = pm?.coa_account_id || bankRecConfig.creditAccountId
          const name = pm?.name || 'Unmatched'

          if (!channelMap[coaId]) {
            channelMap[coaId] = {
              receivableAmount: 0,
              actualFee: 0,
              feeDiscrepancy: 0,
              name,
              feeCoaId: pm?.fee_liability_coa_account_id || null,
            }
          }

          const ch = channelMap[coaId]
          if (agg) {
            ch.receivableAmount = round2(ch.receivableAmount + Number(agg.bill_after_discount || 0))
            ch.actualFee = round2(ch.actualFee + Number(agg.actual_fee_amount || 0))
            ch.feeDiscrepancy = round2(ch.feeDiscrepancy + Number(agg.fee_discrepancy || 0))
          } else {
            // No linked aggregate — fallback to credit_amount
            ch.receivableAmount = round2(ch.receivableAmount + Number(stmt.credit_amount ?? 0))
          }
        }

        // Build lines
        let lineNum = 1
        lines = []

        // Line 1: DEBIT Bank Account (total nett = sum of credit_amount)
        lines.push({
          journal_header_id: journalHeader.id,
          line_number: lineNum++,
          account_id: bankAccount.coa_account_id,
          description: `Bank receipt - ${bankAccount.account_name} (${bankAccount.account_number})`,
          debit_amount: journalAmount,
          credit_amount: 0,
          currency: 'IDR', exchange_rate: 1,
          base_debit_amount: journalAmount, base_credit_amount: 0,
          created_at: now,
        })

        // Per channel: DEBIT MDR Payable + CREDIT Receivable
        for (const [coaId, ch] of Object.entries(channelMap)) {
          // DEBIT MDR Payable (actual fee from bank)
          if (ch.actualFee > 0 && ch.feeCoaId) {
            lines.push({
              journal_header_id: journalHeader.id,
              line_number: lineNum++,
              account_id: ch.feeCoaId,
              description: `MDR settled - ${ch.name}`,
              debit_amount: ch.actualFee,
              credit_amount: 0,
              currency: 'IDR', exchange_rate: 1,
              base_debit_amount: ch.actualFee, base_credit_amount: 0,
              created_at: now,
            })
          }

          // CREDIT Receivable (full bill_after_discount)
          if (ch.receivableAmount > 0) {
            lines.push({
              journal_header_id: journalHeader.id,
              line_number: lineNum++,
              account_id: coaId,
              description: `Receivable cleared - ${ch.name}`,
              debit_amount: 0,
              credit_amount: ch.receivableAmount,
              currency: 'IDR', exchange_rate: 1,
              base_debit_amount: 0, base_credit_amount: ch.receivableAmount,
              created_at: now,
            })
          }
        }

        // Fee discrepancy adjustment (expected_fee - actual_fee)
        // When bank charges less than expected (promo): discrepancy < 0, need DEBIT to balance
        // When bank charges more than expected: discrepancy > 0, need CREDIT to balance
        // Recalculate totals for header
        const recalcDebit = round2(lines.reduce((s, l) => s + l.debit_amount, 0))
        const recalcCredit = round2(lines.reduce((s, l) => s + l.credit_amount, 0))

        // Update header with correct totals
        await supabase
          .from('journal_headers')
          .update({ total_debit: recalcDebit, total_credit: recalcCredit, updated_at: now })
          .eq('id', journalHeader.id)
      }


      // -- 7.7 Balance validation (with debug) --
      const totalLineDebit  = round2(lines.reduce((s, l) => s + l.debit_amount, 0))
      const totalLineCredit = round2(lines.reduce((s, l) => s + l.credit_amount, 0))
      const balanceDiff     = round2(Math.abs(totalLineDebit - totalLineCredit))

      if (balanceDiff > 0.01) {
        logError('BANK-REC: balance mismatch, rolling back', {
          journalId: journalHeader.id, totalLineDebit, totalLineCredit, balanceDiff,
        })
        await rollbackJournalHeader(journalHeader.id)
        failedResults.push({
          bank_account_id: bankAccountId,
          journal_date:    journalDate,
          error:           `Journal balance mismatch: debit=${totalLineDebit}, credit=${totalLineCredit}, diff=${balanceDiff}`,
        })
        continue
      }

      try {
        const { error: rpcError } = await supabase.rpc('post_journal_lines_atomic', {
          p_journal_header_id: journalHeader.id,
          p_lines: lines.map(({ journal_header_id: _, created_at: __, ...rest }) => rest),
          p_bank_statement_ids: groupStmts.map(s => Number(s.id)),
          p_aggregate_ids: [],
          p_set_processing: false,
        })

        if (rpcError) throw new Error(rpcError.message)
      } catch (postErr) {
        await rollbackJournalHeader(journalHeader.id)
        failedResults.push({
          bank_account_id: bankAccountId,
          journal_date: journalDate,
          error: `Gagal insert lines: ${postErr instanceof Error ? postErr.message : 'Unknown error'}`,
        })
        continue
      }

      logInfo('Bank reconciliation journal created', {
        journalId:     journalHeader.id,
        journalNumber: journalHeader.journalNumber,
        bankAccountId,
        journalDate,
        statements:    groupStmts.length,
        totalCredit,
        totalDebit,
        netAmount,
      })

      successResults.push({
        bank_account_id:     bankAccountId,
        bank_account_number: bankAccount.account_number,
        journal_date:        journalDate,
        journal_id:          journalHeader.id,
        journal_number:      journalHeader.journalNumber,
        statement_ids:       groupStmts.map(s => s.id),
        total_credit:        totalCredit,
        total_debit:         totalDebit,
      })
    } catch (err) {
      logError('Failed to generate journal for bank statement group', {
        bankAccountId,
        journalDate,
        err,
      })
      failedResults.push({
        bank_account_id: bankAccountId,
        journal_date:    journalDate,
        error:           err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  // ── PHASE 8: Done ─────────────────────────────────────────────────────
  const duration = Date.now() - startTime

  onProgress?.({
    current: 100,
    total:   100,
    phase:   'complete',
    message: `Selesai: ${successResults.length} jurnal dibuat, ${failedResults.length} gagal`,
  })

  logInfo('Bank reconciliation journal generation complete', {
    statements:       statements.length,
    eligible:         eligible.length,
    journals_created: successResults.length,
    journals_failed:  failedResults.length,
    duration_ms:      duration,
  })

  return {
    success:          successResults,
    failed:           failedResults,
    total_statements: eligible.length,
    total_journals:   successResults.length,
    duration_ms:      duration,
  }
}
