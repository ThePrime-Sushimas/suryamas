import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { metricUnitService } from '@/services/metricUnitService'
import MetricUnitForm from '@/components/metric-units/MetricUnitForm'
import type { MetricUnit, CreateMetricUnitDto } from '@/types/metricUnit'

export default function EditMetricUnitPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<MetricUnit | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      metricUnitService.getById(id)
        .then(setData)
        .catch(err => setError(err.message))
        .finally(() => setLoading(false))
    }
  }, [id])

  const handleSubmit = async (dto: CreateMetricUnitDto) => {
    setSubmitting(true)
    setError('')
    try {
      await metricUnitService.update(id!, dto)
      navigate('/metric-units')
    } catch (err: any) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="text-center py-8">Loading...</div>

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Edit Metric Unit</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200 rounded-lg">
            {error}
          </div>
        )}

        {data && <MetricUnitForm initial={data} onSubmit={handleSubmit} submitting={submitting} />}
      </div>
    </div>
  )
}
