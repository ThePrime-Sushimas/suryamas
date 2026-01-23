/**
 * CreatePosAggregatePage.tsx
 * 
 * Full page for creating new aggregated transactions.
 * Provides a dedicated form for creating transactions.
 */

import React, { useCallback } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { usePosAggregatesStore } from '../store/posAggregates.store'
import { useToast } from '@/contexts/ToastContext'
import { PosAggregatesForm } from '../components/PosAggregatesForm'
import type { CreateAggregatedTransactionDto, UpdateAggregatedTransactionDto } from '../types'

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Full page for creating new aggregated transactions
 * Provides a dedicated form with navigation back to list
 */
export const CreatePosAggregatePage: React.FC = () => {
  const navigate = useNavigate()
  const toast = useToast()
  
  const {
    createTransaction,
    fetchTransactions,
    fetchSummary,
    isMutating,
  } = usePosAggregatesStore()

  // Handle form submit
  const handleSubmit = useCallback(async (data: CreateAggregatedTransactionDto | UpdateAggregatedTransactionDto) => {
    try {
      await createTransaction(data as CreateAggregatedTransactionDto)
      toast.success('Transaksi agregat berhasil dibuat')
      fetchTransactions()
      fetchSummary()
      navigate('/pos-aggregates')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal membuat transaksi')
    }
  }, [createTransaction, toast, fetchTransactions, fetchSummary, navigate])

  // Handle cancel
  const handleCancel = useCallback(() => {
    navigate('/pos-aggregates')
  }, [navigate])

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
          <h1 className="text-2xl font-bold text-gray-900">Tambah Transaksi Agregat</h1>
          <p className="text-gray-500 mt-1">
            Buat transaksi agregat baru dari data POS
          </p>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6">
          <PosAggregatesForm
            transaction={null}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isMutating}
          />
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default CreatePosAggregatePage

