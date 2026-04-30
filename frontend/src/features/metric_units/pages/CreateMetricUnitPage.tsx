import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitForm } from '../components/MetricUnitForm'
import { useToast } from '@/contexts/ToastContext'
import type { CreateMetricUnitDto } from '../types'

export default function CreateMetricUnitPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { createMetricUnit, mutationLoading, filterOptions, fetchFilterOptions } = useMetricUnitsStore()

  useEffect(() => {
    if (!filterOptions) fetchFilterOptions()
  }, [filterOptions, fetchFilterOptions])

  const handleSubmit = async (data: CreateMetricUnitDto) => {
    try {
      await createMetricUnit(data)
      toast.success('Satuan berhasil dibuat')
      navigate('/metric-units')
    } catch {
      toast.error('Terjadi kesalahan. Silakan coba lagi.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/metric-units')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-700 dark:text-gray-300">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tambah Satuan</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Buat satuan ukur baru</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <MetricUnitForm onSubmit={handleSubmit} isLoading={mutationLoading} metricTypes={filterOptions?.metric_types} />
        </div>
      </div>
    </div>
  )
}
