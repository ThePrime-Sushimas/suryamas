import type { ApPayment } from '../api/apPayments.api'

export type ApPaymentListGroup =
  | { kind: 'single'; payment: ApPayment }
  | { kind: 'batch'; batchId: string; payments: ApPayment[] }

/**
 * Collapse payments that share bulk_payment_batch_id into one batch group.
 * Preserves first-seen order from the list (expects batch rows adjacent from backend ORDER BY).
 */
export function groupApPaymentsForList(payments: ApPayment[]): ApPaymentListGroup[] {
  const batchMap = new Map<string, ApPayment[]>()
  const groups: ApPaymentListGroup[] = []

  for (const payment of payments) {
    const batchId = payment.bulk_payment_batch_id
    if (!batchId) {
      groups.push({ kind: 'single', payment })
      continue
    }

    let batchPayments = batchMap.get(batchId)
    if (!batchPayments) {
      batchPayments = []
      batchMap.set(batchId, batchPayments)
      groups.push({ kind: 'batch', batchId, payments: batchPayments })
    }
    batchPayments.push(payment)
  }

  return groups
}

export function batchGroupTotals(payments: ApPayment[]) {
  const totalAmount = payments.reduce((sum, p) => sum + Number(p.total_amount), 0)
  const invoiceCount = payments.reduce((sum, p) => sum + (p.invoice_count ?? 0), 0)
  const supplierNames = [...new Set(payments.map((p) => p.supplier_name))]
  return { totalAmount, invoiceCount, paymentCount: payments.length, supplierNames }
}
