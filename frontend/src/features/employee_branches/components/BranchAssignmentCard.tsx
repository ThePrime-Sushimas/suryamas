import { Building2, Star, Edit2, Trash2, Ban, CheckCircle, Briefcase, Shield, MapPin } from 'lucide-react'
import { useState } from 'react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import type { EmployeeBranch } from '../api/types'

interface Props {
  branch: EmployeeBranch
  onEdit: () => void
  onDelete: () => void
  onSuspend: () => void
  onActivate: () => void
  onSetPrimary: () => void
}

export function BranchAssignmentCard({ branch, onEdit, onDelete, onSuspend, onActivate, onSetPrimary }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showSuspendConfirm, setShowSuspendConfirm] = useState(false)

  const statusConfig = {
    active: { 
      bg: 'bg-green-100 dark:bg-green-900/30', 
      text: 'text-green-700 dark:text-green-400',
      label: 'Aktif',
      icon: CheckCircle
    },
    inactive: { 
      bg: 'bg-gray-100 dark:bg-gray-700', 
      text: 'text-gray-600 dark:text-gray-400',
      label: 'Nonaktif',
      icon: Ban
    },
    suspended: { 
      bg: 'bg-orange-100 dark:bg-orange-900/30', 
      text: 'text-orange-700 dark:text-orange-400',
      label: 'Ditangguhkan',
      icon: Ban
    },
  }

  const status = statusConfig[branch.status]
  const StatusIcon = status.icon

  return (
    <>
      <div className={`relative bg-white dark:bg-gray-800 rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
        branch.is_primary 
          ? 'border-amber-400 dark:border-amber-600 shadow-amber-100 dark:shadow-amber-900/20' 
          : 'border-gray-200 dark:border-gray-700'
      }`}>
        {/* Primary Badge */}
        {branch.is_primary && (
          <div className="absolute -top-2 -right-2 z-10">
            <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white rounded-full shadow-lg">
              <Star className="w-3 h-3 fill-white" />
              <span className="text-[10px] font-bold">PRIMARY</span>
            </div>
          </div>
        )}

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className={`p-2 rounded-lg ${branch.is_primary ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                <Building2 className={`h-4 w-4 ${branch.is_primary ? 'text-amber-600 dark:text-amber-400' : 'text-blue-600 dark:text-blue-400'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate">{branch.branch_name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{branch.branch_code}</p>
              </div>
            </div>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${status.bg} ${status.text}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </div>
          </div>

          {/* Info Grid */}
          <div className="space-y-3 mb-4">
            {/* Position */}
            <div className="flex items-start gap-2">
              <Briefcase className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Posisi</p>
                {branch.position_name ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{branch.position_name}</p>
                    {branch.department_name && (
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{branch.department_name}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 dark:text-gray-500 italic">Tidak ada posisi</p>
                )}
              </div>
            </div>

            {/* Role */}
            <div className="flex items-start gap-2">
              <Shield className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Role</p>
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{branch.role_name}</p>
              </div>
            </div>

            {/* Approval Limit */}
            {branch.approval_limit > 0 && (
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-green-500 dark:text-green-400 mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">Limit Approval</p>
                  <p className="text-xs font-semibold text-gray-900 dark:text-white">
                    Rp {branch.approval_limit.toLocaleString('id-ID')}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
            {!branch.is_primary && (
              <button
                onClick={onSetPrimary}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
              >
                <Star className="w-3 h-3" />
                Set Primary
              </button>
            )}
            <button
              onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
            >
              <Edit2 className="w-3 h-3" />
              Edit
            </button>
            {branch.status === 'active' ? (
              <button
                onClick={() => setShowSuspendConfirm(true)}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
              >
                <Ban className="w-3 h-3" />
              </button>
            ) : (
              <button
                onClick={onActivate}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
              >
                <CheckCircle className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => { onDelete(); setShowDeleteConfirm(false) }}
        title="Hapus Penempatan"
        message={`Hapus penempatan di cabang "${branch.branch_name}"?`}
        confirmText="Hapus"
        variant="danger"
      />

      <ConfirmModal
        isOpen={showSuspendConfirm}
        onClose={() => setShowSuspendConfirm(false)}
        onConfirm={() => { onSuspend(); setShowSuspendConfirm(false) }}
        title="Tangguhkan Akses"
        message={`Tangguhkan akses karyawan ke cabang "${branch.branch_name}"?`}
        confirmText="Tangguhkan"
        variant="warning"
      />
    </>
  )
}
