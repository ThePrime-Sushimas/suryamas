import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useBranchContext } from '@/features/branch_context'
import { useToast } from '@/contexts/ToastContext'
import { useAccountingPurposesStore } from '../store/accountingPurposes.store'
import { AccountingPurposeForm } from '../components/AccountingPurposeForm'
import type { CreateAccountingPurposeDto, UpdateAccountingPurposeDto, AccountingPurpose } from '../types/accounting-purpose.types'

interface AccountingPurposeFormPageProps {
  purposeId?: string
  initialData?: AccountingPurpose
  isEdit?: boolean
  onBack: () => void
  onSuccess: () => void
}

export const AccountingPurposeFormPage = ({
  purposeId,
  initialData,
  isEdit = false,
  onBack,
  onSuccess
}: AccountingPurposeFormPageProps) => {
  const currentBranch = useBranchContext()
  const toast = useToast()
  const { createPurpose, updatePurpose, loading, error, clearError } = useAccountingPurposesStore()
  const [submitError, setSubmitError] = useState<string | null>(null)

  if (!currentBranch?.company_id) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Company Selected</h2>
          <p className="text-gray-600 dark:text-gray-400">Please select a branch to continue.</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (data: CreateAccountingPurposeDto | UpdateAccountingPurposeDto) => {
    try {
      setSubmitError(null)
      clearError()

      if (isEdit && purposeId) {
        await updatePurpose(purposeId, data as UpdateAccountingPurposeDto)
        toast.success('Accounting purpose berhasil diupdate')
      } else {
        await createPurpose(data as CreateAccountingPurposeDto)
        toast.success('Accounting purpose berhasil dibuat')
      }
      
      onSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      setSubmitError(message)
      toast.error(message)
    }
  }

  const displayError = submitError || error

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isEdit ? 'Edit Accounting Purpose' : 'Create New Accounting Purpose'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isEdit 
              ? 'Update the accounting purpose details' 
              : 'Add a new accounting purpose for transactions'
            }
          </p>
        </div>
      </div>

      {/* Error Message */}
      {displayError && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{displayError}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <AccountingPurposeForm
          initialData={initialData}
          isEdit={isEdit}
          onSubmit={handleSubmit}
          isLoading={loading}
          onCancel={onBack}
        />
      </div>
    </div>
  )
}
