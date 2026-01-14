import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useBranchContext } from '@/features/branch_context'
import { useChartOfAccountsStore } from '../store/chartOfAccounts.store'
import { ChartOfAccountForm } from '../components/ChartOfAccountForm'
import { useToast } from '@/contexts/ToastContext'
import { ArrowLeft, Building2 } from 'lucide-react'
import type { CreateChartOfAccountDto, UpdateChartOfAccountDto, ChartOfAccount, ChartOfAccountTreeNode } from '../types/chart-of-account.types'

// Helper function to flatten tree data for parent selection
const flattenTree = (tree: ChartOfAccountTreeNode[]): ChartOfAccount[] => {
  const result: ChartOfAccount[] = []
  
  const traverse = (nodes: ChartOfAccountTreeNode[]) => {
    for (const node of nodes) {
      result.push(node)
      if (node.children && node.children.length > 0) {
        traverse(node.children)
      }
    }
  }
  
  traverse(tree)
  return result
}

export default function CreateChartOfAccountPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const currentBranch = useBranchContext()
  const { tree, loading, createAccount, fetchTree } = useChartOfAccountsStore()
  const { success, error } = useToast()
  
  const [parentAccounts, setParentAccounts] = useState<ChartOfAccount[]>([])
  const [defaultParentId, setDefaultParentId] = useState<string | undefined>()
  const [selectedParent, setSelectedParent] = useState<ChartOfAccount | undefined>()

  const parentId = searchParams.get('parent')

  useEffect(() => {
    // Load tree data for parent selection
    if (currentBranch?.company_id) {
      fetchTree()
    }
  }, [currentBranch?.company_id, fetchTree])

  useEffect(() => {
    // Convert tree to flat array for parent selection
    setParentAccounts(flattenTree(tree))
  }, [tree])

  useEffect(() => {
    // If parent ID is provided in URL, set it as default and find parent account
    if (parentId && parentAccounts.length > 0) {
      setDefaultParentId(parentId)
      const parent = parentAccounts.find(p => p.id === parentId)
      setSelectedParent(parent)
    }
  }, [parentId, parentAccounts])

  const handleSubmit = async (data: CreateChartOfAccountDto | UpdateChartOfAccountDto) => {
    try {
      await createAccount(data as CreateChartOfAccountDto)
      success('Account created successfully')
      navigate('/chart-of-accounts')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create account'
      error(errorMessage)
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
              lockedAccountType={selectedParent?.account_type}
            />
          </div>
        </div>
      </div>
    </div>
  )
}