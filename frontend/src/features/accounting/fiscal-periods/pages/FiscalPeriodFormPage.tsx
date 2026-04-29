import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/contexts/ToastContext'
import { useFiscalPeriodsStore } from '../store/fiscalPeriods.store'
import { FiscalPeriodForm } from '../components/FiscalPeriodForm'
import type { CreateFiscalPeriodDto } from '../types/fiscal-period.types'

export function FiscalPeriodFormPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { createPeriod } = useFiscalPeriodsStore()

  const handleSubmit = useCallback(async (dto: CreateFiscalPeriodDto) => {
    try {
      await createPeriod(dto)
      toast.success('Fiscal period berhasil dibuat')
      navigate('/accounting/fiscal-periods')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal membuat fiscal period')
    }
  }, [createPeriod, navigate, toast])

  const handleCancel = useCallback(() => {
    navigate('/accounting/fiscal-periods')
  }, [navigate])

  return (
    <div className="p-6 max-w-2xl mx-auto" role="main">
      <h1 id="page-title" className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Create Fiscal Period</h1>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6" aria-labelledby="page-title">
        <FiscalPeriodForm onSubmit={handleSubmit} onCancel={handleCancel} />
      </div>
    </div>
  )
}
