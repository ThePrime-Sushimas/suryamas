import { Check } from 'lucide-react'
import type { EmployeeResponse } from '../types'

interface EmployeeListItemProps {
  employee: EmployeeResponse
  isSelected: boolean
  isActive: boolean
  onClick: () => void
  onSelect: (id: string) => void
}

export const EmployeeListItem = ({ employee, isSelected, isActive, onClick, onSelect }: EmployeeListItemProps) => {
  return (
    <div
      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors border-l-4 ${
        isActive 
          ? 'bg-blue-50 border-blue-600' 
          : 'bg-white border-transparent hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSelect(employee.id)
        }}
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isSelected 
            ? 'bg-blue-600 border-blue-600' 
            : 'border-gray-300 hover:border-blue-400'
        }`}
      >
        {isSelected && <Check className="w-3 h-3 text-white" />}
      </button>

      {/* Avatar */}
      {employee.profile_picture ? (
        <img
          src={employee.profile_picture}
          alt={employee.full_name}
          className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-blue-100"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling?.classList.remove('hidden')
          }}
        />
      ) : null}
      <div className={`w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-sm shrink-0 ${employee.profile_picture ? 'hidden' : ''}`}>
        {employee.full_name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900 truncate">{employee.full_name}</p>
        <p className="text-xs text-gray-500 truncate">{employee.job_position || 'No position'}</p>
      </div>

      {/* Status */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${
        employee.is_active ? 'bg-green-500' : 'bg-gray-300'
      }`} />
    </div>
  )
}
