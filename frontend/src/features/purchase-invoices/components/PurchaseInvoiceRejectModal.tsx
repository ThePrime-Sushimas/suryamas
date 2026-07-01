import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { FormField } from "@/components/ui/FormField";

interface PurchaseInvoiceRejectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  rejectReason: string;
  onRejectReasonChange: (value: string) => void;
  isLoading: boolean;
}

export function PurchaseInvoiceRejectModal({
  isOpen,
  onClose,
  onConfirm,
  rejectReason,
  onRejectReasonChange,
  isLoading,
}: PurchaseInvoiceRejectModalProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      preventClose={isLoading}
    >
      <Dialog.Header>Tolak Invoice</Dialog.Header>

      <Dialog.Body>
        <FormField
          label="Alasan penolakan"
          helperText="Berikan alasan agar tim finance dapat merevisi invoice ini."
        >
          <Textarea
            value={rejectReason}
            onChange={(e) => onRejectReasonChange(e.target.value)}
            placeholder="Alasan penolakan..."
            rows={3}
          />
        </FormField>
      </Dialog.Body>

      <Dialog.Footer>
        <Button variant="ghost" onClick={onClose} disabled={isLoading}>
          Batal
        </Button>
        <Button
          variant="danger"
          loading={isLoading}
          onClick={onConfirm}
        >
          Tolak Invoice
        </Button>
      </Dialog.Footer>
    </Dialog>
  );
}
