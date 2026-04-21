interface BankStatusBadgeProps {
  isActive: boolean
}

export const BankStatusBadge = ({ isActive }: BankStatusBadgeProps) => {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
      isActive
        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-400'
    }`}>
      <span className={`mr-1 h-1.5 w-1.5 rounded-full ${isActive ? 'bg-green-600 dark:bg-green-400' : 'bg-gray-600 dark:bg-gray-500'}`} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
