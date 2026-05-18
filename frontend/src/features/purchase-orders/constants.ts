export const PO_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  SENT: { label: 'Dikirim ke Purchasing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  ORDERED: { label: 'Sudah Order ke Supplier', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  PARTIAL_RECEIVED: { label: 'Diterima Sebagian', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
  FULLY_RECEIVED: { label: 'Diterima Semua', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  CLOSED: { label: 'Selesai', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300' },
}
