import { useParams, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitForm } from '../components/MetricUnitForm'
import { useToast } from '@/contexts/ToastContext'
import type { CreateMetricUnitDto } from '../types'
import { getErrorMessage } from '../utils/errors'
import { CardSkeleton } from '@/components/ui/Skeleton'

export default function EditMetricUnitPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { currentMetricUnit, loading, filterOptions, updateMetricUnit, fetchFilterOptions } = useMetricUnitsStore()

  useEffect(() => {
    if (!filterOptions) {
      fetchFilterOptions()
    }
  }, [filterOptions, fetchFilterOptions])

  useEffect(() => {
    if (id) {
      const store = useMetricUnitsStore.getState()
      store.fetchMetricUnitById(id).catch(() => {
        toast.error('Metric unit not found')
        navigate('/metric-units')
      })
    }
  }, [id, navigate, toast])

  const handleSubmit = async (data: CreateMetricUnitDto) => {
    if (!id) return
    try {
      await updateMetricUnit(id, data)
      toast.success('Metric unit updated successfully')
      navigate('/metric-units')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error))
    }
  }

  const handleCancel = () => {
    navigate('/metric-units')
  }

  if (loading && !currentMetricUnit) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <CardSkeleton />
          <p className="mt-2 text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  if (!currentMetricUnit) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400 font-medium">Metric unit not found</p>
          <button
            onClick={() => navigate('/metric-units')}
            className="mt-4 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Back to Metric Units
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={handleCancel}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium mb-2 flex items-center gap-1"
        >
          ← Back to Metric Units
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Edit Metric Unit</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Update unit type information</p>
      </div>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm dark:shadow-gray-900/50 p-6">
        <MetricUnitForm 
          initialData={currentMetricUnit} 
          isEdit 
          onSubmit={handleSubmit} 
          isLoading={loading}
          metricTypes={filterOptions?.metric_types}
        />
        
        <button
          onClick={handleCancel}
          className="w-full mt-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 py-2 px-4 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
