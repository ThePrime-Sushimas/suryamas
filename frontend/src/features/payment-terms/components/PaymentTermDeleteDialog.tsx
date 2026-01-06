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
  isLoading = false
}: PaymentTermDeleteDialogProps) => {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={isRestore ? 'Restore Payment Term' : 'Delete Payment Term'}
      message={
        isRestore
          ? `Are you sure you want to restore "${termName}"? This will make it available for use again.`
          : `Are you sure you want to delete "${termName}"? This action can be reversed later.`
      }
      confirmText={isRestore ? 'Restore' : 'Delete'}
      variant={isRestore ? 'info' : 'danger'}
      isLoading={isLoading}
    />
  )
}
