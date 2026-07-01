import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useListNavigation } from "@/lib/urlFilters";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import {
  useSubmitPurchaseInvoice,
  useApprovePurchaseInvoice,
  useRejectPurchaseInvoice,
  useDeletePurchaseInvoice,
  useUnpostPurchaseInvoice,
  useSplitPurchaseInvoice,
} from "../api/purchaseInvoices.api";
import { PURCHASE_INVOICES_LIST_PATH } from "../constants";

interface UseDetailModalsOptions {
  id: string;
  attachmentsCount: number;
  hasOverQty: boolean;
  invoiceNumber: string;
}

export function usePurchaseInvoiceDetailModals({
  id,
  attachmentsCount,
  hasOverQty,
  invoiceNumber,
}: UseDetailModalsOptions) {
  const navigate = useNavigate();
  const { backToList } = useListNavigation(PURCHASE_INVOICES_LIST_PATH);
  const toast = useToast();

  const submitPI = useSubmitPurchaseInvoice();
  const approvePI = useApprovePurchaseInvoice();
  const rejectPI = useRejectPurchaseInvoice();
  const deletePI = useDeletePurchaseInvoice();
  const unpostPI = useUnpostPurchaseInvoice();
  const splitPI = useSplitPurchaseInvoice();

  // Modal visibility
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUnpostModal, setShowUnpostModal] = useState(false);

  // Other UI state
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [confirmOverQty, setConfirmOverQty] = useState(false);

  const isStatusBusy =
    submitPI.isPending || approvePI.isPending || rejectPI.isPending;

  const handleStatusAction = async (
    action: () => Promise<unknown>,
    successMsg: string,
    onSuccess?: () => void,
  ) => {
    try {
      await action();
      toast.success(successMsg);
      onSuccess?.();
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal memproses status"));
    }
  };

  const handleSubmit = (currentStatus: string) => {
    if (isStatusBusy) return;
    if (attachmentsCount === 0) {
      toast.error("Upload minimal 1 foto invoice sebelum mengajukan.");
      return;
    }
    if (hasOverQty && !confirmOverQty) {
      toast.error(
        "Mohon centang konfirmasi selisih Qty (OVER) sebelum mengajukan.",
      );
      return;
    }
    handleStatusAction(
      () => submitPI.mutateAsync(id),
      currentStatus === "REJECTED" ? "Invoice diajukan ulang" : "Invoice diajukan",
      backToList,
    );
  };

  const handleApprove = () => {
    if (isStatusBusy) return;
    handleStatusAction(() => approvePI.mutateAsync(id), "Invoice disetujui");
  };

  const handleReject = () =>
    handleStatusAction(
      () => rejectPI.mutateAsync({ id, reason: rejectReason }),
      "Invoice ditolak",
    ).then(() => setShowRejectModal(false));

  const handleDelete = async () => {
    try {
      await deletePI.mutateAsync(id);
      toast.success("Invoice dihapus");
      backToList();
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal menghapus invoice"));
    }
  };

  const handleUnpost = async () => {
    try {
      await unpostPI.mutateAsync(id);
      toast.success("Post jurnal dibatalkan — invoice kembali ke Approved");
      setShowUnpostModal(false);
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal batalkan post"));
    }
  };

  const handleSplit = async (splits: Parameters<typeof splitPI.mutateAsync>[0]["splits"]) => {
    try {
      const result = await splitPI.mutateAsync({ id, splits });
      setShowSplitModal(false);
      toast.success(
        `${result.created_invoices.length} invoice dibuat: ${result.created_invoices
          .map((i) => i.invoice_number)
          .join(", ")}`,
      );
      navigate(`/inventory/purchase-invoices/${result.created_invoices[0].id}`);
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal memecah invoice"));
    }
  };

  return {
    // mutations (for isPending flags in UI)
    submitPI,
    approvePI,
    rejectPI,
    deletePI,
    unpostPI,
    splitPI,
    isStatusBusy,
    // modal visibility
    showRejectModal,
    setShowRejectModal,
    showSplitModal,
    setShowSplitModal,
    showDeleteModal,
    setShowDeleteModal,
    showUnpostModal,
    setShowUnpostModal,
    // other state
    previewUrl,
    setPreviewUrl,
    rejectReason,
    setRejectReason,
    confirmOverQty,
    setConfirmOverQty,
    invoiceNumber,
    // handlers
    handleSubmit,
    handleApprove,
    handleReject,
    handleDelete,
    handleUnpost,
    handleSplit,
  };
}
