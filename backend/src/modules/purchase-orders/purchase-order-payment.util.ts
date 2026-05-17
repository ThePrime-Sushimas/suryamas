import { calculateDueDate, type PaymentTermForDueDate } from '../../utils/due-date.util'
import type { CalculationType } from '../payment-terms/payment-terms.types'
import type { PaymentType } from './purchase-orders.types'

export interface PoPaymentTermSnapshot {
  payment_term_id: number | null
  term_name: string | null
  calculation_type: CalculationType | null
  days: number
  grace_period_days: number
  payment_dates: number[] | null
  payment_day_of_week: number | null
}

export interface PoPaymentDueInfo {
  label: string
  date: string | null
  text: string | null
  confirmed: boolean
  hint: string
  term_name: string | null
  calculation_type: CalculationType | null
}

const DELIVERY_PREVIEW_TYPES: CalculationType[] = [
  'from_delivery',
  'weekly',
  'fixed_date',
  'fixed_date_immediate',
  'monthly',
]

const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function formatPaymentDates(dates: number[]): string {
  return dates
    .map((d) => (d === 31 ? 'akhir bulan' : `tgl ${d}`))
    .join(' / ')
}

function termToDueDateInput(term: PoPaymentTermSnapshot): PaymentTermForDueDate {
  return {
    calculation_type: term.calculation_type ?? 'from_delivery',
    days: term.days,
    grace_period_days: term.grace_period_days ?? 0,
    payment_dates: term.payment_dates,
    payment_day_of_week: term.payment_day_of_week,
  }
}

function buildTermDescription(term: PoPaymentTermSnapshot): string {
  const type = term.calculation_type ?? 'from_delivery'
  const parts: string[] = [term.term_name ?? 'Payment term']

  switch (type) {
    case 'from_invoice':
      parts.push(`— ${term.days} hari dari tanggal invoice`)
      break
    case 'from_delivery':
      parts.push(`— ${term.days} hari dari terima barang`)
      break
    case 'weekly':
      parts.push(
        `— ${term.days} hari, bayar hari ${WEEKDAYS[term.payment_day_of_week ?? 0] ?? '?'}`
      )
      break
    case 'fixed_date':
    case 'fixed_date_immediate':
    case 'monthly':
      if (term.payment_dates?.length) {
        parts.push(`— ${term.days} hari, jadwal ${formatPaymentDates(term.payment_dates)}`)
      } else {
        parts.push(`— ${term.days} hari`)
      }
      break
    default:
      parts.push(`— ${term.days} hari`)
  }

  if (term.grace_period_days > 0) {
    parts.push(`(+ toleransi ${term.grace_period_days} hari)`)
  }

  return parts.join(' ')
}

/**
 * Build payment due display for a PO using master payment term rules (calculateDueDate).
 */
export function buildPoPaymentDueInfo(input: {
  payment_type: PaymentType
  payment_due_date: string | null
  order_date: string
  expected_delivery_date: string | null
  base_date_override?: string | null
  term: PoPaymentTermSnapshot | null
}): PoPaymentDueInfo | null {
  const termName = input.term?.term_name ?? null
  const calculationType = input.term?.calculation_type ?? null

  if (input.payment_due_date) {
    return {
      label: 'Jatuh tempo pembayaran',
      date: input.payment_due_date.slice(0, 10),
      text: null,
      confirmed: true,
      hint: termName
        ? `${buildTermDescription(input.term!)}. Tanggal final setelah barang diterima.`
        : 'Tanggal final setelah barang diterima.',
      term_name: termName,
      calculation_type: calculationType,
    }
  }

  const isCash =
    input.payment_type === 'CASH' || (input.term != null && input.term.days === 0)

  if (isCash) {
    return {
      label: 'Pembayaran',
      date: null,
      text: 'Tunai',
      confirmed: false,
      hint: termName
        ? `${buildTermDescription(input.term!)}.`
        : 'Term dari master supplier (tunai / 0 hari).',
      term_name: termName,
      calculation_type: calculationType,
    }
  }

  if (!input.term) {
    return null
  }

  const term = input.term
  const termDesc = buildTermDescription(term)

  if (term.calculation_type === 'from_invoice') {
    return {
      label: 'Jatuh tempo pembayaran',
      date: null,
      text: 'Setelah invoice',
      confirmed: false,
      hint: `${termDesc}. Tanggal dihitung saat Purchase Invoice diposting, bukan dari PO.`,
      term_name: termName,
      calculation_type: calculationType,
    }
  }

  if (!term.calculation_type || !DELIVERY_PREVIEW_TYPES.includes(term.calculation_type)) {
    return {
      label: 'Term pembayaran',
      date: null,
      text: termName,
      confirmed: false,
      hint: termDesc,
      term_name: termName,
      calculation_type: calculationType,
    }
  }

  const baseDate = (
    input.base_date_override ??
    input.expected_delivery_date ??
    input.order_date
  ).slice(0, 10)

  const baseLabel =
    input.base_date_override != null || input.expected_delivery_date != null
      ? 'estimasi kirim'
      : 'tanggal order'

  const dueDate = calculateDueDate(termToDueDateInput(term), baseDate)

  return {
    label: 'Estimasi jatuh tempo',
    date: dueDate,
    text: null,
    confirmed: false,
    hint: `${termDesc}. Perhitungan pakai ${baseLabel} (${baseDate}); final setelah GR dikonfirmasi.`,
    term_name: termName,
    calculation_type: calculationType,
  }
}
