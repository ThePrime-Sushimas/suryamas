import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMetricUnitsStore } from '../store/metricUnits.store'
import { MetricUnitTable } from '../components/MetricUnitTable'

export default function MetricUnitsPage() {
  const navigate = useNavigate()
  const { metricUnits, loading, fetchMetricUnits, deleteMetricUnit } = useMetricUnitsStore()

  useEffect(() => {
    fetchMetricUnits(1, 1000)
  }, [])

  const handleDelete = async (id: string) => {
    if (confirm('Delete this metric unit?')) {
      try {
        await deleteMetricUnit(id)
      } catch (error) {
        console.error('Delete failed')
      }
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Metric Units</h1>
        <button onClick={() => navigate('/metric-units/new')} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Add Metric Unit
        </button>
      </div>
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <MetricUnitTable metricUnits={metricUnits} onEdit={id => navigate(`/metric-units/${id}/edit`)} onDelete={handleDelete} />
      )}
    </div>
  )
}
