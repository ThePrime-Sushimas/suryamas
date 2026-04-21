import { X, Mail, Phone, MapPin, Briefcase, Calendar, Building2, Edit, Trash2, Star, ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { EmployeeResponse } from '../types'
import api from '@/lib/axios'

interface EmployeeBranch {
  id: string
  branch_name: string
  branch_code: string
  role_name: string
  is_primary: boolean
}

interface EmployeeDetailPanelProps {
  employee: EmployeeResponse | null
  onClose: () => void
  onEdit: (id: string) => void
  onDelete: (id: string, name: string) => void
  onRestore: (id: string, name: string) => void
  onToggleActive: (id: string, name: string, currentActive: boolean) => void
  onManageBranches: (id: string) => void
}

export const EmployeeDetailPanel = ({ employee, onClose, onEdit, onDelete, onRestore, onToggleActive, onManageBranches }: EmployeeDetailPanelProps) => {
  const [branches, setBranches] = useState<EmployeeBranch[]>([])
  const [loadingBranches, setLoadingBranches] = useState(false)

  useEffect(() => {
    if (!employee) return
    
    const fetchBranches = async () => {
      setLoadingBranches(true)
      try {
        const { data } = await api.get(`/employee-branches/employee/${employee.id}`)
        setBranches(data.data || [])
      } catch (err) {
        console.error('Failed to load branches:', err)
        setBranches([])
      } finally {
        setLoadingBranches(false)
      }
    }

    fetchBranches()
  }, [employee])

  if (!employee) return null

  const infoCls = "text-sm text-gray-900 dark:text-white"
  const labelCls = "text-xs text-gray-500 dark:text-gray-400"

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 lg:border-l border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {/* Back button visible on mobile only */}
        <button
          onClick={onClose}
          className="lg:hidden p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Employee Details</h2>
        <button
          onClick={onClose}
          className="hidden lg:block p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Profile */}
        <div className="text-center mb-6">
          {employee.profile_picture ? (
            <img
              src={employee.profile_picture}
              alt={employee.full_name}
              className="w-24 h-24 mx-auto mb-4 rounded-full object-cover border-4 border-blue-100 dark:border-blue-900"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div className={`w-24 h-24 mx-auto mb-4 rounded-full bg-linear-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-3xl font-bold ${employee.profile_picture ? 'hidden' : ''}`}>
            {employee.full_name.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{employee.full_name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{employee.employee_id}</p>
          {employee.deleted_at && (
            <div className="mt-2">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                Deleted on {new Date(employee.deleted_at).toLocaleDateString('id-ID')}
              </span>
            </div>
          )}
          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              employee.is_active 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}>
              {employee.is_active ? 'Active' : 'Inactive'}
            </span>
            {employee.status_employee && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                {employee.status_employee}
              </span>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="space-y-4">
          {employee.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className={labelCls}>Email</p>
                <p className={`${infoCls} break-all`}>{employee.email}</p>
              </div>
            </div>
          )}

          {employee.mobile_phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className={labelCls}>Phone</p>
                <p className={infoCls}>{employee.mobile_phone}</p>
              </div>
            </div>
          )}

          {employee.job_position && (
            <div className="flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className={labelCls}>Position</p>
                <p className={infoCls}>{employee.job_position}</p>
              </div>
            </div>
          )}

          {/* Branches */}
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className={`${labelCls} mb-2`}>Branches ({branches.length})</p>
              {loadingBranches ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : branches.length === 0 ? (
                <p className="text-xs text-gray-400">No branches assigned</p>
              ) : (
                <div className="space-y-1.5">
                  {branches.map(branch => (
                    <div key={branch.id} className="flex items-center gap-2 text-sm flex-wrap">
                      {branch.is_primary && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 shrink-0" />}
                      <span className="text-gray-900 dark:text-white">{branch.branch_name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">({branch.branch_code})</span>
                      {branch.is_primary && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded">Primary</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {employee.citizen_id_address && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className={labelCls}>Address</p>
                <p className={`${infoCls} wrap-break-word`}>{employee.citizen_id_address}</p>
              </div>
            </div>
          )}

          {employee.birth_date && (
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className={labelCls}>Date of Birth</p>
                <p className={infoCls}>
                  {new Date(employee.birth_date).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {!employee.deleted_at ? (
          <>
            <button
              onClick={() => onToggleActive(employee.id, employee.full_name, employee.is_active)}
              className={`w-full px-4 py-2 rounded-lg transition-colors font-medium ${
                employee.is_active
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {employee.is_active ? 'Deactivate' : 'Activate'} Employee
            </button>
            <button
              onClick={() => onManageBranches(employee.id)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Manage Branches
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(employee.id)}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={() => onDelete(employee.id, employee.full_name)}
                className="flex-1 px-4 py-2 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => onRestore(employee.id, employee.full_name)}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Restore Employee
          </button>
        )}
      </div>
    </div>
  )
}
