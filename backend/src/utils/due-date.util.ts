import type { CalculationType } from '../modules/payment-terms/payment-terms.types'

export interface PaymentTermForDueDate {
  calculation_type: CalculationType
  days: number
  grace_period_days: number
  payment_dates: number[] | null
  payment_day_of_week: number | null
}

/**
 * Calculate payment due date based on payment term rules.
 *
 * @param term   - Payment term config
 * @param baseDate - Base date string (YYYY-MM-DD):
 *                   - from_delivery → received_date (GR confirmed)
 *                   - from_invoice  → invoice_date (Purchase Invoice posted)
 * @returns due date as YYYY-MM-DD string
 */
export function calculateDueDate(term: PaymentTermForDueDate, baseDate: string): string {
  const base = new Date(baseDate)
  base.setHours(0, 0, 0, 0)

  // Step 1: add days offset
  const afterDays = addDays(base, term.days)

  // Step 2: snap to payment schedule (if any)
  let dueDate: Date

  switch (term.calculation_type) {
    case 'weekly':
      dueDate = snapToWeekday(afterDays, term.payment_day_of_week ?? 0)
      break

    case 'fixed_date':
      dueDate = snapToPaymentDates(afterDays, term.payment_dates ?? [], false)
      break

    case 'fixed_date_immediate':
      dueDate = snapToPaymentDates(afterDays, term.payment_dates ?? [], true)
      break

    case 'monthly':
      // monthly = days offset + snap to payment_dates
      dueDate = term.payment_dates?.length
        ? snapToPaymentDates(afterDays, term.payment_dates, false)
        : afterDays
      break

    case 'from_delivery':
    case 'from_invoice':
    default:
      dueDate = afterDays
      break
  }

  // Step 3: add grace period (tolerance, not extending due date — but some businesses add it)
  // Per design: grace_period_days is added to due date for AP tracking
  if (term.grace_period_days > 0) {
    dueDate = addDays(dueDate, term.grace_period_days)
  }

  return toDateString(dueDate)
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Snap to nearest payment_day_of_week (0=Sun, 1=Mon, ..., 6=Sat) on or after date.
 * If date is already that weekday → return date itself.
 */
function snapToWeekday(date: Date, targetDay: number): Date {
  const current = date.getDay()
  const diff = (targetDay - current + 7) % 7
  return addDays(date, diff)
}

/**
 * Snap to nearest date in payment_dates on or after the given date.
 * payment_dates = [15, 31] means 15th and last day of month.
 * 31 = last day of month (handles months with < 31 days).
 *
 * @param immediate - if true (fixed_date_immediate): candidate on the same day as date counts.
 *                    if false (fixed_date): must be strictly AFTER date (next occurrence).
 */
function snapToPaymentDates(date: Date, paymentDates: number[], immediate: boolean): Date {
  if (paymentDates.length === 0) return date

  const sorted = [...paymentDates].sort((a, b) => a - b)

  // Try current month first, then up to 2 months ahead
  for (let monthOffset = 0; monthOffset <= 2; monthOffset++) {
    const year = date.getFullYear()
    const month = date.getMonth() + monthOffset

    for (const pd of sorted) {
      const candidate = resolvePaymentDate(year, month, pd)
      // immediate: same day counts; non-immediate: must be strictly after
      const isValid = immediate ? candidate >= date : candidate > date
      if (isValid) return candidate
    }
  }

  // Fallback: last payment date of 2 months ahead
  const fallbackMonth = date.getMonth() + 2
  return resolvePaymentDate(date.getFullYear(), fallbackMonth, sorted[sorted.length - 1])
}

/**
 * Resolve a payment date in a given month/year.
 * pd=31 → last day of that month.
 */
function resolvePaymentDate(year: number, month: number, pd: number): Date {
  // Normalize month overflow
  const normalizedDate = new Date(year, month, 1)
  const actualYear = normalizedDate.getFullYear()
  const actualMonth = normalizedDate.getMonth()

  const lastDay = new Date(actualYear, actualMonth + 1, 0).getDate()
  const day = Math.min(pd, lastDay)
  return new Date(actualYear, actualMonth, day)
}

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
