/** Base columns: No. Pembayaran, Tgl Bayar, Supplier, Total, Status — keep in sync with ApPaymentsPage <thead> */
export const AP_PAYMENT_TABLE_BASE_COLUMNS = 5

export function getApPaymentTableColumnCount(options: {
  showJournal: boolean
  showDelete: boolean
}): number {
  return (
    AP_PAYMENT_TABLE_BASE_COLUMNS +
    (options.showJournal ? 1 : 0) +
    (options.showDelete ? 1 : 0)
  )
}
