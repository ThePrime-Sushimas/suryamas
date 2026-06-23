/**
 * Amortization Scheduler Service
 *
 * Automatically executes overdue amortization entries on a cron schedule.
 * Reuses `generalInvoiceTemplateService.executeAmortizationEntry` for actual execution.
 *
 * Schedules:
 *   - Primary: Every 28th of the month at 00:30 (SCHEDULED trigger)
 *   - Catch-up: Every day at 01:00 (CATCHUP trigger) — handles missed primary runs
 *
 * Idempotency:
 *   - Partial unique index on (run_month) WHERE status IN ('SUCCESS','PARTIAL','RUNNING')
 *   - Stale RUNNING rows (>2h) are recovered to FAILED before new run attempt
 */

import cron, { type ScheduledTask } from 'node-cron'
import { pool } from '../config/db'
import { logInfo, logError, logWarn } from '../config/logger'
import { generalInvoiceTemplateService } from '../modules/general-invoices/general-invoices.service'
import { BusinessRuleError } from '../utils/errors.base'

// ─── Constants ───────────────────────────────────────────────────

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001'
const MAX_RETRIES = 3
const RETRY_DELAYS_MS = [1_000, 5_000, 15_000] // 1s, 5s, 15s

/** A RUNNING row older than this is considered stale/crashed and will be recovered. */
const STALE_RUN_THRESHOLD_MS = 2 * 60 * 60 * 1_000 // 2 hours

type RunTrigger = 'SCHEDULED' | 'CATCHUP'
type RunStatus = 'RUNNING' | 'SUCCESS' | 'PARTIAL' | 'FAILED'

interface PendingEntry {
  entry_id: string
  amortization_id: string
  period_number: number
  period_date: string
}

interface ErrorEntry {
  entry_id: string
  amortization_id: string
  period_number: number
  error: string
}

// ─── Repository (scheduler-specific queries) ─────────────────────

async function getAllActiveBranchIds(): Promise<string[]> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM branches WHERE status = 'active'`,
  )
  return rows.map((r) => r.id)
}

async function findPendingEntries(): Promise<PendingEntry[]> {
  const { rows } = await pool.query<PendingEntry>(
    `SELECT ae.id AS entry_id,
            ae.amortization_id,
            ae.period_number,
            ae.period_date
     FROM general_invoice_amortization_entries ae
     JOIN general_invoice_amortizations a ON a.id = ae.amortization_id
     WHERE ae.journal_id IS NULL
       AND ae.period_date <= CURRENT_DATE
       AND a.status = 'ACTIVE'
     ORDER BY ae.period_date ASC, ae.period_number ASC`,
  )
  return rows
}

/**
 * Check if this month already has a completed run (SUCCESS or PARTIAL).
 * FAILED rows do NOT count — they indicate a previous crash that was recovered.
 */
async function hasCompletedRunForMonth(runMonth: string): Promise<boolean> {
  const { rows } = await pool.query<{ id: string }>(
    `SELECT id FROM amortization_scheduler_runs
     WHERE run_month = $1 AND status IN ('SUCCESS', 'PARTIAL')
     LIMIT 1`,
    [runMonth],
  )
  return rows.length > 0
}

/**
 * Recover stale RUNNING rows for a given month.
 * A RUNNING row is considered stale if started_at is older than STALE_RUN_THRESHOLD_MS.
 * Sets status to FAILED so the partial unique index releases the slot for a new run.
 */
async function recoverStaleRuns(runMonth: string): Promise<number> {
  const thresholdDate = new Date(Date.now() - STALE_RUN_THRESHOLD_MS).toISOString()
  const { rowCount } = await pool.query(
    `UPDATE amortization_scheduler_runs
     SET status = 'FAILED',
         finished_at = now(),
         updated_at = now(),
         error_summary = $1::jsonb
     WHERE run_month = $2
       AND status = 'RUNNING'
       AND started_at < $3`,
    [
      JSON.stringify([{ entry_id: '', amortization_id: '', period_number: 0, error: 'Run timed out or crashed — recovered by next run' }]),
      runMonth,
      thresholdDate,
    ],
  )
  return rowCount ?? 0
}

/**
 * Insert a new run record. Uses the partial unique index as guard:
 * only one non-FAILED row per run_month is allowed.
 * Returns the row id, or empty string if insert conflicted (another run in progress).
 */
async function insertRunRecord(runMonth: string, trigger: RunTrigger): Promise<string> {
  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO amortization_scheduler_runs (run_month, trigger, status, started_at, updated_at)
       VALUES ($1, $2, 'RUNNING', now(), now())
       RETURNING id`,
      [runMonth, trigger],
    )
    return rows[0]?.id ?? ''
  } catch (err: unknown) {
    // PostgreSQL 23505 = unique_violation — another RUNNING/SUCCESS/PARTIAL row exists
    // for this run_month (partial unique index). Safe to skip without crashing.
    const pgError = err as { code?: string }
    if (pgError.code === '23505') {
      return ''
    }
    throw err
  }
}

async function updateRunRecord(
  id: string,
  status: RunStatus,
  totalEntries: number,
  successCount: number,
  failedCount: number,
  errorSummary: ErrorEntry[] | null,
  hasDataAnomaly: boolean,
): Promise<void> {
  await pool.query(
    `UPDATE amortization_scheduler_runs
     SET status = $1, total_entries = $2, success_count = $3, failed_count = $4,
         error_summary = $5, has_data_anomaly = $6, finished_at = now(), updated_at = now()
     WHERE id = $7`,
    [status, totalEntries, successCount, failedCount, errorSummary ? JSON.stringify(errorSummary) : null, hasDataAnomaly, id],
  )
}

async function getLastRun(): Promise<Record<string, unknown> | null> {
  const { rows } = await pool.query(
    `SELECT * FROM amortization_scheduler_runs
     ORDER BY started_at DESC
     LIMIT 1`,
  )
  return rows[0] ?? null
}

// ─── Error classification ────────────────────────────────────────

type EntryResult =
  | { outcome: 'success' }
  | { outcome: 'idempotent' }
  | { outcome: 'anomaly'; error: string }
  | { outcome: 'failed'; error: string }

/**
 * Classify the error from executeAmortizationEntry.
 *
 * Classification uses instanceof BusinessRuleError for the primary non-retryable
 * check, then message substrings for finer categorization within that class.
 *
 * NOTE: The message strings matched below are defined in
 * GeneralInvoiceTemplateService.executeAmortizationEntry (general-invoices.service.ts).
 * If those messages change due to refactoring, this classification may silently
 * degrade (treating business errors as retryable). Keep these in sync, or add
 * integration tests that assert the exact messages thrown.
 */
function classifyError(err: unknown): { retryable: boolean; isAnomaly: boolean; isIdempotent: boolean } {
  if (err instanceof BusinessRuleError) {
    const msg = err.message

    // Idempotent: entry was already executed (by manual click or concurrent scheduler)
    if (msg.includes('already executed') || msg.includes('idempotency guard')) {
      return { retryable: false, isAnomaly: false, isIdempotent: true }
    }

    // Data anomaly: orphaned journal detected — needs manual investigation
    if (msg.includes('orphaned journal')) {
      return { retryable: false, isAnomaly: true, isIdempotent: false }
    }

    // Other BusinessRuleError: data/logic error, retry won't help
    return { retryable: false, isAnomaly: false, isIdempotent: false }
  }

  // Non-BusinessRuleError (DB timeout, connection error, journal service failure) → retryable
  return { retryable: true, isAnomaly: false, isIdempotent: false }
}

// ─── Retry helper ────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function executeWithRetry(
  entry: PendingEntry,
  branchIds: string[],
): Promise<EntryResult> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await generalInvoiceTemplateService.executeAmortizationEntry(
        entry.amortization_id,
        entry.period_number,
        entry.period_date,
        branchIds,
        SYSTEM_USER_ID,
        true, // canViewConfidential — scheduler can execute all amortizations
      )
      return { outcome: 'success' }
    } catch (err: unknown) {
      const { retryable, isAnomaly, isIdempotent } = classifyError(err)
      const message = err instanceof Error ? err.message : String(err)

      if (isIdempotent) {
        logInfo('Amortization entry already executed, skipping', {
          entry_id: entry.entry_id,
          period_number: entry.period_number,
        })
        return { outcome: 'idempotent' }
      }

      if (isAnomaly) {
        logError('DATA ANOMALY — orphaned journal detected, needs manual review', {
          entry_id: entry.entry_id,
          amortization_id: entry.amortization_id,
          period_number: entry.period_number,
          error: message,
        })
        return { outcome: 'anomaly', error: message.slice(0, 200) }
      }

      if (!retryable) {
        logWarn('Amortization entry execution failed (non-retryable)', {
          entry_id: entry.entry_id,
          attempt: attempt + 1,
          error: message,
        })
        return { outcome: 'failed', error: message.slice(0, 200) }
      }

      // Retryable error — wait before next attempt
      if (attempt < MAX_RETRIES - 1) {
        logWarn('Amortization entry execution failed, retrying', {
          entry_id: entry.entry_id,
          attempt: attempt + 1,
          delay_ms: RETRY_DELAYS_MS[attempt],
          error: message,
        })
        await sleep(RETRY_DELAYS_MS[attempt])
      } else {
        logError('Amortization entry execution failed after max retries', {
          entry_id: entry.entry_id,
          period_number: entry.period_number,
          amortization_id: entry.amortization_id,
          error: message,
        })
        return { outcome: 'failed', error: message.slice(0, 200) }
      }
    }
  }
  return { outcome: 'failed', error: 'Max retries exceeded' }
}

// ─── Main execution logic ────────────────────────────────────────

async function runAmortizationBatch(trigger: RunTrigger): Promise<void> {
  const now = new Date()
  const day = now.getDate()
  const runMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Catch-up logic: skip if before 28th or already completed this month
  if (trigger === 'CATCHUP') {
    if (day < 28) {
      logInfo('Amortization catch-up skipped: before 28th', { day, run_month: runMonth })
      return
    }
    const alreadyCompleted = await hasCompletedRunForMonth(runMonth)
    if (alreadyCompleted) {
      logInfo('Amortization catch-up skipped: already completed this month', { run_month: runMonth })
      return
    }
  }

  // Fix 1: Recover stale RUNNING rows before attempting new run
  const recoveredCount = await recoverStaleRuns(runMonth)
  if (recoveredCount > 0) {
    logWarn('Amortization scheduler: recovered stale RUNNING run(s)', {
      run_month: runMonth,
      recovered_count: recoveredCount,
    })
  }

  // Try to insert run record (partial unique index prevents double-run)
  const runId = await insertRunRecord(runMonth, trigger)
  if (!runId) {
    logInfo('Amortization run skipped: concurrent run already in progress or completed', { run_month: runMonth, trigger })
    return
  }

  logInfo('Amortization scheduler run started', { run_id: runId, run_month: runMonth, trigger })

  try {
    // Get all active branch IDs (bypass per-user branch access)
    const branchIds = await getAllActiveBranchIds()
    if (branchIds.length === 0) {
      logWarn('Amortization scheduler: no active branches found')
      await updateRunRecord(runId, 'SUCCESS', 0, 0, 0, null, false)
      return
    }

    // Find all pending entries (overdue)
    const entries = await findPendingEntries()

    if (entries.length === 0) {
      logInfo('Amortization scheduler: no pending entries to execute', { run_month: runMonth })
      await updateRunRecord(runId, 'SUCCESS', 0, 0, 0, null, false)
      return
    }

    logInfo('Amortization scheduler: processing entries', { total: entries.length, trigger })

    let successCount = 0
    let failedCount = 0
    let hasDataAnomaly = false
    const errors: ErrorEntry[] = []

    // Execute entries sequentially (each creates a journal + posts it)
    for (const entry of entries) {
      const result = await executeWithRetry(entry, branchIds)

      switch (result.outcome) {
        case 'success':
        case 'idempotent':
          successCount++
          break
        case 'anomaly':
          failedCount++
          hasDataAnomaly = true
          errors.push({
            entry_id: entry.entry_id,
            amortization_id: entry.amortization_id,
            period_number: entry.period_number,
            error: result.error,
          })
          break
        case 'failed':
          failedCount++
          errors.push({
            entry_id: entry.entry_id,
            amortization_id: entry.amortization_id,
            period_number: entry.period_number,
            error: result.error,
          })
          break
      }
    }

    // Determine final status
    let status: RunStatus
    if (failedCount === 0) {
      status = 'SUCCESS'
    } else if (successCount > 0) {
      status = 'PARTIAL'
    } else {
      status = 'FAILED'
    }

    await updateRunRecord(runId, status, entries.length, successCount, failedCount, errors.length > 0 ? errors : null, hasDataAnomaly)

    logInfo('Amortization scheduler run completed', {
      run_id: runId,
      run_month: runMonth,
      status,
      total: entries.length,
      success: successCount,
      failed: failedCount,
      has_data_anomaly: hasDataAnomaly,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    logError('Amortization scheduler run crashed', { run_id: runId, error: message })
    await updateRunRecord(
      runId,
      'FAILED',
      0,
      0,
      0,
      [{ entry_id: '', amortization_id: '', period_number: 0, error: message.slice(0, 200) }],
      false,
    )
  }
}

// ─── Cron registration ───────────────────────────────────────────

let scheduledTask: ScheduledTask | null = null
let catchupTask: ScheduledTask | null = null

export function startAmortizationScheduler(): void {
  const enabled = process.env.AMORTIZATION_SCHEDULER_ENABLED !== 'false'
  if (!enabled) {
    logInfo('Amortization scheduler disabled via AMORTIZATION_SCHEDULER_ENABLED=false')
    return
  }

  // Primary: 28th of every month at 00:30
  scheduledTask = cron.schedule('30 0 28 * *', () => {
    runAmortizationBatch('SCHEDULED').catch((err) => {
      logError('Amortization scheduled run unhandled error', { error: err })
    })
  })

  // Catch-up: every day at 01:00
  catchupTask = cron.schedule('0 1 * * *', () => {
    runAmortizationBatch('CATCHUP').catch((err) => {
      logError('Amortization catch-up run unhandled error', { error: err })
    })
  })

  logInfo('Amortization scheduler started', {
    primary_schedule: '30 0 28 * *',
    catchup_schedule: '0 1 * * *',
  })
}

export function stopAmortizationScheduler(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
  }
  if (catchupTask) {
    catchupTask.stop()
    catchupTask = null
  }
  logInfo('Amortization scheduler stopped')
}

// ─── Public API (for endpoint) ───────────────────────────────────

export async function getLastSchedulerRun(): Promise<Record<string, unknown> | null> {
  return getLastRun()
}
