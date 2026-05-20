import { calculateDueDate, type PaymentTermForDueDate } from '../../utils/due-date.util'
import type { CalculationType } from '../payment-terms/payment-terms.types'
import { PAYMENT_DUE_AT_GR_CONFIRM_TYPES, PAYMENT_TERM_SCHEDULE_TYPES } from '../payment-terms/payment-terms.constants'
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

const DELIVERY_BASE_TYPES: readonly CalculationType[] = PAYMENT_DUE_AT_GR_CONFIRM_TYPES

const SCHEDULE_BASE_TYPES: readonly CalculationType[] = PAYMENT_TERM_SCHEDULE_TYPES

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
    case 'monthly_immediate':
      if (term.payment_dates?.length) {
        parts.push(
          `— ${term.days} hari, jadwal ${term.payment_dates.map((d) => (d === 31 || d === 999 ? 'akhir bulan' : `tgl ${d}`)).join(' / ')}`,
        )
        if (type === 'monthly_immediate') {
          parts.push('(slot pada hari yang sama dengan tanggal acuan dihitung)')
        }
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
 * Anchor is always `invoice_date` on the PI:
 * - Auto-draft from GR: invoice_date defaults to GR received_date → same as “mulai dari barang datang”.
 * - Finance may change Tanggal Invoice on the form → save updates invoice_date and due_date recalculates from it.
 */
export function computePurchaseInvoiceDueDate(input: {
  invoice_date: string
  term: PoPaymentTermSnapshot | null
}): string | null {
  if (!input.term || isImmediateCashTerm(input.term)) return null
  const base = input.invoice_date.slice(0, 10)
  return calculateDueDate(termToDueDateInput(input.term), base)
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
    const inv = input.invoice_date.slice(0, 10)
    const gr = input.gr_received_date?.slice(0, 10) ?? null
    const anchorNote =
      gr && inv !== gr
        ? ` Acuan perhitungan: tanggal invoice di PI (${inv}); berbeda dari tanggal terima barang (${gr}).`
        : gr
          ? ` Acuan perhitungan: tanggal invoice di PI (${inv}); default dari tanggal terima barang (GR).`
          : ` Acuan perhitungan: tanggal invoice di PI (${inv}).`
    return {
      label: 'Jatuh tempo pembayaran',
      date: input.due_date.slice(0, 10),
      text: null,
      confirmed: input.status === 'POSTED',
      hint: `${termDesc ?? 'Term pembayaran'}.${anchorNote}`,
      term_name: termName,
      calculation_type: calculationType,
      base_source: 'invoice',
      base_date: inv,
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
    DELIVERY_BASE_TYPES.includes(term.calculation_type)
  ) {
    const base = input.invoice_date.slice(0, 10)
    const preview = calculateDueDate(termToDueDateInput(term), base)
    return {
      label: 'Estimasi jatuh tempo',
      date: preview,
      text: null,
      confirmed: false,
      hint: `${termDesc}. Estimasi dari tanggal invoice di PI (${base}); isi tanggal invoice atau simpan draft untuk menyimpan ke kolom jatuh tempo.`,
      term_name: termName,
      calculation_type: calculationType,
      base_source: 'invoice',
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
