import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitForm } from '../components/MetricUnitForm'
import { useToast } from '@/contexts/ToastContext'
import type { CreateMetricUnitDto } from '../types'

export default function EditMetricUnitPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { currentMetricUnit, loading, filterOptions, updateMetricUnit, fetchFilterOptions } = useMetricUnitsStore()

  useEffect(() => {
    if (!filterOptions) fetchFilterOptions()
  }, [filterOptions, fetchFilterOptions])

  useEffect(() => {
    if (id) {
      useMetricUnitsStore.getState().fetchMetricUnitById(id).catch(() => {
        toast.error('Satuan tidak ditemukan')
        navigate('/metric-units')
      })
    }
  }, [id, navigate, toast])

  const handleSubmit = async (data: CreateMetricUnitDto) => {
    if (!id) return
    try {
      await updateMetricUnit(id, data)
      toast.success('Satuan berhasil diupdate')
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Satuan</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{currentMetricUnit?.unit_name || 'Loading...'}</p>
          </div>
        </div>

        {loading && !currentMetricUnit ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <div className="animate-pulse space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}><div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/4 mb-2" /><div className="h-10 bg-gray-100 dark:bg-gray-700 rounded" /></div>
              ))}
            </div>
          </div>
        ) : !currentMetricUnit ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8 text-center">
            <p className="text-gray-500 dark:text-gray-400">Satuan tidak ditemukan</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6">
            <MetricUnitForm initialData={currentMetricUnit} isEdit onSubmit={handleSubmit} isLoading={loading} metricTypes={filterOptions?.metric_types} />
          </div>
        )}
      </div>
    </div>
  )
}
