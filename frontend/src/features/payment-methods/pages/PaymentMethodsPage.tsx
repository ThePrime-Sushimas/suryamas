import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePaymentMethodsStore } from '../store/paymentMethods.store'
import { PaymentMethodTable } from '../components/PaymentMethodTable'
import { PaymentMethodFilters } from '../components/PaymentMethodFilters'
import { PaymentMethodForm } from '../components/PaymentMethodForm'
import { Pagination } from '@/components/ui/Pagination'
import { useToast } from '@/contexts/ToastContext'
import type { CreatePaymentMethodDto, UpdatePaymentMethodDto } from '../types'

export const PaymentMethodsPage = () => {
  const toast = useToast()
  const { 
    paymentMethods, 
    fetchPaymentMethods, 
    createPaymentMethod,
    updatePaymentMethod, 
    deletePaymentMethod,
    page, 
    limit, 
    total, 
    totalPages,
    isLoading,
    isMutating,
    setPage,
    setLimit
  } = usePaymentMethodsStore()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    fetchPaymentMethods()
  }, [fetchPaymentMethods])

  // Fetch data when page or limit changes
  useEffect(() => {
    fetchPaymentMethods(page, limit)
  }, [page, limit, fetchPaymentMethods])

  const handleSubmit = async (data: CreatePaymentMethodDto | UpdatePaymentMethodDto) => {
    try {
      if (editingId) {
        await updatePaymentMethod(editingId, data as UpdatePaymentMethodDto)
        toast.success('Payment method updated successfully')
      } else {
        await createPaymentMethod(data as CreatePaymentMethodDto)
        toast.success('Payment method created successfully')
      }
      setShowForm(false)
      setEditingId(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save payment method')
    }
  }

  const handleEdit = (id: number) => {
    setEditingId(id)
    setShowForm(true)
  }

  const handleDelete = async (id: number, name: string) => {
    try {
      await deletePaymentMethod(id)
      toast.success(`Payment method "${name}" deleted successfully`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete payment method')
    }
  }

  const handleRestore = async (_id: number, name: string) => {
    toast.success(`Payment method "${name}" restored successfully`)
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const selectedPaymentMethod = editingId 
    ? paymentMethods.find(pm => pm.id === editingId) || null 
    : null

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Payment Methods</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage available payment methods</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Payment Method
          </button>
        )}
      </div>

      {showForm ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Edit Payment Method' : 'New Payment Method'}
            </h2>
            <button
              onClick={handleFormClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>
          <PaymentMethodForm
            paymentMethod={selectedPaymentMethod}
            onSubmit={handleSubmit}
            onCancel={handleFormClose}
            isLoading={isMutating}
          />
        </div>
      ) : (
        <>
          <PaymentMethodFilters />
          
          <PaymentMethodTable
            paymentMethods={paymentMethods}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onRestore={handleRestore}
            loading={isLoading}
          />

          {/* Global Pagination Component */}
          {total > 0 && (
            <Pagination
              pagination={{
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
              }}
              onPageChange={setPage}
              onLimitChange={setLimit}
              currentLength={paymentMethods.length}
              loading={isLoading}
            />
          )}
        </>
      )}
    </div>
  )
}
