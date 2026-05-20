import { calculateDueDate, type PaymentTermForDueDate } from '../../utils/due-date.util'
import type { CalculationType } from '../payment-terms/payment-terms.types'
import type { PoPaymentTermSnapshot } from '../purchase-orders/purchase-order-payment.util'
import type { PurchaseInvoiceStatus } from './purchase-invoices.types'

export interface PiPaymentDueInfo {
  label: string
  date: string | null
  text: string | null
  confirmed: boolean
  hint: string
  term_name: string | null
  calculation_type: CalculationType | null
  base_source: 'invoice' | 'gr' | null
  base_date: string | null
}

const DELIVERY_BASE_TYPES: CalculationType[] = [
  'from_delivery',
  'weekly',
  'fixed_date',
  'fixed_date_immediate',
  'monthly',
]

const SCHEDULE_BASE_TYPES: CalculationType[] = [
  'weekly',
  'fixed_date',
  'fixed_date_immediate',
  'monthly',
]

/** days=0 on schedule terms is normal; only from_invoice/from_delivery + 0 days = tunai/COD. */
export function isImmediateCashTerm(term: PoPaymentTermSnapshot): boolean {
  if (SCHEDULE_BASE_TYPES.includes(term.calculation_type ?? 'from_delivery')) {
    return false
  }
  return term.days === 0
}

const WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

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
      parts.push(`— ${term.days} hari dari terima barang (GR)`)
      break
    case 'weekly':
      parts.push(
        `— ${term.days} hari, bayar hari ${WEEKDAYS[term.payment_day_of_week ?? 0] ?? '?'}`,
      )
      break
    case 'fixed_date':
    case 'fixed_date_immediate':
    case 'monthly':
      if (term.payment_dates?.length) {
        parts.push(
          `— ${term.days} hari, jadwal ${term.payment_dates.map((d) => (d === 31 ? 'akhir bulan' : `tgl ${d}`)).join(' / ')}`,
        )
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
 * Estimated / final due date for purchase_invoices.due_date column.
 * Draft: set at PI create (from GR) so finance sees deadline before POST.
 */
export function computePurchaseInvoiceDueDate(input: {
  invoice_date: string
  gr_received_date: string | null
  po_payment_due_date: string | null
  term: PoPaymentTermSnapshot | null
}): string | null {
  if (!input.term || isImmediateCashTerm(input.term)) return null

  const termInput = termToDueDateInput(input.term)

  if (input.po_payment_due_date) {
    return input.po_payment_due_date.slice(0, 10)
  }

  if (input.term.calculation_type === 'from_invoice') {
    return calculateDueDate(termInput, input.invoice_date.slice(0, 10))
  }

  const grDate = input.gr_received_date?.slice(0, 10)
  if (grDate) {
    return calculateDueDate(termInput, grDate)
  }

  return calculateDueDate(termInput, input.invoice_date.slice(0, 10))
}

/**
 * Payment due display for Purchase Invoice (list + detail).
 * Uses purchase_invoices.due_date when set; otherwise PO payment_due_date (from GR) or preview.
 */
export function buildPiPaymentDueInfo(input: {
  status: PurchaseInvoiceStatus
  invoice_date: string
  due_date: string | null
  po_payment_due_date: string | null
  gr_received_date: string | null
  term: PoPaymentTermSnapshot | null
}): PiPaymentDueInfo | null {
  const termName = input.term?.term_name ?? null
  const calculationType = input.term?.calculation_type ?? null
  const termDesc = input.term ? buildTermDescription(input.term) : null

  if (input.due_date) {
    const fromInvoice = calculationType === 'from_invoice'
    return {
      label: 'Jatuh tempo pembayaran',
      date: input.due_date.slice(0, 10),
      text: null,
      confirmed: input.status === 'POSTED',
      hint: fromInvoice
        ? `${termDesc ?? 'Term pembayaran'}. Dihitung dari tanggal invoice (${input.invoice_date.slice(0, 10)}).`
        : `${termDesc ?? 'Term pembayaran'}.`,
      term_name: termName,
      calculation_type: calculationType,
      base_source: fromInvoice ? 'invoice' : 'gr',
      base_date: fromInvoice ? input.invoice_date.slice(0, 10) : input.gr_received_date?.slice(0, 10) ?? null,
    }
  }

  if (input.term != null && isImmediateCashTerm(input.term)) {
    return {
      label: 'Pembayaran',
      date: null,
      text: 'Tunai / COD',
      confirmed: false,
      hint: termDesc ?? 'Term supplier: pembayaran langsung (0 hari).',
      term_name: termName,
      calculation_type: calculationType,
      base_source: null,
      base_date: null,
    }
  }

  if (!input.term) {
    return null
  }

  const term = input.term

  if (term.calculation_type === 'from_invoice') {
    const base = input.invoice_date.slice(0, 10)
    const preview = calculateDueDate(termToDueDateInput(term), base)
    const isPosted = input.status === 'POSTED'
    return {
      label: isPosted ? 'Jatuh tempo pembayaran' : 'Estimasi jatuh tempo',
      date: preview,
      text: null,
      confirmed: isPosted,
      hint: `${termDesc}. ${isPosted ? 'Final' : 'Estimasi'} dari tanggal invoice (${base}); pastikan invoice di-post untuk mengunci tanggal.`,
      term_name: termName,
      calculation_type: calculationType,
      base_source: 'invoice',
      base_date: base,
    }
  }

  if (input.po_payment_due_date) {
    const isPosted = input.status === 'POSTED'
    return {
      label: isPosted ? 'Jatuh tempo pembayaran' : 'Estimasi jatuh tempo',
      date: input.po_payment_due_date.slice(0, 10),
      text: null,
      // Tanggal PO final setelah GR confirm; kartu hijau hanya setelah invoice di-post (alur AP).
      confirmed: isPosted,
      hint: `${termDesc ?? 'Term pembayaran'}. Dihitung saat GR dikonfirmasi (tanggal terima barang)${isPosted ? '.' : '; tampilan final setelah invoice di-post.'}`,
      term_name: termName,
      calculation_type: calculationType,
      base_source: 'gr',
      base_date: input.gr_received_date?.slice(0, 10) ?? null,
    }
  }

  if (
    term.calculation_type &&
    DELIVERY_BASE_TYPES.includes(term.calculation_type) &&
    input.gr_received_date
  ) {
    const base = input.gr_received_date.slice(0, 10)
    const preview = calculateDueDate(termToDueDateInput(term), base)
    return {
      label: 'Estimasi jatuh tempo',
      date: preview,
      text: null,
      confirmed: false,
      hint: `${termDesc}. Estimasi dari tanggal GR (${base}); final setelah GR dikonfirmasi (update PO).`,
      term_name: termName,
      calculation_type: calculationType,
      base_source: 'gr',
      base_date: base,
    }
  }

  return {
    label: 'Jatuh tempo pembayaran',
    date: null,
    text: 'Setelah GR dikonfirmasi',
    confirmed: false,
    hint: `${termDesc ?? 'Term pembayaran'}. Hubungkan GR yang sudah dikonfirmasi untuk melihat tanggal.`,
    term_name: termName,
    calculation_type: calculationType,
    base_source: 'gr',
    base_date: null,
  }
}
