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
    return <div className="text-center py-8">Loading...</div>
  }

  if (!selectedPeriod) {
    return <div className="text-center py-8">Fiscal period not found</div>
  }

  return (
    <div className="max-w-2xl mx-auto" role="main">
      <h1 id="page-title" className="text-2xl font-bold mb-6">Edit Fiscal Period</h1>
      <div className="bg-white rounded-lg shadow p-6" aria-labelledby="page-title">
        <FiscalPeriodForm 
          initialData={selectedPeriod}
          onSubmit={handleSubmit} 
          onCancel={handleCancel} 
        />
      </div>
    </div>
  )
}
