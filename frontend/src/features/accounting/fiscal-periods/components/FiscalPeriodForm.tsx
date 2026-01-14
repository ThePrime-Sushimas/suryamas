import { useState, useEffect } from 'react'
import { validatePeriodFormat, validateDateRange } from '../utils/validation'
import type { CreateFiscalPeriodDto, FiscalPeriod } from '../types/fiscal-period.types'

interface FiscalPeriodFormProps {
  initialData?: FiscalPeriod
  onSubmit: (dto: CreateFiscalPeriodDto) => Promise<void>
  onCancel: () => void
}

export function FiscalPeriodForm({ initialData, onSubmit, onCancel }: FiscalPeriodFormProps) {
  const [formData, setFormData] = useState<CreateFiscalPeriodDto>({
    period: '',
    period_start: '',
    period_end: '',
    is_adjustment_allowed: true,
    is_year_end: false,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (initialData) {
      setFormData({
        period: initialData.period,
        period_start: initialData.period_start,
        period_end: initialData.period_end,
        is_adjustment_allowed: initialData.is_adjustment_allowed,
        is_year_end: initialData.is_year_end,
      })
    }
  }, [initialData])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    const trimmedPeriod = formData.period.trim()

    if (!trimmedPeriod) {
      newErrors.period = 'Period is required'
    } else if (!validatePeriodFormat(trimmedPeriod)) {
      newErrors.period = 'Invalid format. Use YYYY-MM (e.g., 2024-01)'
    }

    if (!formData.period_start) {
      newErrors.period_start = 'Period start is required'
    }

    if (!formData.period_end) {
      newErrors.period_end = 'Period end is required'
    }

    if (formData.period_start && formData.period_end && !validateDateRange(formData.period_start, formData.period_end)) {
      newErrors.period_end = 'Period end must be after or equal to period start'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      await onSubmit({ ...formData, period: formData.period.trim() })
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'An error occurred' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="period" className="block text-sm font-medium text-gray-700 mb-1">
          Period <span className="text-red-500">*</span>
        </label>
        <input
          id="period"
          type="text"
          placeholder="YYYY-MM (e.g., 2024-01)"
          pattern="\d{4}-(0[1-9]|1[0-2])"
          value={formData.period}
          onChange={(e) => setFormData({ ...formData, period: e.target.value })}
          aria-invalid={!!errors.period}
          aria-describedby={errors.period ? 'period-error' : undefined}
          className={`w-full border rounded px-3 py-2 ${errors.period ? 'border-red-500' : ''}`}
        />
        {errors.period && (
          <p id="period-error" className="text-red-500 text-sm mt-1" role="alert">
            {errors.period}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="period_start" className="block text-sm font-medium text-gray-700 mb-1">
          Period Start <span className="text-red-500">*</span>
        </label>
        <input
          id="period_start"
          type="date"
          value={formData.period_start}
          onChange={(e) => setFormData({ ...formData, period_start: e.target.value })}
          aria-invalid={!!errors.period_start}
          aria-describedby={errors.period_start ? 'period-start-error' : undefined}
          className={`w-full border rounded px-3 py-2 ${errors.period_start ? 'border-red-500' : ''}`}
        />
        {errors.period_start && (
          <p id="period-start-error" className="text-red-500 text-sm mt-1" role="alert">
            {errors.period_start}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="period_end" className="block text-sm font-medium text-gray-700 mb-1">
          Period End <span className="text-red-500">*</span>
        </label>
        <input
          id="period_end"
          type="date"
          value={formData.period_end}
          onChange={(e) => setFormData({ ...formData, period_end: e.target.value })}
          aria-invalid={!!errors.period_end}
          aria-describedby={errors.period_end ? 'period-end-error' : undefined}
          className={`w-full border rounded px-3 py-2 ${errors.period_end ? 'border-red-500' : ''}`}
        />
        {errors.period_end && (
          <p id="period-end-error" className="text-red-500 text-sm mt-1" role="alert">
            {errors.period_end}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_year_end"
          checked={formData.is_year_end}
          onChange={(e) => setFormData({ ...formData, is_year_end: e.target.checked })}
          aria-checked={formData.is_year_end}
          className="rounded"
        />
        <label htmlFor="is_year_end" className="text-sm text-gray-700">
          Year End Period
        </label>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="is_adjustment_allowed"
          checked={formData.is_adjustment_allowed}
          onChange={(e) => setFormData({ ...formData, is_adjustment_allowed: e.target.checked })}
          aria-checked={formData.is_adjustment_allowed}
          className="rounded"
        />
        <label htmlFor="is_adjustment_allowed" className="text-sm text-gray-700">
          Allow Adjustments
        </label>
      </div>

      {errors.submit && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm" role="alert">
          {errors.submit}
        </div>
      )}

      <div className="flex gap-3 justify-end pt-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? (initialData ? 'Updating...' : 'Creating...') : (initialData ? 'Update Period' : 'Create Period')}
        </button>
      </div>
    </form>
  )
}
