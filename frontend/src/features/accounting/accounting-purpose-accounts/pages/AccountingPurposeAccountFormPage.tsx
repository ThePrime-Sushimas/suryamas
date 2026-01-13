import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAccountingPurposeAccountsStore } from '../store/accountingPurposeAccounts.store'
import { AccountingPurposeAccountForm } from '../components/AccountingPurposeAccountForm'
import { useToast } from '@/contexts/ToastContext'
import type { CreateAccountingPurposeAccountDto, UpdateAccountingPurposeAccountDto } from '../types/accounting-purpose-account.types'

export const AccountingPurposeAccountFormPage = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { success, error } = useToast()
  
  const {
    selectedAccount,
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

  useEffect(() => {
    fetchPostableAccounts()
    fetchActivePurposes()
    
    if (isEdit && id) {
      getAccountById(id).catch(() => {
        error('Account mapping not found')
        navigate('/accounting-purpose-accounts')
      })
    }
  }, [id, isEdit, fetchPostableAccounts, fetchActivePurposes, getAccountById, error, navigate])

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
    } catch (err: any) {
      // Handle specific error messages from backend
      const errorMessage = err?.response?.data?.error || err?.message || `Failed to ${isEdit ? 'update' : 'create'} account mapping`
      error(errorMessage)
    }
  }

  const handleCancel = () => {
    navigate('/accounting-purpose-accounts')
  }

  if (isEdit && loading.detail) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (isEdit && !selectedAccount) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Account mapping not found</div>
      </div>
    )
  }

  const initialData = isEdit && selectedAccount ? {
    purpose_id: selectedAccount.purpose_id,
    account_id: selectedAccount.account_id,
    side: selectedAccount.side,
    priority: selectedAccount.priority,
    is_active: selectedAccount.is_active
  } : undefined

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          {isEdit ? 'Edit' : 'Create'} Purpose Account Mapping
        </h1>
        <p className="text-sm text-gray-600">
          {isEdit ? 'Update the' : 'Create a new'} accounting purpose to account mapping
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <AccountingPurposeAccountForm
          initialData={initialData}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isEdit={isEdit}
        />
      </div>
    </div>
  )
}