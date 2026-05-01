import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { usePaymentMethodsStore } from '../store/paymentMethods.store'
import { PaymentMethodTable } from '../components/PaymentMethodTable'
import { PaymentMethodFilters } from '../components/PaymentMethodFilters'
import { PaymentMethodForm } from '../components/PaymentMethodForm'
import { Pagination } from '@/components/ui/Pagination'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import type { CreatePaymentMethodDto, UpdatePaymentMethodDto } from '../types'

export const PaymentMethodsPage = () => {
  const toast = useToast()
  const {
    paymentMethods,
    fetchPage,
    createPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
    page,
    limit,
    total,
    totalPages,
    isLoading,
    isMutating,
  } = usePaymentMethodsStore()

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteData, setDeleteData] = useState<{ id: number; name: string } | null>(null)

  const doFetch = fetchPage

  useEffect(() => {
    doFetch(1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (data: CreatePaymentMethodDto | UpdatePaymentMethodDto) => {
    try {
      if (editingId) {
        await updatePaymentMethod(editingId, data as UpdatePaymentMethodDto)
        toast.success('Metode pembayaran berhasil diperbarui')
      } else {
        await createPaymentMethod(data as CreatePaymentMethodDto)
        toast.success('Metode pembayaran berhasil dibuat')
      }
      setShowForm(false)
      setEditingId(null)
      doFetch(page)
    } catch (error: unknown) {
      toast.error(parseApiError(error, 'Gagal menyimpan metode pembayaran'))
    }
  }

  const handleEdit = (id: number) => {
    setEditingId(id)
    setShowForm(true)
  }

  const handleConfirmDelete = async () => {
    if (!deleteData) return
    try {
      await deletePaymentMethod(deleteData.id)
      toast.success(`Metode pembayaran "${deleteData.name}" berhasil dihapus`)
      doFetch(1)
    } catch (error: unknown) {
      toast.error(parseApiError(error, 'Gagal menghapus metode pembayaran'))
    } finally {
      setDeleteData(null)
    }
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Metode Pembayaran</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Kelola metode pembayaran yang tersedia</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Tambah Metode
          </button>
        )}
      </div>

      {showForm ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {editingId ? 'Edit Metode Pembayaran' : 'Metode Pembayaran Baru'}
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
            onDelete={(id, name) => setDeleteData({ id, name })}
            loading={isLoading}
          />

          {total > 0 && (
            <Pagination
              pagination={{
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
              }}
              onPageChange={(p) => doFetch(p)}
              onLimitChange={(l) => doFetch(1, l)}
              currentLength={paymentMethods.length}
              loading={isLoading}
            />
          )}
        </>
      )}

      <ConfirmModal
        isOpen={!!deleteData}
        onClose={() => setDeleteData(null)}
        onConfirm={handleConfirmDelete}
        title="Hapus Metode Pembayaran"
        message={`Yakin ingin menghapus "${deleteData?.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        variant="danger"
        isLoading={isMutating}
      />
    </div>
  )
}
