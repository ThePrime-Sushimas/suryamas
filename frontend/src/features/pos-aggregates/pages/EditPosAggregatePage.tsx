/**
 * EditPosAggregatePage.tsx
 * 
 * Full page for editing existing aggregated transactions.
 * Fetches transaction data by ID and provides edit form.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import { useToast } from '@/contexts/ToastContext'
import { PosAggregatesForm } from '../components/PosAggregatesForm'
import type { AggregatedTransaction, UpdateAggregatedTransactionDto } from '../types'

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Full page for editing existing aggregated transactions
 * Fetches transaction by ID and provides edit form
 */
export const EditPosAggregatePage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  
  const {
    selectedTransaction,
    fetchTransactionById,
    updateTransaction,
    fetchTransactions,
    fetchSummary,
    isLoading,
    error,
    clearError,
  } = usePosAggregatesStore()

  const [initialLoad, setInitialLoad] = useState(true)

  // Fetch transaction on mount
  useEffect(() => {
    if (!id) {
      toast.error('ID transaksi tidak valid')
      navigate('/pos-aggregates')
      return
    }

    const loadTransaction = async () => {
      try {
        await fetchTransactionById(id)
      } catch (error) {
        if (error instanceof Error && error.message.includes('tidak ditemukan')) {
          toast.error('Transaksi tidak ditemukan atau telah dihapus')
        } else {
          toast.error('Gagal mengambil data transaksi')
        }
        navigate('/pos-aggregates')
      } finally {
        setInitialLoad(false)
      }
    }

    loadTransaction()
  }, [id, fetchTransactionById, toast, navigate])

  // Handle form submit
  const handleSubmit = useCallback(async (data: AggregatedTransaction | UpdateAggregatedTransactionDto) => {
    if (!id) return

    try {
      await updateTransaction(id, data as UpdateAggregatedTransactionDto)
      toast.success('Transaksi agregat berhasil diperbarui')
      fetchTransactions()
      fetchSummary()
      navigate('/pos-aggregates')
    } catch {
      toast.error('Gagal memperbarui transaksi')
    }
  }, [id, updateTransaction, toast, fetchTransactions, fetchSummary, navigate])

  // Handle cancel
  const handleCancel = useCallback(() => {
    clearError()
    navigate('/pos-aggregates')
  }, [clearError, navigate])

  // Loading state
  if (initialLoad) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pos-aggregates')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Transaksi Agregat</h1>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Memuat data transaksi...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/pos-aggregates')}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Transaksi Agregat</h1>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => navigate('/pos-aggregates')}
            className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Kembali ke Daftar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/pos-aggregates')}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Transaksi Agregat</h1>
          <p className="text-gray-500 mt-1">
            Perbarui informasi transaksi agregat
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          {selectedTransaction ? (
            <PosAggregatesForm
              transaction={selectedTransaction}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isLoading={isLoading}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Transaksi tidak ditemukan</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default EditPosAggregatePage

