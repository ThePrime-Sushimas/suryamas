import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useChartOfAccountsStore } from '../store/chartOfAccounts.store'
import { ChartOfAccountForm } from '../components/ChartOfAccountForm'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft, Building2 } from 'lucide-react'
import type { CreateChartOfAccountDto, UpdateChartOfAccountDto } from '../types/chart-of-account.types'

export default function CreateChartOfAccountPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { accounts, loading, createAccount } = useChartOfAccountsStore()
  const { success, error } = useToast()
  
  const [parentAccounts, setParentAccounts] = useState(accounts)
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>()

  const parentId = searchParams.get('parent')

  useEffect(() => {
    // Load all accounts for parent selection - need company_id
    // This will be handled by the form component when company is selected
  }, [])

  useEffect(() => {
    setParentAccounts(accounts)
  }, [accounts])

  useEffect(() => {
    // If parent ID is provided in URL, set it as default
    if (parentId) {
      setDefaultParentId(parentId)
    }
  }, [parentId])

  const handleSubmit = async (data: CreateChartOfAccountDto | UpdateChartOfAccountDto) => {
    try {
      await createAccount(data as CreateChartOfAccountDto)
      success('Account created successfully')
      navigate('/chart-of-accounts')
    } catch {
      error('Failed to create account')
    }
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
              <h1 className="text-xl font-bold text-gray-900">Create Account</h1>
              <p className="text-sm text-gray-500">Add a new account to the chart of accounts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <ChartOfAccountForm
              onSubmit={handleSubmit}
              isLoading={loading.submit}
              parentAccounts={parentAccounts}
              defaultParentId={defaultParentId}
            />
          </div>
        </div>
      </div>
    </div>
  )
}