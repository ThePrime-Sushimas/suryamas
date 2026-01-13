import { useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical, Edit, Trash2, Eye, Lock } from 'lucide-react'
import type { AccountingPurpose } from '../types/accounting-purpose.types'
import { AppliedToBadge } from './AppliedToBadge'
import { SystemLockBadge } from './SystemLockBadge'

interface AccountingPurposeTableProps {
  purposes: AccountingPurpose[]
  onView: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  loading?: boolean
}

export const AccountingPurposeTable = ({ 
  purposes, 
  onView, 
  onEdit, 
  onDelete, 
  loading 
}: AccountingPurposeTableProps) => {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  const handleDropdownToggle = (id: string) => {
    setActiveDropdown(activeDropdown === id ? null : id)
  }

  const ActionDropdown = ({ purpose }: { purpose: AccountingPurpose }) => {
    if (activeDropdown !== purpose.id) return null

    const canModify = !purpose.is_system

    // Get dropdown element position safely
    const getDropdownPosition = () => {
      const element = document.querySelector(`[data-dropdown="${purpose.id}"]`)
      if (!element) {
        return { top: 0, left: 0 }
      }
      const rect = element.getBoundingClientRect()
      return {
        top: rect.bottom + 5,
        left: rect.left
      }
    }

    const position = getDropdownPosition()

    return createPortal(
      <div className="fixed inset-0 z-50" onClick={() => setActiveDropdown(null)}>
        <div 
          className="absolute bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onView(purpose.id)
              setActiveDropdown(null)
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
          >
            <Eye size={16} />
            View Details
          </button>
          
          <button
            onClick={() => {
              onEdit(purpose.id)
              setActiveDropdown(null)
            }}
            disabled={!canModify}
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
              canModify 
                ? 'text-gray-700 hover:bg-gray-100' 
                : 'text-gray-400 cursor-not-allowed'
            }`}
            title={!canModify ? 'System purposes cannot be edited' : ''}
          >
            {canModify ? <Edit size={16} /> : <Lock size={16} />}
            Edit
          </button>
          
          <button
            onClick={() => {
              onDelete(purpose.id)
              setActiveDropdown(null)
            }}
            disabled={!canModify}
            className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
              canModify 
                ? 'text-red-600 hover:bg-red-50' 
                : 'text-gray-400 cursor-not-allowed'
            }`}
            title={!canModify ? 'System purposes cannot be deleted' : ''}
          >
            {canModify ? <Trash2 size={16} /> : <Lock size={16} />}
            Delete
          </button>
        </div>
      </div>,
      document.body
    )
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-100 rounded-t-lg"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-50 border-t border-gray-100"></div>
          ))}
        </div>
      </div>
    )
  }

  if (purposes.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Accounting Purposes</h3>
        <p className="text-gray-600">Get started by creating your first accounting purpose.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Purpose
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Applied To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="relative px-6 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {purposes.map((purpose) => (
              <tr key={purpose.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {purpose.purpose_name}
                    </div>
                    <div className="text-sm text-gray-500 font-mono">
                      {purpose.purpose_code}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <AppliedToBadge appliedTo={purpose.applied_to} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    purpose.is_active 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {purpose.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <SystemLockBadge isSystem={purpose.is_system} />
                  {!purpose.is_system && (
                    <span className="text-sm text-gray-500">Custom</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(purpose.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    data-dropdown={purpose.id}
                    onClick={() => handleDropdownToggle(purpose.id)}
                    className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100"
                  >
                    <MoreVertical size={16} />
                  </button>
                  <ActionDropdown purpose={purpose} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}