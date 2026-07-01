import { useState, type MouseEvent } from "react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import {
  usePostPurchaseInvoice,
  useUnpostPurchaseInvoice,
} from "../api/purchaseInvoices.api";
import type { PurchaseInvoice, PostPurchaseInvoiceResult } from "../api/purchaseInvoices.api";

const POST_JOURNAL_DISABLED_HINT =
  "Menunggu syarat: semua QC Barang Masuk CONFIRMED dan ada output GP siap posting.";

export function usePurchaseInvoicePost() {
  const toast = useToast();
  const postInvoice = usePostPurchaseInvoice();
  const unpostInvoice = useUnpostPurchaseInvoice();

  const [postingId, setPostingId] = useState<string | null>(null);
  const [unpostTarget, setUnpostTarget] = useState<PurchaseInvoice | null>(null);

  const handlePostJournal = async (e: MouseEvent, inv: PurchaseInvoice) => {
    e.stopPropagation();
    if (!inv.post_journal_ready || postingId !== null) return;
    setPostingId(inv.id);
    try {
      const result: PostPurchaseInvoiceResult = await postInvoice.mutateAsync(inv.id);
      toast.success("Invoice berhasil di-post ke jurnal");
      const warnings = result.pricelist_sync?.warnings ?? [];
      if (warnings.length > 0) {
        const preview = warnings
          .slice(0, 3)
          .map((w) => `${w.product_name} (${w.uom_invoice}): ${w.reason}`)
          .join("; ");
        const suffix =
          warnings.length > 3 ? ` (+${warnings.length - 3} lainnya)` : "";
        toast.warning(
          `Pricelist: ${result.pricelist_sync?.synced ?? 0} diupdate, ${warnings.length} baris dilewati. ${preview}${suffix}`,
        );
      }
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal post jurnal"));
    } finally {
      setPostingId(null);
    }
  };

  const handleUnpost = async () => {
    if (!unpostTarget) return;
    try {
      await unpostInvoice.mutateAsync(unpostTarget.id);
      toast.success("Post jurnal dibatalkan — invoice kembali ke Approved");
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal batalkan post"));
    } finally {
      setUnpostTarget(null);
    }
  };

  return {
    postingId,
    unpostTarget,
    setUnpostTarget,
    handlePostJournal,
    handleUnpost,
    isPostPending: postInvoice.isPending,
    isUnpostPending: unpostInvoice.isPending,
    disabledHint: POST_JOURNAL_DISABLED_HINT,
  };
}