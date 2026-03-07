interface SupplierStatusBadgeProps {
  isActive: boolean
}

export function SupplierStatusBadge({ isActive }: SupplierStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive
          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

