export const PR_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300' },
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  APPROVED: { label: 'Disetujui', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
  REJECTED: { label: 'Ditolak', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  CONVERTED: { label: 'Dikonversi ke PO', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
}

export const PR_PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'Urgent', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  medium: { label: 'Sedang', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' },
  normal: { label: 'Normal', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
}
