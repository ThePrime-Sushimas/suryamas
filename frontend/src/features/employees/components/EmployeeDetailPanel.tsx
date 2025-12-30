import { X, Mail, Phone, MapPin, Briefcase, Calendar, Building2, Edit, Trash2, Star } from 'lucide-react'
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
  onManageBranches: (id: string) => void
}

export const EmployeeDetailPanel = ({ employee, onClose, onEdit, onDelete, onManageBranches }: EmployeeDetailPanelProps) => {
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

  return (
    <div className="h-full flex flex-col bg-white border-l border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Employee Details</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-gray-500" />
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
              className="w-24 h-24 mx-auto mb-4 rounded-full object-cover border-4 border-blue-100"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextElementSibling?.classList.remove('hidden')
              }}
            />
          ) : null}
          <div className={`w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-3xl font-bold ${employee.profile_picture ? 'hidden' : ''}`}>
            {employee.full_name.charAt(0).toUpperCase()}
          </div>
          <h3 className="text-xl font-bold text-gray-900">{employee.full_name}</h3>
          <p className="text-sm text-gray-500">{employee.employee_id}</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              employee.is_active 
                ? 'bg-green-100 text-green-700' 
                : 'bg-gray-100 text-gray-700'
            }`}>
              {employee.is_active ? 'Active' : 'Inactive'}
            </span>
            {employee.status_employee && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {employee.status_employee}
              </span>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="space-y-4">
          {employee.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Email</p>
                <p className="text-sm text-gray-900">{employee.email}</p>
              </div>
            </div>
          )}

          {employee.mobile_phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Phone</p>
                <p className="text-sm text-gray-900">{employee.mobile_phone}</p>
              </div>
            </div>
          )}

          {employee.job_position && (
            <div className="flex items-start gap-3">
              <Briefcase className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Position</p>
                <p className="text-sm text-gray-900">{employee.job_position}</p>
              </div>
            </div>
          )}

          {/* Branches */}
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs text-gray-500 mb-2">Branches ({branches.length})</p>
              {loadingBranches ? (
                <p className="text-xs text-gray-400">Loading...</p>
              ) : branches.length === 0 ? (
                <p className="text-xs text-gray-400">No branches assigned</p>
              ) : (
                <div className="space-y-1.5">
                  {branches.map(branch => (
                    <div key={branch.id} className="flex items-center gap-2 text-sm">
                      {branch.is_primary && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                      <span className="text-gray-900">{branch.branch_name}</span>
                      <span className="text-xs text-gray-500">({branch.branch_code})</span>
                      {branch.is_primary && (
                        <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">Primary</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {employee.citizen_id_address && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Address</p>
                <p className="text-sm text-gray-900">{employee.citizen_id_address}</p>
              </div>
            </div>
          )}

          {employee.birth_date && (
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-xs text-gray-500">Date of Birth</p>
                <p className="text-sm text-gray-900">
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
      <div className="p-4 border-t border-gray-200 space-y-2">
        <button
          onClick={() => onManageBranches(employee.id)}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Manage Branches
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(employee.id)}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Edit className="w-4 h-4" />
            Edit
          </button>
          <button
            onClick={() => onDelete(employee.id, employee.full_name)}
            className="flex-1 px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
