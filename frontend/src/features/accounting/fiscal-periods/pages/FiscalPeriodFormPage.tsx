import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import { FiscalPeriodForm } from '../components/FiscalPeriodForm'
import type { CreateFiscalPeriodDto } from '../types/fiscal-period.types'

export function FiscalPeriodFormPage() {
  const navigate = useNavigate()
  const { createPeriod } = useFiscalPeriodsStore()

  const handleSubmit = useCallback(async (dto: CreateFiscalPeriodDto) => {
    try {
      await createPeriod(dto)
      navigate('/accounting/fiscal-periods')
    } catch (error) {
      if (error instanceof Error && error.message.includes('network')) {
        throw new Error('Network error. Please check your connection and try again.')
      }
      throw error
    }
  }, [createPeriod, navigate])

  const handleCancel = useCallback(() => {
    navigate('/accounting/fiscal-periods')
  }, [navigate])

  return (
    <div className="p-6 max-w-2xl mx-auto" role="main">
      <h1 id="page-title" className="text-2xl font-bold mb-6">Create Fiscal Period</h1>
      <div className="bg-white rounded-lg shadow p-6" aria-labelledby="page-title">
        <FiscalPeriodForm onSubmit={handleSubmit} onCancel={handleCancel} />
      </div>
    </div>
  )
}
