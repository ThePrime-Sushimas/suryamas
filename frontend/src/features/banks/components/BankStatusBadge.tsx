interface BankStatusBadgeProps {
  isActive: boolean
}

export const BankStatusBadge = ({ isActive }: BankStatusBadgeProps) => {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        isActive
          ? 'bg-green-100 text-green-800'
          : 'bg-gray-100 text-gray-800'
      }`}
    >
      <span className={`mr-1 h-1.5 w-1.5 rounded-full ${isActive ? 'bg-green-600' : 'bg-gray-600'}`} />
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
