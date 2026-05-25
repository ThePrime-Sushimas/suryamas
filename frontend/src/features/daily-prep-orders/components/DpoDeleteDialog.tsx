import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useToast } from '@/contexts/ToastContext'
import { parseApiError } from '@/lib/errorParser'
import { useSoftDeleteDpo } from '../api/dpo.queries'

interface DpoDeleteDialogProps {
  dpoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function DpoDeleteDialog({ dpoId, open, onOpenChange, onSuccess }: DpoDeleteDialogProps) {
  const toast = useToast()
  const deleteMutation = useSoftDeleteDpo(dpoId)

  const handleConfirm = () => {
    deleteMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success('DPO berhasil dihapus')
        onOpenChange(false)
        onSuccess()
      },
      onError: (err) => {
        toast.error(parseApiError(err, 'Gagal menghapus DPO'))
      },
    })
  }

  return (
    <ConfirmModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      onConfirm={handleConfirm}
      title="Hapus DPO"
      message="DPO ini akan dihapus secara permanen. Lanjutkan?"
      variant="danger"
      confirmText="Ya, Hapus"
      cancelText="Batal"
      isLoading={deleteMutation.isPending}
    />
  )
}
