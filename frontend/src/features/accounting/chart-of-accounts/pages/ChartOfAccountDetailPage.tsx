import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useBranchContext } from '@/features/branch_context'
import { useChartOfAccountsStore } from '../store/chartOfAccounts.store'
import { AccountTypeBadge } from '../components/AccountTypeBadge'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft, Building2, Edit, Trash2, Plus } from 'lucide-react'
import { buildAccountDisplayName, formatAccountPath } from '../utils/format'

export default function ChartOfAccountDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const currentBranch = useBranchContext()
  const { selectedAccount, loading, getAccountById, deleteAccount } = useChartOfAccountsStore()
  const { success, error } = useToast()

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

    getAccountById(companyId, id).catch(() => {
      error('Account not found')
      navigate('/chart-of-accounts')
    })
  }, [id, currentBranch, getAccountById, navigate, error])

  const handleDelete = async () => {
    if (!selectedAccount || !currentBranch?.company_id) return
    if (!confirm('Are you sure you want to delete this account?')) return

    try {
      const companyId = String(currentBranch.company_id)
      await deleteAccount(companyId, selectedAccount.id)
      success('Account deleted successfully')
      navigate('/chart-of-accounts')
    } catch {
      error('Failed to delete account')
    }
  }

  if (loading.detail || !selectedAccount) {
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
        <div className="flex items-center justify-between">
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
                <h1 className="text-xl font-bold text-gray-900">Account Details</h1>
                <p className="text-sm text-gray-500">
                  {buildAccountDisplayName(selectedAccount.account_code, selectedAccount.account_name)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {selectedAccount.is_header && (
              <button
                onClick={() => navigate(`/chart-of-accounts/new?parent=${selectedAccount.id}`)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Child
              </button>
            )}
            <button
              onClick={() => navigate(`/chart-of-accounts/${selectedAccount.id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            {/* Account Status Banner */}
            <div className={`px-6 py-3 ${
              selectedAccount.is_active 
                ? 'bg-green-50 border-b border-green-200' 
                : 'bg-red-50 border-b border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${
                  selectedAccount.is_active ? 'text-green-800' : 'text-red-800'
                }`}>
                  Account Status: {selectedAccount.is_active ? 'Active' : 'Inactive'}
                </span>
                <div className="flex items-center gap-3">
                  {selectedAccount.is_header && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Header Account
                    </span>
                  )}
                  {selectedAccount.is_postable && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Postable
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Code</label>
                    <div className="text-lg font-mono bg-gray-50 px-3 py-2 rounded-md">
                      {selectedAccount.account_code}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Name</label>
                    <div className="text-lg bg-gray-50 px-3 py-2 rounded-md">
                      {selectedAccount.account_name}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
                    <div className="flex items-center">
                      <AccountTypeBadge type={selectedAccount.account_type} />
                    </div>
                  </div>

                  {selectedAccount.account_subtype && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Subtype</label>
                      <div className="bg-gray-50 px-3 py-2 rounded-md">
                        {selectedAccount.account_subtype}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Normal Balance</label>
                    <div className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                      selectedAccount.normal_balance === 'DEBIT' 
                        ? 'bg-blue-100 text-blue-800' 
                        : 'bg-purple-100 text-purple-800'
                    }`}>
                      {selectedAccount.normal_balance}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Currency Code</label>
                    <div className="bg-gray-50 px-3 py-2 rounded-md font-mono">
                      {selectedAccount.currency_code}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Level</label>
                    <div className="bg-gray-50 px-3 py-2 rounded-md">
                      Level {selectedAccount.level}
                    </div>
                  </div>

                  {selectedAccount.account_path && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Account Path</label>
                      <div className="bg-gray-50 px-3 py-2 rounded-md text-sm">
                        {formatAccountPath(selectedAccount.account_path)}
                      </div>
                    </div>
                  )}

                  {selectedAccount.sort_order !== null && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                      <div className="bg-gray-50 px-3 py-2 rounded-md">
                        {selectedAccount.sort_order}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                    <div className="bg-gray-50 px-3 py-2 rounded-md text-sm">
                      {new Date(selectedAccount.created_at).toLocaleString('en-US')}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                    <div className="bg-gray-50 px-3 py-2 rounded-md text-sm">
                      {new Date(selectedAccount.updated_at).toLocaleString('en-US')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}