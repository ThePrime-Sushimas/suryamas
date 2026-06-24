/** Base columns: Supplier, Tgl Bayar, Total, Status, Metode Bayar, No. Pembayaran — keep in sync with ApPaymentsPage <thead> */
export const AP_PAYMENT_TABLE_BASE_COLUMNS = 6

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
