interface PaymentTermStatusBadgeProps {
  isActive: boolean
  isDeleted: boolean
}

export const PaymentTermStatusBadge = ({ isActive, isDeleted }: PaymentTermStatusBadgeProps) => {
  if (isDeleted) {
    return (
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
        Deleted
      </span>
    )
  }

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
      isActive 
        ? 'bg-green-100 text-green-800' 
        : 'bg-gray-100 text-gray-800'
    }`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}
