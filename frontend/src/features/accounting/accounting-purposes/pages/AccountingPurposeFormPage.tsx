import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useAccountingPurposesStore } from '../store/accountingPurposes.store'
import { AccountingPurposeForm } from '../components/AccountingPurposeForm'
import type { CreateAccountingPurposeDto, UpdateAccountingPurposeDto, AccountingPurpose } from '../types/accounting-purpose.types'

interface AccountingPurposeFormPageProps {
  companyId: string
  branchId?: string
  purposeId?: string
  initialData?: AccountingPurpose
  isEdit?: boolean
  onBack: () => void
  onSuccess: () => void
}

export const AccountingPurposeFormPage = ({
  companyId,
  branchId,
  purposeId,
  initialData,
  isEdit = false,
  onBack,
  onSuccess
}: AccountingPurposeFormPageProps) => {
  const { createPurpose, updatePurpose, loading, error, clearError } = useAccountingPurposesStore()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleSubmit = async (data: CreateAccountingPurposeDto | UpdateAccountingPurposeDto) => {
    try {
      setSubmitError(null)
      clearError()

      if (isEdit && purposeId) {
        await updatePurpose(purposeId, data as UpdateAccountingPurposeDto, companyId)
      } else {
        await createPurpose(data as CreateAccountingPurposeDto)
      }
      
      onSuccess()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      setSubmitError(message)
    }
  }

  const displayError = submitError || error

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Edit Accounting Purpose' : 'Create New Accounting Purpose'}
          </h1>
          <p className="text-gray-600">
            {isEdit 
              ? 'Update the accounting purpose details' 
              : 'Add a new accounting purpose for transactions'
            }
          </p>
        </div>
      </div>

      {/* Error Message */}
      {displayError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{displayError}</p>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <AccountingPurposeForm
          initialData={initialData}
          isEdit={isEdit}
          onSubmit={handleSubmit}
          isLoading={loading}
          onCancel={onBack}
          companyId={companyId}
          branchId={branchId}
        />
      </div>
    </div>
  )
}