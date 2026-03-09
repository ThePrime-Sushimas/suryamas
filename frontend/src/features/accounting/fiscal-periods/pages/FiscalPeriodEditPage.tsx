import { useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import { FiscalPeriodForm } from '../components/FiscalPeriodForm'
import type { UpdateFiscalPeriodDto } from '../types/fiscal-period.types'

export function FiscalPeriodEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedPeriod, loading, error, fetchPeriodById, updatePeriod } = useFiscalPeriodsStore()

  // Fetch period data when id changes
  useEffect(() => {
    if (!id) return
    
    // Fetch data directly
    fetchPeriodById(id)
  }, [id, fetchPeriodById])

  const handleSubmit = useCallback(async (dto: UpdateFiscalPeriodDto) => {
    if (!id) return
    await updatePeriod(id, dto)
    navigate('/accounting/fiscal-periods')
  }, [id, updatePeriod, navigate])

  const handleCancel = useCallback(() => {
    navigate('/accounting/fiscal-periods')
  }, [navigate])

  if (loading) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={() => navigate('/accounting/fiscal-periods')}
            className="mt-4 text-red-600 dark:text-red-400 hover:underline"
          >
            Back to list
          </button>
        </div>
      </div>
    )
  }

  if (!selectedPeriod) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">Fiscal period not found</p>
        <button
          onClick={() => navigate('/accounting/fiscal-periods')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Back to list
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto" role="main">
      <h1 id="page-title" className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Edit Fiscal Period: {selectedPeriod?.period || 'Loading...'}</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6" aria-labelledby="page-title">
        <FiscalPeriodForm 
          initialData={selectedPeriod ?? undefined}
          onSubmit={handleSubmit} 
          onCancel={handleCancel} 
        />
      </div>
    </div>
  )
}
