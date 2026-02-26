// PaymentMethodStatusBadge.tsx

interface PaymentMethodStatusBadgeProps {
  isActive: boolean
  isDefault?: boolean
  isDeleted?: boolean
}

export const PaymentMethodStatusBadge = ({ 
  isActive, 
  isDefault = false,
  isDeleted = false 
}: PaymentMethodStatusBadgeProps) => {
  if (isDeleted) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
        Deleted
      </span>
    )
  }

  if (isDefault) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
        Default
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
      isActive 
        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    }`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
