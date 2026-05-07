import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Ruler } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useCreateMetricUnit, useMetricUnitFilterOptions } from '../api/metricUnits.api'
import { MetricUnitForm } from '../components/MetricUnitForm'
import type { CreateMetricUnitDto } from '../types'

export default function CreateMetricUnitPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const createUnit = useCreateMetricUnit()
  const { data: filterOptions } = useMetricUnitFilterOptions()

  const handleSubmit = async (data: CreateMetricUnitDto) => {
    try {
      await createUnit.mutateAsync(data)
      toast.success('Satuan berhasil dibuat')
      navigate('/metric-units')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal membuat satuan')) }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/metric-units')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </button>
          <Ruler className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Tambah Satuan</h1>
            <p className="text-xs text-gray-400">Buat satuan ukur baru</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <MetricUnitForm onSubmit={handleSubmit} isLoading={createUnit.isPending} metricTypes={filterOptions?.metric_types} />
        </div>
      </div>
    </div>
  )
}
