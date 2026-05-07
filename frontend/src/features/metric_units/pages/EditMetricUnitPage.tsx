import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Ruler } from 'lucide-react'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { FormSkeleton } from '@/components/ui/Skeleton'
import { useMetricUnit, useUpdateMetricUnit, useMetricUnitFilterOptions } from '../api/metricUnits.api'
import { MetricUnitForm } from '../components/MetricUnitForm'
import type { CreateMetricUnitDto } from '../types'

export default function EditMetricUnitPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const unit = useMetricUnit(id || '')
  const updateUnit = useUpdateMetricUnit()
  const { data: filterOptions } = useMetricUnitFilterOptions()

  const handleSubmit = async (data: CreateMetricUnitDto) => {
    if (!id) return
    try {
      await updateUnit.mutateAsync({ id, ...data })
      toast.success('Satuan berhasil diupdate')
      navigate('/metric-units')
    } catch (err: unknown) { toast.error(parseApiError(err, 'Gagal mengupdate satuan')) }
  }

  if (unit.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div><div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" /><div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6"><FormSkeleton /></div>
        </div>
      </div>
    )
  }

  if (!unit.data) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 lg:p-6">
        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
          <Ruler className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Satuan tidak ditemukan</h3>
          <button onClick={() => navigate('/metric-units')} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">Kembali</button>
        </div>
      </div>
    )
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
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Satuan</h1>
            <p className="text-xs text-gray-400">{unit.data.unit_name} • {unit.data.metric_type}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
          <MetricUnitForm initialData={unit.data} isEdit onSubmit={handleSubmit} isLoading={updateUnit.isPending} metricTypes={filterOptions?.metric_types} />
        </div>
      </div>
    </div>
  )
}
