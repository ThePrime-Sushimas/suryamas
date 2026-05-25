import { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Settings, Save, Loader2, HelpCircle, Info } from 'lucide-react'
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

// ─── TOOLTIP COMPONENT ────────────────────────────────────────────────────────

function Tooltip({ content }: { content: string }) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<'top' | 'bottom'>('top')
  const triggerRef = useRef<HTMLButtonElement>(null)

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos(rect.top < 160 ? 'bottom' : 'top')
    }
    setVisible(true)
  }

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setVisible(false)}
        onFocus={handleMouseEnter}
        onBlur={() => setVisible(false)}
        className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors ml-1 align-middle"
        aria-label="Bantuan"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {visible && (
        <span
          className={`absolute z-50 w-72 rounded-lg bg-gray-900 dark:bg-gray-700 text-white text-xs leading-relaxed px-3 py-2.5 shadow-xl pointer-events-none
            left-1/2 -translate-x-1/2
            ${pos === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          role="tooltip"
        >
          {content}
          <span
            className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent
              ${pos === 'top' ? 'top-full border-t-gray-900 dark:border-t-gray-700' : 'bottom-full border-b-gray-900 dark:border-b-gray-700'}`}
          />
        </span>
      )}
    </span>
  )
}

// ─── INFO BOX ─────────────────────────────────────────────────────────────────

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 leading-relaxed">
      <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
      <div>{children}</div>
    </div>
  )
}

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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">

            {/* Cara kerja sistem */}
            <InfoBox>
              <p className="font-semibold mb-1">Cara kerja forecast DPO</p>
              <p>
                Sistem menghitung kebutuhan bahan berdasarkan rata-rata penjualan historis, lalu
                mengalikannya dengan jumlah hari yang ingin dicakup. Hasilnya dikurangi stok yang
                sudah ada di gudang <em>Ready</em> untuk mendapat jumlah yang perlu diambil dari
                gudang <em>Main</em>.
              </p>
              <p className="mt-1.5 font-mono bg-blue-100 dark:bg-blue-900/40 rounded px-2 py-1 text-blue-900 dark:text-blue-200">
                Prediksi = (Avg7d × W7d + Avg30d × W30d + AvgDOW × WDOW) × Coverage × HolidayFactor
              </p>
              <p className="mt-1.5">
                <strong>Qty Ambil</strong> = max(0, Prediksi − Stok Ready)
              </p>
            </InfoBox>

            {/* Bobot rata-rata */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Bobot Rata-rata Penjualan
                  <Tooltip content="Ketiga bobot ini menentukan seberapa besar pengaruh masing-masing periode historis terhadap prediksi. Jumlah ketiganya HARUS tepat = 1,00. Contoh: 0.50 + 0.30 + 0.20 = 1.00" />
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Total:</span>
                  <span className={`text-sm font-mono font-bold ${isWeightValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {weightSum.toFixed(2)}
                  </span>
                  {!isWeightValid && <span className="text-xs text-red-500">(harus = 1.00)</span>}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <NumberField
                  label={<>Weight 7d <Tooltip content="Bobot untuk rata-rata penjualan 7 hari terakhir (periode pendek). Nilai tinggi = lebih responsif terhadap tren terkini. Rentang: 0–1." /></>}
                  error={errors.weight_7d?.message}
                  {...register('weight_7d', { valueAsNumber: true })}
                  step="0.01" min="0" max="1"
                />
                <NumberField
                  label={<>Weight 30d <Tooltip content="Bobot untuk rata-rata penjualan 30 hari terakhir (periode panjang). Nilai tinggi = lebih stabil, tidak mudah terpengaruh fluktuasi harian. Rentang: 0–1." /></>}
                  error={errors.weight_30d?.message}
                  {...register('weight_30d', { valueAsNumber: true })}
                  step="0.01" min="0" max="1"
                />
                <NumberField
                  label={<>Weight DOW <Tooltip content="Bobot untuk rata-rata penjualan di hari yang sama dalam seminggu (Day of Week). Contoh: jika DPO untuk Senin, ini adalah rata-rata semua hari Senin historis. Berguna untuk bisnis dengan pola mingguan yang kuat. Rentang: 0–1." /></>}
                  error={errors.weight_dow?.message}
                  {...register('weight_dow', { valueAsNumber: true })}
                  step="0.01" min="0" max="1"
                />
              </div>
            </div>

            {/* Parameter operasional */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
                Parameter Operasional
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <NumberField
                  label={<>Coverage Days <Tooltip content="Berapa hari ke depan yang ingin dicakup oleh satu DPO. Contoh: 1.5 berarti stok untuk 1,5 hari operasional. Nilai lebih besar = ambil lebih banyak sekaligus, cocok jika pengiriman dari gudang Main tidak setiap hari. Rentang: 0.5–7 hari." /></>}
                  error={errors.coverage_days?.message}
                  {...register('coverage_days', { valueAsNumber: true })}
                  step="0.5" min="0.5" max="7"
                />
                <NumberField
                  label={<>Holiday Factor <Tooltip content="Pengali otomatis yang diterapkan saat ada hari libur nasional dalam 2 hari ke depan dari tanggal DPO. Contoh: 1.5 berarti prediksi dikalikan 1.5× (naik 50%) untuk mengantisipasi lonjakan penjualan saat libur. Rentang: 1–3." /></>}
                  error={errors.holiday_factor?.message}
                  {...register('holiday_factor', { valueAsNumber: true })}
                  step="0.1" min="1" max="3"
                />
                <NumberField
                  label={<>Lookback Short (hari) <Tooltip content="Jumlah hari ke belakang untuk menghitung rata-rata jangka pendek (Weight 7d). Default 7 hari. Bisa diubah ke 5–14 hari sesuai kebutuhan. Rentang: 3–14 hari." /></>}
                  error={errors.lookback_days_short?.message}
                  {...register('lookback_days_short', { valueAsNumber: true })}
                  step="1" min="3" max="14"
                />
                <NumberField
                  label={<>Lookback Long (hari) <Tooltip content="Jumlah hari ke belakang untuk menghitung rata-rata jangka panjang (Weight 30d). Default 30 hari. Nilai lebih besar memberikan baseline yang lebih stabil. Rentang: 14–90 hari." /></>}
                  error={errors.lookback_days_long?.message}
                  {...register('lookback_days_long', { valueAsNumber: true })}
                  step="1" min="14" max="90"
                />
              </div>
            </div>

            {/* Catatan penting */}
            <InfoBox>
              <p className="font-semibold mb-1">Catatan penting</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Config ini <strong>wajib diisi</strong> sebelum bisa generate DPO untuk branch tersebut.</li>
                <li>Hanya produk yang <strong>pernah terjual</strong> di branch ini yang akan muncul di DPO. Produk baru tanpa histori penjualan tidak akan ter-include secara otomatis.</li>
                <li>Hari libur nasional dikelola di menu <strong>Hari Libur</strong> dan berlaku untuk semua branch.</li>
                <li>Perubahan config hanya berlaku untuk DPO yang di-generate <strong>setelah</strong> perubahan disimpan. DPO yang sudah ada tidak terpengaruh.</li>
              </ul>
            </InfoBox>

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
function NumberField({ label, error, ...props }: { label: React.ReactNode; error?: string } & any) {
  return (
    <div>
      <label className="flex items-center text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
      <input
        type="number"
        {...props}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white"
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
