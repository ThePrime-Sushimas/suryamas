import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { Pagination } from "@/components/ui/Pagination";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import {
  usePurchaseInvoices,
  useDeletePurchaseInvoice,
  usePurchaseInvoiceCounts,
  useMergePurchaseInvoices,
} from "../api/purchaseInvoices.api";
import type { PurchaseInvoice } from "../api/purchaseInvoices.api";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(v);

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  DRAFT: {
    label: "Draft",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  },
  SUBMITTED: {
    label: "Submitted",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  APPROVED: {
    label: "Approved",
    color:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
  POSTED: {
    label: "Posted",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  },
};

export default function PurchaseInvoicesPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const canInsert = hasPermission("purchase_invoices", "insert");
  const canDelete = hasPermission("purchase_invoices", "delete");

  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"VERIFY" | "APPROVAL" | "FINAL">(
    "VERIFY",
  );
  const [deleteTarget, setDeleteTarget] = useState<PurchaseInvoice | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: counts } = usePurchaseInvoiceCounts();
  const mergeInvoices = useMergePurchaseInvoices();

  const queryParams = useMemo(() => {
    let status = undefined;
    if (activeTab === "VERIFY") status = "DRAFT,REJECTED";
    if (activeTab === "APPROVAL") status = "SUBMITTED";
    if (activeTab === "FINAL") status = "APPROVED,POSTED";

    return {
      page,
      limit: 25,
      status,
    };
  }, [page, activeTab]);

  const { data, isLoading } = usePurchaseInvoices(queryParams);
  const deleteInvoice = useDeletePurchaseInvoice();

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

  const handleMerge = async () => {
    if (selectedIds.length < 2) return;
    try {
      const result = await mergeInvoices.mutateAsync(selectedIds);
      toast.success("Invoice berhasil digabung");
      setSelectedIds([]);
      navigate(`/inventory/purchase-invoices/${result.id}`);
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal menggabungkan invoice"));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <FileText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
                Verifikasi Invoice
              </h1>
              <p className="text-xs lg:text-sm text-gray-500 dark:text-gray-400">
                {pagination?.total ?? 0} invoice terdaftar
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "VERIFY" && selectedIds.length >= 2 && (
              <button
                onClick={handleMerge}
                disabled={mergeInvoices.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all shadow-sm text-sm font-medium"
              >
                Gabung ({selectedIds.length})
              </button>
            )}
            {canInsert && (
              <button
                onClick={() => navigate("/inventory/purchase-invoices/new")}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow text-sm font-medium"
              >
                <Plus className="w-4 h-4" />{" "}
                <span className="hidden sm:inline">Buat Manual</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6">
        <div className="flex items-center gap-6 lg:gap-8 overflow-x-auto no-scrollbar">
          {[
            {
              id: "VERIFY",
              label: "Antrean Verifikasi",
              count: counts?.verify_count,
              color: "indigo",
            },
            {
              id: "APPROVAL",
              label: "Menunggu Persetujuan",
              count: counts?.approval_count,
              color: "amber",
            },
            {
              id: "FINAL",
              label: "Selesai & Posting",
              count: counts?.final_count,
              color: "green",
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setPage(1);
                setSelectedIds([]);
              }}
              className={`py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? `border-${tab.color}-600 text-${tab.color}-600 dark:border-${tab.color}-400 dark:text-${tab.color}-400`
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] ${
                    activeTab === tab.id
                      ? `bg-${tab.color}-100 text-${tab.color}-700 dark:bg-${tab.color}-900/30`
                      : "bg-gray-100 text-gray-600 dark:bg-gray-700"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
                <tr>
                  {activeTab === "VERIFY" && (
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" disabled />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    No. Invoice
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Cabang
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Jatuh Tempo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={8} className="px-4 py-4">
                        <div className="h-4 bg-gray-100 dark:bg-gray-700/50 rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                ) : invoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-gray-400 dark:text-gray-500"
                    >
                      Tidak ada invoice ditemukan
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() =>
                        navigate(`/inventory/purchase-invoices/${inv.id}`)
                      }
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group ${selectedIds.includes(inv.id) ? "bg-indigo-50/50 dark:bg-indigo-900/10" : ""}`}
                    >
                      {activeTab === "VERIFY" && (
                        <td
                          className="px-4 py-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(inv.id)}
                            onChange={() => toggleSelect(inv.id)}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {inv.invoice_number}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {inv.goods_receipt_count} GR
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {inv.supplier_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {inv.branch_name}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {fmtDate(inv.invoice_date)}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {inv.due_date ? fmtDate(inv.due_date) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                        {fmtCurrency(Number(inv.total_amount))}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${STATUS_CONFIG[inv.status].color}`}
                        >
                          {STATUS_CONFIG[inv.status].label}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {inv.status === "DRAFT" && canDelete && (
                          <button
                            onClick={() => setDeleteTarget(inv)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 transition-colors"
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-24 bg-gray-100 dark:bg-gray-700/50 rounded-xl animate-pulse"
                  />
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="px-4 py-12 text-center text-gray-400 dark:text-gray-500">
                Tidak ada invoice ditemukan
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() =>
                      navigate(`/inventory/purchase-invoices/${inv.id}`)
                    }
                    className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer active:bg-gray-100 dark:active:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 dark:text-white truncate">
                          {inv.invoice_number}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {inv.supplier_name}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider shrink-0 ${STATUS_CONFIG[inv.status].color}`}
                      >
                        {STATUS_CONFIG[inv.status].label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <div className="flex items-center gap-2">
                        <span>{fmtDate(inv.invoice_date)}</span>
                        <span>·</span>
                        <span>{inv.branch_code}</span>
                      </div>
                      <div className="font-bold text-gray-900 dark:text-white">
                        {fmtCurrency(Number(inv.total_amount))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700/50">
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-medium">
                        {inv.goods_receipt_count} Goods Receipt
                      </div>
                      {inv.status === "DRAFT" && canDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(inv);
                          }}
                          className="text-xs text-red-500 font-medium px-2 py-1"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="mt-4">
            <Pagination
              pagination={pagination}
              onPageChange={setPage}
              onLimitChange={() => {}}
              currentLength={invoices.length}
              loading={isLoading}
            />
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Invoice"
        message={`Yakin ingin menghapus invoice "${deleteTarget?.invoice_number}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        variant="danger"
        isLoading={deleteInvoice.isPending}
      />
    </div>
  );
}
