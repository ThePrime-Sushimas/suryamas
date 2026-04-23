import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAccountingPurposeAccountsStore } from '../store/accountingPurposeAccounts.store'
import { AccountingPurposeAccountForm } from '../components/AccountingPurposeAccountForm'
import { useToast } from '@/contexts/ToastContext'
import { useBranchContext } from '@/features/branch_context/hooks/useBranchContext'
import type { CreateAccountingPurposeAccountDto, UpdateAccountingPurposeAccountDto } from '../types/accounting-purpose-account.types'

export const AccountingPurposeAccountFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { success, error } = useToast()
  const branchContext = useBranchContext()
  
  const {
    selectedAccount,
    postableAccounts,
    activePurposes,
    loading,
    error: storeError,
    getAccountById,
    createAccount,
    updateAccount,
    fetchPostableAccounts,
    fetchActivePurposes,
    clearError
  } = useAccountingPurposeAccountsStore()

  const isEdit = Boolean(id)

  // Reload data when company changes
  useEffect(() => {
    if (branchContext?.company_id) {
      fetchPostableAccounts()
      fetchActivePurposes()
      
      if (isEdit && id) {
        getAccountById(id).catch(() => {
          error('Account mapping not found')
          navigate('/accounting-purpose-accounts')
        })
      }
    }
  }, [branchContext?.company_id, id, isEdit, fetchPostableAccounts, fetchActivePurposes, getAccountById, error, navigate])

  useEffect(() => {
    if (storeError) {
      error(storeError.message)
      clearError()
    }
  }, [storeError, error, clearError])

  const handleSubmit = async (data: CreateAccountingPurposeAccountDto | UpdateAccountingPurposeAccountDto) => {
    // Clean up data - remove null/empty values
    const cleanData = {
      ...data,
      priority: data.priority || undefined
    }
    
    try {
      if (isEdit && id) {
        await updateAccount(id, cleanData as UpdateAccountingPurposeAccountDto)
        success('Account mapping updated successfully')
      } else {
        await createAccount(cleanData as CreateAccountingPurposeAccountDto)
        success('Account mapping created successfully')
      }
      navigate('/accounting-purpose-accounts')
    } catch (err: unknown) {
      // Handle specific error messages from backend
      const errorMessage = err instanceof Error 
        ? err.message 
        : (err as { response?: { data?: { error?: string } } })?.response?.data?.error 
        || `Failed to ${isEdit ? 'update' : 'create'} account mapping`
      error(errorMessage)
    }
  }

  const handleCancel = () => {
    navigate('/accounting-purpose-accounts')
  }

  if (isEdit && loading.detail) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (isEdit && !selectedAccount) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500 dark:text-gray-400">Account mapping not found</div>
      </div>
    )
  }

  const initialData = isEdit && selectedAccount ? {
    purpose_id: selectedAccount.purpose_id,
    account_id: selectedAccount.account_id,
    side: selectedAccount.side,
    priority: selectedAccount.priority,
    field_mapping: selectedAccount.field_mapping ?? null,
    is_active: selectedAccount.is_active
  } : undefined

  const editInfo = isEdit && selectedAccount ? {
    purpose_code: activePurposes.find(p => p.id === selectedAccount.purpose_id)?.purpose_code || '',
    purpose_name: activePurposes.find(p => p.id === selectedAccount.purpose_id)?.purpose_name || '',
    account_code: postableAccounts.find(a => a.id === selectedAccount.account_id)?.account_code || '',
    account_name: postableAccounts.find(a => a.id === selectedAccount.account_id)?.account_name || '',
    side: selectedAccount.side,
  } : undefined

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {isEdit ? 'Edit' : 'Create'} Purpose Account Mapping
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {isEdit ? 'Update the' : 'Create a new'} accounting purpose to account mapping
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <AccountingPurposeAccountForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isEdit={isEdit}
            editInfo={editInfo}
          />
        </div>
      </div>
    </div>
  )
}
