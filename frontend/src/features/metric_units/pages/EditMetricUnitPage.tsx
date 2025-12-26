import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { metricUnitsApi } from '../api/metricUnits.api'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitForm } from '../components/MetricUnitForm'
import type { MetricUnit } from '../types'

export default function EditMetricUnitPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { updateMetricUnit, loading: updating } = useMetricUnitsStore()
  const [metricUnit, setMetricUnit] = useState<MetricUnit | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await metricUnitsApi.getById(id || '')
        setMetricUnit(data)
      } catch (error) {
        alert('Metric unit not found')
        navigate('/metric-units')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [id, navigate])

  const handleSubmit = async (data: any) => {
    try {
      await updateMetricUnit(id || '', data)
      alert('Metric unit updated successfully')
      navigate('/metric-units')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update metric unit')
    }
  }

  if (loading) return <div className="p-4">Loading...</div>
  if (!metricUnit) return <div className="p-4 text-red-600">Metric unit not found</div>

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Edit Metric Unit</h1>
      <MetricUnitForm initialData={metricUnit} isEdit onSubmit={handleSubmit} isLoading={updating} />
    </div>
  )
}
