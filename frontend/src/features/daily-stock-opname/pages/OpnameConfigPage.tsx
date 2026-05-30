import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Settings, Save, Loader2, Info } from 'lucide-react'
import { useBranches } from '@/features/branches/api/branches.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useOpnameConfig, useUpdateOpnameConfig } from '../api/dailyStockOpname'

// ─── VALIDATION SCHEMA ────────────────────────────────────────────────────────

const opnameConfigSchema = z.object({
  variance_threshold_pct: z.number().min(1, 'Minimal 1%').max(100, 'Maksimal 100%'),
  closing_time: z.string().regex(/^\d{2}:\d{2}$/, 'Format harus HH:mm'),
  grace_period_minutes: z.number().min(0, 'Minimal 0 menit').max(60, 'Maksimal 60 menit'),
})

type ConfigFormValues = z.infer<typeof opnameConfigSchema>

// ─── INFO BOX ─────────────────────────────────────────────────────────────────

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
      <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
      <div>{children}</div>
    </div>
  )
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function OpnameConfigPage() {
  const toast = useToast()
  const [selectedBranch, setSelectedBranch] = useState('')

  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  const { data: config, isLoading: configLoading } = useOpnameConfig(selectedBranch)
  const updateMutation = useUpdateOpnameConfig()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConfigFormValues>({
    resolver: zodResolver(opnameConfigSchema),
    defaultValues: {
      variance_threshold_pct: 15,
      closing_time: '23:59',
      grace_period_minutes: 15,
    },
  })

  useEffect(() => {
    if (config) {
      reset({
        variance_threshold_pct: config.variance_threshold_pct,
        closing_time: config.closing_time,
        grace_period_minutes: config.grace_period_minutes,
      })
    } else if (selectedBranch) {
      reset({
        variance_threshold_pct: 15,
        closing_time: '23:59',
        grace_period_minutes: 15,
      })
    }
  }, [config, selectedBranch, reset])

  const onSubmit = (values: ConfigFormValues) => {
    updateMutation.mutate(
      { branchId: selectedBranch, body: values },
      {
        onSuccess: () => toast.success('Opname config berhasil disimpan'),
        onError: (err) => toast.error(parseApiError(err, 'Gagal menyimpan config')),
      },
    )
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Opname Config</h1>
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">

            <InfoBox>
              <p className="font-semibold mb-1">Pengaturan Opname Harian</p>
              <p>
                Konfigurasi ini mengatur batas waktu input opname, toleransi variance sebelum
                session di-flag, dan grace period setelah closing time untuk konfirmasi.
              </p>
            </InfoBox>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Variance Threshold */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Variance Threshold (%)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="100"
                  {...register('variance_threshold_pct', { valueAsNumber: true })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
                {errors.variance_threshold_pct && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.variance_threshold_pct.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Jika variance melebihi threshold ini, session akan otomatis di-flag untuk review.
                </p>
              </div>

              {/* Grace Period */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Grace Period (menit)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="60"
                  {...register('grace_period_minutes', { valueAsNumber: true })}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
                {errors.grace_period_minutes && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.grace_period_minutes.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Waktu tambahan setelah closing time untuk konfirmasi opname.
                </p>
              </div>

              {/* Closing Time */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Closing Time
                </label>
                <input
                  type="time"
                  {...register('closing_time')}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
                />
                {errors.closing_time && (
                  <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.closing_time.message}</p>
                )}
                <p className="mt-1 text-xs text-gray-400">
                  Batas waktu input opname harian. Setelah waktu ini, session baru tidak bisa dibuat.
                </p>
              </div>
            </div>

            <InfoBox>
              <p className="font-semibold mb-1">Catatan</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Perubahan config hanya berlaku untuk opname yang dikonfirmasi <strong>setelah</strong> perubahan disimpan.</li>
                <li>Default: threshold 15%, closing time 23:59, grace period 15 menit.</li>
                <li>Session yang sudah di-flag tidak akan berubah status meskipun threshold diubah.</li>
              </ul>
            </InfoBox>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
              >
                {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Simpan
              </button>
            </div>
          </form>
        )
      )}
    </div>
  )
}
