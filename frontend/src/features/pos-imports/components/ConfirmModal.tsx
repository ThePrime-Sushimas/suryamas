import { useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '@/features/auth/store/auth.store'
import { useBranchContextStore } from '@/features/branch_context'
import { logAuditAction, createConfirmationAudit } from '@/utils/audit.util'

interface BusinessContext {
  id?: string
  name?: string
  type?: string
  date?: string
  amount?: number
  [key: string]: string | number | undefined
}

interface FinancialImpact {
  affectedTransactions?: number
  totalAmount?: number
  willAffectAccounting?: boolean
  reconciliationImpact?: string
  affectedPeriod?: string
}

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: (reason?: string) => void
  onCancel: () => void
  variant?: 'danger' | 'warning' | 'info'
  // Audit trail
  actionType?: 'DELETE' | 'CONFIRM' | 'APPROVE' | 'REJECT' | 'IMPORT'
  entityType?: string
  // Business context
  contextData?: BusinessContext
  // Reason requirement
  requireReason?: boolean
  reasonPlaceholder?: string
  // Permission check
  requiredPermission?: { module: string; action: 'view' | 'insert' | 'update' | 'delete' }
  // Financial impact (Phase 2)
  financialImpact?: FinancialImpact
}

export const ConfirmModal = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
  actionType,
  entityType,
  contextData,
  requireReason = false,
  reasonPlaceholder = 'Please provide a reason for this action...',
  requiredPermission,
  financialImpact
}: ConfirmModalProps) => {
  const [isLoading, setIsLoading] = useState(false)
  const [reason, setReason] = useState('')
  const user = useAuthStore(s => s.user)
  const currentBranch = useBranchContextStore(s => s.currentBranch)

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsLoading(true)
    try {
      // Log audit trail
      if (actionType && entityType) {
        const auditEntry = createConfirmationAudit(actionType, entityType, {
          entityId: contextData?.id,
          userId: user?.id,
          userEmail: user?.email,
          branchId: currentBranch?.branch_id,
          branchName: currentBranch?.branch_name,
          reason: reason || undefined,
          context: contextData
        })
        logAuditAction(auditEntry)
      }
      
      await onConfirm(reason || undefined)
    } finally {
      setIsLoading(false)
    }
  }
  
  const isReasonValid = !requireReason || reason.trim().length >= 10
  const canConfirm = !isLoading && isReasonValid

  const variantStyles = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-orange-600 hover:bg-orange-700',
    info: 'bg-blue-600 hover:bg-blue-700'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onCancel} disabled={isLoading} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-gray-700">{message}</p>
          
          {/* Business Context Display */}
          {contextData && Object.keys(contextData).length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2 text-sm">Details:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {contextData.id && (
                  <div>
                    <span className="text-gray-600">ID:</span>{' '}
                    <code className="bg-gray-100 px-1 rounded text-xs">{contextData.id}</code>
                  </div>
                )}
                {contextData.name && (
                  <div>
                    <span className="text-gray-600">Name:</span> {contextData.name}
                  </div>
                )}
                {contextData.type && (
                  <div>
                    <span className="text-gray-600">Type:</span> {contextData.type}
                  </div>
                )}
                {contextData.date && (
                  <div>
                    <span className="text-gray-600">Date:</span> {contextData.date}
                  </div>
                )}
                {contextData.amount !== undefined && (
                  <div>
                    <span className="text-gray-600">Amount:</span>{' '}
                    <span className="font-medium">{contextData.amount}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Reason Input for Critical Actions */}
          {requireReason && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonPlaceholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                rows={3}
                disabled={isLoading}
              />
              {reason.trim().length > 0 && reason.trim().length < 10 && (
                <p className="text-xs text-red-600 mt-1">
                  Reason must be at least 10 characters (current: {reason.trim().length})
                </p>
              )}
            </div>
          )}
          
          {/* Permission Warning */}
          {requiredPermission && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={16} />
                <p className="text-xs text-yellow-700">
                  This action requires <span className="font-medium">{requiredPermission.action}</span> permission on <span className="font-medium">{requiredPermission.module}</span> module.
                </p>
              </div>
            </div>
          )}
          
          {/* Financial Impact Warning (Phase 2) */}
          {financialImpact && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={18} />
                <div className="text-sm flex-1">
                  <p className="font-medium text-red-900 mb-2">⚠️ Financial Impact Warning</p>
                  <ul className="text-red-700 space-y-1">
                    {financialImpact.affectedTransactions !== undefined && (
                      <li>• {financialImpact.affectedTransactions} transaction(s) will be affected</li>
                    )}
                    {financialImpact.totalAmount !== undefined && (
                      <li>• Total amount: <span className="font-medium">{financialImpact.totalAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span></li>
                    )}
                    {financialImpact.affectedPeriod && (
                      <li>• Affected period: {financialImpact.affectedPeriod}</li>
                    )}
                    {financialImpact.willAffectAccounting && (
                      <li className="font-medium">• This will affect accounting period closing</li>
                    )}
                    {financialImpact.reconciliationImpact && (
                      <li>• {financialImpact.reconciliationImpact}</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 flex items-center gap-2 ${variantStyles[variant]}`}
          >
            {isLoading && (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
