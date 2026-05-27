import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useChartOfAccountsStore } from '../store/chartOfAccounts.store'
import { ChartOfAccountForm } from '../components/ChartOfAccountForm'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft, Building2 } from 'lucide-react'
import type { UpdateChartOfAccountDto } from '../types/chart-of-account.types'

export default function EditChartOfAccountPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { accounts, selectedAccount, loading, updateAccount, fetchAccounts, getAccountById } = useChartOfAccountsStore()
  const { success, error } = useToast()
  
  const [parentAccounts, setParentAccounts] = useState(accounts)

  useEffect(() => {
    if (!id) {
      navigate('/chart-of-accounts')
      return
    }

    Promise.all([
      getAccountById(id),
      fetchAccounts(1, 1000),
    ]).catch(() => {
      error('Account not found')
      navigate('/chart-of-accounts')
    })
  }, [id, getAccountById, fetchAccounts, navigate, error])

  useEffect(() => {
    setParentAccounts(accounts)
  }, [accounts])

  const handleSubmit = async (data: UpdateChartOfAccountDto) => {
    if (!id) return

    try {
      await updateAccount(id, data)
      success('Account updated successfully')
      navigate('/chart-of-accounts')
    } catch (err) {
      error('Failed to update account')
      throw err
    }
  }

  if (!selectedAccount) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400">Loading account...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/chart-of-accounts')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Edit Account</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedAccount.account_code} - {selectedAccount.account_name}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-6 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <ChartOfAccountForm
              initialData={selectedAccount}
              isEdit={true}
              onSubmit={handleSubmit}
              isLoading={loading.submit}
              parentAccounts={parentAccounts}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
