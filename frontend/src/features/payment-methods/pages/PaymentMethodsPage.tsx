import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePaymentMethodsStore } from '../store/paymentMethods.store'
import { PaymentMethodTable } from '../components/PaymentMethodTable'
import { PaymentMethodFilters } from '../components/PaymentMethodFilters'
import { PaymentMethodForm } from '../components/PaymentMethodForm'
import { useToast } from '@/contexts/ToastContext'
import type { CreatePaymentMethodDto } from '../types'

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
    setPage
  } = usePaymentMethodsStore()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    fetchPaymentMethods()
  }, [fetchPaymentMethods])

  const handleSubmit = async (data: CreatePaymentMethodDto | Partial<Omit<CreatePaymentMethodDto, 'code'>>) => {
    try {
      if (editingId) {
        await updatePaymentMethod(editingId, data as any)
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Methods</h1>
          <p className="text-gray-500 mt-1">Manage available payment methods</p>
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
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              {editingId ? 'Edit Payment Method' : 'New Payment Method'}
            </h2>
            <button
              onClick={handleFormClose}
              className="text-gray-500 hover:text-gray-700"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-4">
              <div className="text-sm text-gray-500">
                Showing {(page - 1) * limit + 1} - {Math.min(page * limit, total)} of {total} records
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

