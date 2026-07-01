import { useState, useEffect } from "react";
import { useListNavigation } from "@/lib/urlFilters";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { useMergePurchaseInvoices } from "../api/purchaseInvoices.api";
import { PURCHASE_INVOICES_LIST_PATH } from "../constants";

export function usePurchaseInvoiceSelection(activeTab: string) {
  const { openDetail } = useListNavigation(PURCHASE_INVOICES_LIST_PATH);
  const toast = useToast();
  const mergeInvoices = useMergePurchaseInvoices();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Reset selection whenever the active tab changes — selected IDs from one
  // tab are irrelevant (and potentially misleading) in another tab.
  useEffect(() => {
    setSelectedIds([]);
    setIsSelectionMode(false);
  }, [activeTab]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleMerge = async () => {
    if (selectedIds.length < 2) return;
    try {
      const result = await mergeInvoices.mutateAsync(selectedIds);
      toast.success("Invoice berhasil digabung");
      setSelectedIds([]);
      openDetail(`/inventory/purchase-invoices/${result.id}`);
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal menggabungkan invoice"));
    }
  };

  return {
    selectedIds,
    isSelectionMode,
    setIsSelectionMode,
    toggleSelect,
    handleMerge,
    isMergePending: mergeInvoices.isPending,
  };
}