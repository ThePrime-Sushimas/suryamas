import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBranchContext } from '@/features/branch_context'
import { useChartOfAccountsStore } from '../store/chartOfAccounts.store'
import { ChartOfAccountForm } from '../components/ChartOfAccountForm'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft, Building2 } from 'lucide-react'
import type { UpdateChartOfAccountDto } from '../types/chart-of-account.types'

export default function EditChartOfAccountPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const currentBranch = useBranchContext()
  const { accounts, selectedAccount, loading, updateAccount, fetchAccounts, getAccountById } = useChartOfAccountsStore()
  const { success, error } = useToast()
  
  const [parentAccounts, setParentAccounts] = useState(accounts)

  useEffect(() => {
    if (!id) {
      navigate('/chart-of-accounts')
      return
    }

    if (!currentBranch?.company_id) {
      error('Please select a branch first')
      navigate('/chart-of-accounts')
      return
    }

    const companyId = String(currentBranch.company_id)
    
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(companyId)) {
      error('Invalid company selected. Please select a valid branch.')
      navigate('/chart-of-accounts')
      return
    }

    // Load the account and all accounts for parent selection
    Promise.all([
      getAccountById(companyId, id),
      fetchAccounts(companyId, 1, 1000) // Load more accounts for parent selection
    ]).catch(() => {
      error('Account not found')
      navigate('/chart-of-accounts')
    })
  }, [id, currentBranch, getAccountById, fetchAccounts, navigate, error])

  useEffect(() => {
    setParentAccounts(accounts)
  }, [accounts])

  const handleSubmit = async (data: UpdateChartOfAccountDto) => {
    if (!id || !currentBranch?.company_id) return

    try {
      const companyId = String(currentBranch.company_id)
      await updateAccount(companyId, id, data)
      success('Account updated successfully')
      navigate('/chart-of-accounts')
    } catch (err) {
      error('Failed to update account')
      throw err
    }
  }

  if (!selectedAccount) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-gray-500">Loading account...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/chart-of-accounts')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Edit Account</h1>
              <p className="text-sm text-gray-500">
                {selectedAccount.account_code} - {selectedAccount.account_name}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-6">
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