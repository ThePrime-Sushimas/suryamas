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
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600">
        Deleted
      </span>
    )
  }

  if (isDefault) {
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
        Default
      </span>
    )
  }

  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${
      isActive 
        ? 'bg-green-100 text-green-800' 
        : 'bg-gray-100 text-gray-800'
    }`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

