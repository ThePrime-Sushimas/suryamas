import { useState } from "react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import {
  usePurchaseInvoices,
  useDeletePurchaseInvoice,
  usePurchaseInvoiceCounts,
} from "../api/purchaseInvoices.api";
import { usePurchaseInvoiceFilters } from "./usePurchaseInvoiceFilters";
import type { PurchaseInvoice } from "../api/purchaseInvoices.api";

export function usePurchaseInvoiceList() {
  const toast = useToast();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const canRelease = hasPermission("purchase_invoices", "release");
  const canUpdate = hasPermission("purchase_invoices", "update");

  const {
    filters,
    apiQuery,
    setFilters,
    setPage,
    searchInput,
    setSearchInput,
  } = usePurchaseInvoiceFilters();

  const { data, isLoading } = usePurchaseInvoices(apiQuery);
  const { data: counts } = usePurchaseInvoiceCounts();
  const deleteInvoice = useDeletePurchaseInvoice();

  const [deleteTarget, setDeleteTarget] = useState<PurchaseInvoice | null>(null);

  const invoices = data?.data ?? [];
  const pagination = data?.pagination;

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteInvoice.mutateAsync(deleteTarget.id);
      toast.success("Invoice berhasil dihapus");
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal menghapus invoice"));
    } finally {
      setDeleteTarget(null);
    }
  };

  return {
    filters,
    apiQuery,
    setFilters,
    setPage,
    searchInput,
    setSearchInput,
    invoices,
    pagination,
    isLoading,
    counts,
    canRelease,
    canUpdate,
    deleteTarget,
    setDeleteTarget,
    handleDelete,
    isDeletePending: deleteInvoice.isPending,
  };
}