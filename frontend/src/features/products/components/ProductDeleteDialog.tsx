import { ConfirmModal } from '@/components/ui/ConfirmModal'

interface ProductDeleteDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  productName: string
  isLoading?: boolean
}

export const ProductDeleteDialog = ({
  isOpen,
  onClose,
  onConfirm,
  productName,
  isLoading = false
}: ProductDeleteDialogProps) => {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Delete Product"
      message={`Are you sure you want to delete "${productName}"? This action can be reversed later.`}
      confirmText="Delete"
      variant="danger"
      isLoading={isLoading}
    />
  )
}
