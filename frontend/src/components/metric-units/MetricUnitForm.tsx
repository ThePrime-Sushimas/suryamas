import { useState, useEffect } from 'react'
import type { CreateMetricUnitDto, MetricType } from '@/types/metricUnit'

const METRIC_TYPES: MetricType[] = ['Unit', 'Volume', 'Weight']

interface MetricUnitFormProps {
  initial?: Partial<CreateMetricUnitDto>
  onSubmit: (dto: CreateMetricUnitDto) => void
  submitting?: boolean
}

export default function MetricUnitForm({ initial, onSubmit, submitting }: MetricUnitFormProps) {
  const [form, setForm] = useState<CreateMetricUnitDto>({
    metric_type: (initial?.metric_type as MetricType) ?? 'Unit',
    unit_name: initial?.unit_name ?? '',
    notes: initial?.notes ?? '',
    is_active: initial?.is_active ?? true,
  })

  useEffect(() => {
    if (initial) {
      setForm(f => ({
        metric_type: (initial.metric_type as MetricType) ?? f.metric_type,
        unit_name: initial.unit_name ?? '',
        notes: initial.notes ?? '',
        is_active: initial.is_active ?? true,
      }))
    }
  }, [initial])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!METRIC_TYPES.includes(form.metric_type)) {
      alert('Invalid metric type')
      return
    }
    if (!form.unit_name.trim() || form.unit_name.length > 100) {
      alert('Unit name is required and must be ≤ 100 chars')
      return
    }
    onSubmit({ ...form, notes: form.notes?.trim() || '' })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Metric Type *</span>
        <select
          value={form.metric_type}
          onChange={e => setForm({ ...form, metric_type: e.target.value as MetricType })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          required
        >
          {METRIC_TYPES.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit Name *</span>
        <input
          type="text"
          value={form.unit_name}
          onChange={e => setForm({ ...form, unit_name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          required
          maxLength={100}
          placeholder="e.g., Piece, Kilogram, Liter"
        />
      </label>

      <label className="block">
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</span>
        <textarea
          value={form.notes ?? ''}
          onChange={e => setForm({ ...form, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          rows={3}
          placeholder="Additional notes..."
        />
      </label>

      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={!!form.is_active}
          onChange={e => setForm({ ...form, is_active: e.target.checked })}
          className="rounded"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">Active</span>
      </label>

      <button
        type="submit"
        disabled={submitting}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
      >
        {submitting ? 'Saving...' : 'Save'}
      </button>
    </form>
  )
}
