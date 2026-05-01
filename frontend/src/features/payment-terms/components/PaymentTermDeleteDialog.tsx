import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface PaymentTermDeleteDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  termName: string
  isRestore?: boolean
  isLoading?: boolean
}

export const PaymentTermDeleteDialog = ({
  isOpen,
  onClose,
  onConfirm,
  termName,
  isRestore = false,
  isLoading = false,
}: PaymentTermDeleteDialogProps) => {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={isRestore ? 'Pulihkan Syarat Pembayaran' : 'Hapus Syarat Pembayaran'}
      message={
        isRestore
          ? `Yakin ingin memulihkan "${termName}"? Syarat ini akan dapat digunakan kembali.`
          : `Yakin ingin menghapus "${termName}"? Tindakan ini dapat dibatalkan nanti.`
      }
      confirmText={isRestore ? 'Pulihkan' : 'Hapus'}
      variant={isRestore ? 'success' : 'danger'}
      isLoading={isLoading}
    />
  )
}
