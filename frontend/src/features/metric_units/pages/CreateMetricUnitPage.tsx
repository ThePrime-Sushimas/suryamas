import { useNavigate } from 'react-router-dom'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitForm } from '../components/MetricUnitForm'
import { useToast } from '@/contexts/ToastContext'
import type { CreateMetricUnitDto } from '../types'

export default function CreateMetricUnitPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const { createMetricUnit, loading, filterOptions } = useMetricUnitsStore()

  const handleSubmit = async (data: CreateMetricUnitDto) => {
    try {
      await createMetricUnit(data)
      toast.success('Metric unit created successfully')
      navigate('/metric-units')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create metric unit')
    }
  }

  const handleCancel = () => {
    navigate('/metric-units')
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <button
          onClick={handleCancel}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 flex items-center gap-1"
        >
          ← Back to Metric Units
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Create Metric Unit</h1>
        <p className="text-gray-600 mt-1">Add a new unit type for measurements</p>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm p-6">
        <MetricUnitForm 
          onSubmit={handleSubmit} 
          isLoading={loading}
          metricTypes={filterOptions?.metric_types}
        />
        
        <button
          onClick={handleCancel}
          className="w-full mt-4 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
