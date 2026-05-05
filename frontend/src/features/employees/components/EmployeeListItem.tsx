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
      className={`flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-colors border-l-3 ${
        isActive 
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-600' 
          : 'bg-white dark:bg-gray-800 border-transparent hover:bg-gray-50 dark:hover:bg-gray-700/50'
      }`}
      onClick={onClick}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSelect(employee.id)
        }}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
          isSelected 
            ? 'bg-blue-600 border-blue-600' 
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400'
        }`}
      >
        {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
      </button>

      {/* Avatar */}
      {employee.profile_picture ? (
        <img
          src={employee.profile_picture}
          alt={employee.full_name}
          className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200 dark:border-gray-700"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            e.currentTarget.nextElementSibling?.classList.remove('hidden')
          }}
        />
      ) : null}
      <div className={`w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-semibold text-xs shrink-0 ${employee.profile_picture ? 'hidden' : ''}`}>
        {employee.full_name.charAt(0).toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{employee.full_name}</p>
          {employee.deleted_at && (
            <span className="px-1 py-0.5 text-[10px] bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded shrink-0">
              Dihapus
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{employee.job_position || 'Belum ada posisi'}</p>
      </div>

      {/* Status */}
      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
        employee.is_active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
      }`} />
    </div>
  )
}
