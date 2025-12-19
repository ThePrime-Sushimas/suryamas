import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { metricUnitService } from '@/services/metricUnitService'
import MetricUnitForm from '@/components/metric-units/MetricUnitForm'
import type { CreateMetricUnitDto } from '@/types/metricUnit'

export default function NewMetricUnitPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (dto: CreateMetricUnitDto) => {
    setSubmitting(true)
    setError('')
    try {
      await metricUnitService.create(dto)
      navigate('/metric-units')
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate('/metric-units')}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-700 mb-6"
      >
        <ArrowLeft size={20} />
        Back
      </button>

      <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Create Metric Unit</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        <MetricUnitForm onSubmit={handleSubmit} submitting={submitting} />
      </div>
    </div>
  )
}
