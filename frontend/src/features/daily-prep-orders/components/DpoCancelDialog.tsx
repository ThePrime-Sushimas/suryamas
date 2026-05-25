import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AlertTriangle, X } from 'lucide-react'
import { useCancelDpo } from '../api/dpo.queries'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'

const cancelSchema = z.object({
  reason: z.string().min(1, 'Alasan cancel wajib diisi').max(255),
})

type CancelFormValues = z.infer<typeof cancelSchema>

interface DpoCancelDialogProps {
  dpoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const DpoCancelDialog = ({ dpoId, open, onOpenChange }: DpoCancelDialogProps) => {
  const toast = useToast()
  const cancelMutation = useCancelDpo(dpoId)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CancelFormValues>({
    resolver: zodResolver(cancelSchema),
    defaultValues: { reason: '' },
  })

  useEffect(() => {
    if (!open) {
      reset()
    }
  }, [open, reset])

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !cancelMutation.isPending) onOpenChange(false)
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [open, cancelMutation.isPending, onOpenChange])

  const onSubmit = (values: CancelFormValues) => {
    cancelMutation.mutate(
      { reason: values.reason },
      {
        onSuccess: () => {
          toast.success('DPO berhasil dibatalkan')
          onOpenChange(false)
        },
        onError: (err) => {
          toast.error(parseApiError(err, 'Gagal membatalkan DPO'))
        },
      }
    )
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70"
      style={{ pointerEvents: cancelMutation.isPending ? 'none' : 'auto' }}
      onMouseDown={(e) => {
        if (!cancelMutation.isPending && e.target === e.currentTarget) onOpenChange(false)
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" aria-hidden="true" />
            <h3 id="cancel-dialog-title" className="text-lg font-semibold text-gray-900 dark:text-white">
              Cancel DPO
            </h3>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            disabled={cancelMutation.isPending}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4">
            <label
              htmlFor="cancel-reason"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Alasan Cancel <span className="text-red-500">*</span>
            </label>
            <textarea
              id="cancel-reason"
              {...register('reason')}
              rows={3}
              maxLength={255}
              placeholder="Masukkan alasan pembatalan..."
              disabled={cancelMutation.isPending}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50 resize-none"
            />
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.reason.message}</p>
            )}
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={cancelMutation.isPending}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-gray-500 text-gray-700 dark:text-gray-300"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={cancelMutation.isPending}
              className="px-4 py-2 text-white rounded-lg disabled:opacity-50 focus:outline-none focus:ring-2 bg-red-600 hover:bg-red-700 focus:ring-red-500"
            >
              {cancelMutation.isPending ? 'Processing...' : 'Ya, Cancel DPO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
