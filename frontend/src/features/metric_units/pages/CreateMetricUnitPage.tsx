import { useNavigate } from 'react-router-dom'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitForm } from '../components/MetricUnitForm'

export default function CreateMetricUnitPage() {
  const navigate = useNavigate()
  const { createMetricUnit, loading } = useMetricUnitsStore()

  const handleSubmit = async (data: any) => {
    try {
      await createMetricUnit(data)
      alert('Metric unit created successfully')
      navigate('/metric-units')
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to create metric unit')
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Create Metric Unit</h1>
      <MetricUnitForm onSubmit={handleSubmit} isLoading={loading} />
    </div>
  )
}
