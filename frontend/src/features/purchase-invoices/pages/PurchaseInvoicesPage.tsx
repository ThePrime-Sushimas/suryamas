import { useState, useMemo, type MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Search, CheckSquare, Square, ClipboardCheck, Loader2 } from "lucide-react";
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
  usePostPurchaseInvoice,
} from "../api/purchaseInvoices.api";
import { useSuppliers } from "@/features/suppliers/api/suppliers.api";
import { useBranches } from "@/features/branches/api/branches.api";
import type { PurchaseInvoice } from "../api/purchaseInvoices.api";
import { PurchaseInvoicePaymentDue } from "../components/PurchaseInvoicePaymentDue";

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

const POST_JOURNAL_DISABLED_HINT =
  "Menunggu syarat: semua QC Barang Masuk CONFIRMED dan ada output GP siap posting.";

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
  const canRelease = hasPermission("purchase_invoices", "release");
  const canUpdate = hasPermission("purchase_invoices", "update");

  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"VERIFY" | "APPROVAL" | "FINAL">(
    "VERIFY",
  );
  const [deleteTarget, setDeleteTarget] = useState<PurchaseInvoice | null>(
    null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [postingId, setPostingId] = useState<string | null>(null);

  const { data: counts } = usePurchaseInvoiceCounts();
  const { data: suppliersData } = useSuppliers();
  const { data: branchesData } = useBranches({ limit: 100 });
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
      supplier_id: supplierId || undefined,
      branch_id: branchId || undefined,
    };
  }, [page, activeTab, supplierId, branchId]);

  const { data, isLoading } = usePurchaseInvoices(queryParams);
  const deleteInvoice = useDeletePurchaseInvoice();
  const postInvoice = usePostPurchaseInvoice();

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

  const handlePostJournal = async (e: MouseEvent, inv: PurchaseInvoice) => {
    e.stopPropagation();
    if (!inv.post_journal_ready || postingId !== null) return;
    setPostingId(inv.id);
    try {
      await postInvoice.mutateAsync(inv.id);
      toast.success("Invoice berhasil di-post ke jurnal");
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal post jurnal"));
    } finally {
      setPostingId(null);
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
            {activeTab === "VERIFY" && (
              <button
                onClick={() => {
                  setIsSelectionMode(!isSelectionMode);
                  setSelectedIds([]);
                }}
                className={`p-2 rounded-lg transition-colors sm:hidden ${isSelectionMode ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                <CheckSquare className="w-5 h-5" />
              </button>
            )}
            {activeTab === "VERIFY" && selectedIds.length >= 2 && (
              <button
                onClick={handleMerge}
                disabled={mergeInvoices.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-all shadow-sm text-sm font-medium"
              >
                Gabung ({selectedIds.length})
              </button>
            )}
            {canRelease && (
              <button
                onClick={() => navigate("/inventory/purchase-invoices/new")}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm hover:shadow text-sm font-medium"
                title="Hanya role dengan izin release — untuk kasus khusus (auto-draft gagal / koreksi)"
              >
                <Plus className="w-4 h-4" />{" "}
                <span className="hidden sm:inline">Buat Manual</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters Row */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Cari nomor invoice..."
              className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          
          <select
            value={supplierId}
            onChange={e => { setSupplierId(e.target.value); setPage(1) }}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 min-w-[150px]"
          >
            <option value="">Semua Supplier</option>
            {suppliersData?.data?.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.supplier_name}
              </option>
            ))}
          </select>

          <select
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700 dark:text-gray-300 min-w-[150px]"
          >
            <option value="">Semua Cabang</option>
            {branchesData?.data?.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.branch_name}
              </option>
            ))}
          </select>
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
                        <PurchaseInvoicePaymentDue
                          info={inv.payment_due_info}
                          variant="table"
                        />
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
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {activeTab === "FINAL" &&
                            inv.status === "APPROVED" &&
                            canUpdate && (
                              <button
                                type="button"
                                onClick={(e) => handlePostJournal(e, inv)}
                                disabled={
                                  !inv.post_journal_ready ||
                                  postingId !== null
                                }
                                title={
                                  inv.post_journal_ready
                                    ? undefined
                                    : POST_JOURNAL_DISABLED_HINT
                                }
                                className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold transition-all border shadow-sm ${
                                  inv.post_journal_ready &&
                                  postingId === null
                                    ? "border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700 dark:border-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500"
                                    : "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800/80 dark:text-gray-500 cursor-not-allowed opacity-70"
                                }`}
                              >
                                {postingId === inv.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                ) : (
                                  <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                                )}
                                Post Jurnal
                              </button>
                            )}
                          {inv.status === "DRAFT" && canRelease && (
                            <button
                              onClick={() => setDeleteTarget(inv)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 transition-colors"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
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
                    onClick={() => {
                      if (isSelectionMode) {
                        toggleSelect(inv.id);
                      } else {
                        navigate(`/inventory/purchase-invoices/${inv.id}`);
                      }
                    }}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer active:bg-gray-100 dark:active:bg-gray-700/50 transition-colors relative ${selectedIds.includes(inv.id) ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}
                  >
                    {isSelectionMode && (
                      <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        {selectedIds.includes(inv.id) ? (
                          <CheckSquare className="w-5 h-5 text-indigo-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                    )}
                    <div className={`flex flex-col ${isSelectionMode ? 'pl-8' : ''}`}>
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
                    {inv.payment_due_info && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Jatuh tempo:{" "}
                        <PurchaseInvoicePaymentDue
                          info={inv.payment_due_info}
                          variant="inline"
                        />
                      </p>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-50 dark:border-gray-700/50">
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-medium mr-auto">
                        {inv.goods_receipt_count} Goods Receipt
                      </div>
                      {activeTab === "FINAL" &&
                        inv.status === "APPROVED" &&
                        canUpdate && (
                          <button
                            type="button"
                            onClick={(e) => handlePostJournal(e, inv)}
                            disabled={
                              !inv.post_journal_ready ||
                              postingId !== null
                            }
                            title={
                              inv.post_journal_ready
                                ? undefined
                                : POST_JOURNAL_DISABLED_HINT
                            }
                            className={`inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5 text-xs font-semibold transition-all border ${
                              inv.post_journal_ready &&
                              postingId === null
                                ? "border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700"
                                : "border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed opacity-70"
                            }`}
                          >
                            {postingId === inv.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                            ) : (
                              <ClipboardCheck className="w-3.5 h-3.5 shrink-0" />
                            )}
                            Post Jurnal
                          </button>
                        )}
                      {inv.status === "DRAFT" && canRelease && (
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
