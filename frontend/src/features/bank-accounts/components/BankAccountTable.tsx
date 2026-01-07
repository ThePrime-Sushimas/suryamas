import { useEffect, useState } from 'react'
import { Edit2, Trash2 } from 'lucide-react'
import { useBankAccountsStore } from '../store/useBankAccounts'
import { PrimaryBadge } from './PrimaryBadge'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'

interface BankAccountTableProps {
  ownerType: 'company' | 'supplier'
  ownerId: string
  onEdit: (id: number) => void
}

export const BankAccountTable = ({ ownerType, ownerId, onEdit }: BankAccountTableProps) => {
  const toast = useToast()
  const { accounts, fetchLoading, mutationLoading, fetchByOwner, delete: deleteAccount } = useBankAccountsStore()
  const [deleteId, setDeleteId] = useState<number | null>(null)

  useEffect(() => {
    if (ownerId) {
      fetchByOwner(ownerType, ownerId)
    }
  }, [ownerType, ownerId, fetchByOwner])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteAccount(deleteId)
      toast.success('Bank account deleted successfully')
      setDeleteId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete bank account')
    }
  }

  const primaryAccount = accounts.find(a => a.is_primary)

  if (fetchLoading) {
    return <div className="text-center py-8 text-gray-500">Loading...</div>
  }

  if (accounts.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <p className="text-gray-600 mb-2">No bank accounts yet</p>
        <p className="text-sm text-gray-500">Add your first bank account to get started</p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Primary
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {accounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{account.bank_name}</div>
                    <div className="text-xs text-gray-500">{account.bank_code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {account.account_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                    {account.account_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <PrimaryBadge isPrimary={account.is_primary} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      account.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onEdit(account.id)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Edit"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteId(account.id)}
                        className="text-red-600 hover:text-red-900"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={deleteId === primaryAccount?.id ? 'Delete Primary Account?' : 'Delete Bank Account'}
        message={
          deleteId === primaryAccount?.id
            ? 'This is your primary account. Are you sure you want to delete it?'
            : 'Are you sure you want to delete this bank account? This action cannot be undone.'
        }
        confirmText="Delete"
        variant="danger"
        isLoading={mutationLoading}
      />
    </>
  )
}
