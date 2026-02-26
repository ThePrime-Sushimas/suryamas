interface PaymentTermStatusBadgeProps {
  isActive: boolean
  isDeleted: boolean
}

export const PaymentTermStatusBadge = ({ isActive, isDeleted }: PaymentTermStatusBadgeProps) => {
  if (isDeleted) {
    return (
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
        Deleted
      </span>
    )
  }

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
      isActive 
        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
    }`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
