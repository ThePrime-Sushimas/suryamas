import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Settings, Save, Loader2 } from 'lucide-react'
import { useBranches } from '@/features/branches/api/branches.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useDpoForecastConfig, useUpsertDpoForecastConfig } from '../api/dailyPrepOrders.api'

const forecastConfigSchema = z.object({
  branch_id: z.string().uuid(),
  weight_7d: z.number().min(0).max(1),
  weight_30d: z.number().min(0).max(1),
  weight_dow: z.number().min(0).max(1),
  coverage_days: z.number().min(0.5).max(7),
  holiday_factor: z.number().min(1).max(3),
  lookback_days_short: z.number().int().min(3).max(14).optional(),
  lookback_days_long: z.number().int().min(14).max(90).optional(),
}).refine(
  (d) => Math.abs(d.weight_7d + d.weight_30d + d.weight_dow - 1.0) < 0.001,
  { message: 'Total bobot harus = 1.00', path: ['weight_7d'] }
)

type ConfigFormValues = z.infer<typeof forecastConfigSchema>

export default function DpoConfigPage() {
  const toast = useToast()
  const [selectedBranch, setSelectedBranch] = useState('')

  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  const { data: config, isLoading: configLoading } = useDpoForecastConfig(selectedBranch)
  const upsertMutation = useUpsertDpoForecastConfig()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(forecastConfigSchema),
    defaultValues: {
      branch_id: '',
      weight_7d: 0.5,
      weight_30d: 0.3,
      weight_dow: 0.2,
      coverage_days: 1.5,
      holiday_factor: 1.5,
      lookback_days_short: 7,
      lookback_days_long: 30,
    },
  })

  const weight7d = watch('weight_7d')
  const weight30d = watch('weight_30d')
  const weightDow = watch('weight_dow')
  const weightSum = (weight7d || 0) + (weight30d || 0) + (weightDow || 0)
  const isWeightValid = Math.abs(weightSum - 1.0) < 0.001

  useEffect(() => {
    if (config) {
      reset({
        branch_id: selectedBranch,
        weight_7d: config.weight_7d,
        weight_30d: config.weight_30d,
        weight_dow: config.weight_dow,
        coverage_days: config.coverage_days,
        holiday_factor: config.holiday_factor,
        lookback_days_short: config.lookback_days_short,
        lookback_days_long: config.lookback_days_long,
      })
    } else if (selectedBranch) {
      setValue('branch_id', selectedBranch)
    }
  }, [config, selectedBranch, reset, setValue])

  const onSubmit = (values: ConfigFormValues) => {
    upsertMutation.mutate(values, {
      onSuccess: () => toast.success('Forecast config berhasil disimpan'),
      onError: (err) => toast.error(parseApiError(err, 'Gagal menyimpan config')),
    })
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Forecast Config</h1>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Branch</label>
        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
        >
          <option value="">Pilih branch...</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.branch_name}</option>
          ))}
        </select>
      </div>

      {selectedBranch && (
        configLoading ? (
          <div className="flex items-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-sm text-gray-500">Loading config...</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-300">Total bobot:</span>
              <span className={`text-sm font-mono font-bold ${isWeightValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {weightSum.toFixed(2)}
              </span>
              {!isWeightValid && <span className="text-xs text-red-500">(harus = 1.00)</span>}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <NumberField label="Weight 7d" error={errors.weight_7d?.message} {...register('weight_7d', { valueAsNumber: true })} step="0.01" min="0" max="1" />
              <NumberField label="Weight 30d" error={errors.weight_30d?.message} {...register('weight_30d', { valueAsNumber: true })} step="0.01" min="0" max="1" />
              <NumberField label="Weight DOW" error={errors.weight_dow?.message} {...register('weight_dow', { valueAsNumber: true })} step="0.01" min="0" max="1" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <NumberField label="Coverage Days" error={errors.coverage_days?.message} {...register('coverage_days', { valueAsNumber: true })} step="0.5" min="0.5" max="7" />
              <NumberField label="Holiday Factor" error={errors.holiday_factor?.message} {...register('holiday_factor', { valueAsNumber: true })} step="0.1" min="1" max="3" />
              <NumberField label="Lookback Short (days)" error={errors.lookback_days_short?.message} {...register('lookback_days_short', { valueAsNumber: true })} step="1" min="3" max="14" />
              <NumberField label="Lookback Long (days)" error={errors.lookback_days_long?.message} {...register('lookback_days_long', { valueAsNumber: true })} step="1" min="14" max="90" />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={upsertMutation.isPending || !isWeightValid}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan
              </button>
            </div>
          </form>
        )
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NumberField({ label, error, ...props }: { label: string; error?: string } & any) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        {...props}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
