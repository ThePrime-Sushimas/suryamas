import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { useBranches } from '@/features/branches/api/branches.api'
import { useWarehousesByBranch } from '@/features/inventory/api/inventory.api'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useGenerateDpo, useDpoList } from '../api/dpo.queries'

const generateSchema = z.object({
  branch_id: z.string().uuid('Pilih branch'),
  prep_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal tidak valid'),
  source_warehouse_id: z.string().uuid('Pilih source warehouse'),
  target_warehouse_id: z.string().uuid('Pilih target warehouse'),
  notes: z.string().max(500).nullable().optional(),
})

type GenerateFormValues = z.infer<typeof generateSchema>

interface DpoGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onGenerated?: (id: string) => void
}

export function DpoGenerateDialog({ open, onOpenChange, onGenerated }: DpoGenerateDialogProps) {
  const toast = useToast()
  const generateMutation = useGenerateDpo()

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<GenerateFormValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: { branch_id: '', prep_date: '', source_warehouse_id: '', target_warehouse_id: '', notes: '' },
  })

  const branchId = watch('branch_id')
  const prepDate = watch('prep_date')

  const { data: branchesData } = useBranches({ limit: 100 })
  const branches = branchesData?.data ?? []

  const { data: warehouses = [] } = useWarehousesByBranch(branchId)
  const mainWarehouses = warehouses.filter((w) => w.warehouse_type === 'MAIN')
  const readyWarehouses = warehouses.filter((w) => w.warehouse_type === 'READY')

  // Check existing draft for same branch+date
  const { data: existingDrafts } = useDpoList(
    branchId && prepDate ? { branch_id: branchId, date_from: prepDate, date_to: prepDate, status: 'DRAFT' } : {},
    { enabled: Boolean(branchId && prepDate) }
  )
  const hasExistingDraft = (existingDrafts?.data?.length ?? 0) > 0

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !generateMutation.isPending) onOpenChange(false)
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [open, generateMutation.isPending, onOpenChange])

  const onSubmit = (values: GenerateFormValues) => {
    generateMutation.mutate(
      { ...values, notes: values.notes || null },
      {
        onSuccess: (data) => {
          toast.success('DPO berhasil di-generate')
          onOpenChange(false)
          onGenerated?.(data.id)
        },
        onError: (err) => {
          toast.error(parseApiError(err, 'Gagal generate DPO'))
        },
      }
    )
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70"
      style={{ pointerEvents: generateMutation.isPending ? 'none' : 'auto' }}
      onMouseDown={(e) => {
        if (!generateMutation.isPending && e.target === e.currentTarget) onOpenChange(false)
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-dialog-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <h3 id="generate-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white">
            Generate Daily Prep Order
          </h3>
          <button
            onClick={() => onOpenChange(false)}
            disabled={generateMutation.isPending}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Branch */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Branch <span className="text-red-500">*</span>
            </label>
            <select
              {...register('branch_id')}
              disabled={generateMutation.isPending}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white disabled:opacity-50"
            >
              <option value="">Pilih branch...</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.branch_name}</option>
              ))}
            </select>
            {errors.branch_id && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.branch_id.message}</p>}
          </div>

          {/* Prep Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Prep Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              {...register('prep_date')}
              disabled={generateMutation.isPending}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white disabled:opacity-50"
            />
            {errors.prep_date && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.prep_date.message}</p>}
          </div>

          {/* Source Warehouse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Source Warehouse (MAIN) <span className="text-red-500">*</span>
            </label>
            <select
              {...register('source_warehouse_id')}
              disabled={generateMutation.isPending || !branchId}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white disabled:opacity-50"
            >
              <option value="">{branchId ? 'Pilih warehouse...' : 'Pilih branch dulu'}</option>
              {mainWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.warehouse_name}</option>
              ))}
            </select>
            {errors.source_warehouse_id && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.source_warehouse_id.message}</p>}
          </div>

          {/* Target Warehouse */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Target Warehouse (READY) <span className="text-red-500">*</span>
            </label>
            <select
              {...register('target_warehouse_id')}
              disabled={generateMutation.isPending || !branchId}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white disabled:opacity-50"
            >
              <option value="">{branchId ? 'Pilih warehouse...' : 'Pilih branch dulu'}</option>
              {readyWarehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.warehouse_name}</option>
              ))}
            </select>
            {errors.target_warehouse_id && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.target_warehouse_id.message}</p>}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
            <textarea
              {...register('notes')}
              rows={2}
              maxLength={500}
              disabled={generateMutation.isPending}
              placeholder="Catatan opsional..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Existing draft warning */}
          {hasExistingDraft && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                Sudah ada DPO DRAFT untuk branch dan tanggal ini. Generate ulang akan membatalkan DPO sebelumnya.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={generateMutation.isPending}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-700 dark:text-gray-300 text-sm"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={generateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 text-sm font-medium"
            >
              {generateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {generateMutation.isPending ? 'Generating...' : 'Generate DPO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
