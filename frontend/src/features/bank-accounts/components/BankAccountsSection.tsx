import { useState } from 'react'
import { Plus } from 'lucide-react'
import { type SubmitHandler } from 'react-hook-form'
import { BankAccountTable } from './BankAccountTable'
import { BankAccountForm } from './BankAccountForm'
import { useBankAccountsStore } from '../store/useBankAccounts'
import { useToast } from '@/contexts/ToastContext'
import type { BankAccountFormData } from '../schemas/bankAccount.schema'
import type { BankAccount } from '../types'

interface BankAccountsSectionProps {
  ownerType: 'company' | 'supplier'
  ownerId: string
  companyId?: string
}

export const BankAccountsSection = ({ ownerType, ownerId, companyId }: BankAccountsSectionProps) => {
  const toast = useToast()
  const { mutationLoading, create, update, fetchById } = useBankAccountsStore()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editData, setEditData] = useState<BankAccount | null>(null)

  const handleCreate: SubmitHandler<BankAccountFormData> = async (data) => {
    try {
      await create({
        ...data,
        owner_type: ownerType,
        owner_id: ownerId,
      })
      toast.success('Bank account created successfully')
      setShowForm(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create bank account')
    }
  }

  const handleEdit = async (id: number) => {
    try {
      const account = await fetchById(id)
      setEditData(account)
      setEditId(id)
      setShowForm(true)
    } catch {
      toast.error('Failed to load bank account')
    }
  }

  const handleUpdate: SubmitHandler<BankAccountFormData> = async (data) => {
    if (!editId) return
    try {
      await update(editId, data)
      toast.success('Bank account updated successfully')
      setShowForm(false)
      setEditId(null)
      setEditData(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update bank account')
    }
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditId(null)
    setEditData(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bank Accounts</h2>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Plus className="h-4 w-4" />
            Add Account
          </button>
        )}
      </div>

      {showForm ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {editId ? 'Edit Bank Account' : 'Add Bank Account'}
          </h3>
          <BankAccountForm
            initialData={editData ?? undefined}
            onSubmit={editId ? handleUpdate : handleCreate}
            onCancel={handleCancel}
            isLoading={mutationLoading}
            companyId={companyId}
          />
        </div>
      ) : (
        <BankAccountTable
          ownerType={ownerType}
          ownerId={ownerId}
          onEdit={handleEdit}
        />
      )}
    </div>
  )
}
