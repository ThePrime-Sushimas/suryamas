import { useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import { FiscalPeriodForm } from '../components/FiscalPeriodForm'
import type { UpdateFiscalPeriodDto } from '../types/fiscal-period.types'

export function FiscalPeriodEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedPeriod, loading, fetchPeriodById, updatePeriod } = useFiscalPeriodsStore()

  useEffect(() => {
    if (id) {
      fetchPeriodById(id)
    }
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
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">Loading...</div>
  }

  if (!selectedPeriod) {
    return <div className="text-center py-8 text-gray-500 dark:text-gray-400">Fiscal period not found</div>
  }

  return (
    <div className="p-6 max-w-2xl mx-auto" role="main">
      <h1 id="page-title" className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Edit Fiscal Period</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6" aria-labelledby="page-title">
        <FiscalPeriodForm 
          initialData={selectedPeriod}
          onSubmit={handleSubmit} 
          onCancel={handleCancel} 
        />
      </div>
    </div>
  )
}
