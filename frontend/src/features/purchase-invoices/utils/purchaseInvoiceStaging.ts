/** Auto-draft PI from GR uses `[INV] GR-...`; merge uses `[DRAFT-MERGED]`. */
export function isStagingInvoiceNumber(invoiceNumber: string): boolean {
  const n = invoiceNumber.trim()
  return /^\[INV\]\s/i.test(n) || n === '[DRAFT-MERGED]' || /^\[DRAFT/i.test(n)
}
