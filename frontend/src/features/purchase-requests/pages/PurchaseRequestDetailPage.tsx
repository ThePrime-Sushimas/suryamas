import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Send,
  CheckCircle,
  Ban,
  Package,
  Printer,
  PackageCheck,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import {
  usePurchaseRequest,
  useSubmitPurchaseRequest,
  useCancelPurchaseRequest,
  type PurchaseRequestLine,
} from "../api/purchaseRequests.api";
import { PR_STATUS_CONFIG } from "../constants";
import { PrintPRModal } from "../components/PrintPRModal";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });


interface SupplierGroup {
  supplierName: string;
  supplierId: string | null;
  lines: (PurchaseRequestLine & { _origIdx: number })[];
}

export default function PurchaseRequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const canUpdate = hasPermission("purchase_requests", "update");
  const canApprove = hasPermission("purchase_requests", "approve");

  const { data: pr, isLoading } = usePurchaseRequest(id ?? "");
  const submitPR = useSubmitPurchaseRequest();
  const cancelPR = useCancelPurchaseRequest();

  const [confirmAction, setConfirmAction] = useState<
    "submit" | "cancel" | null
  >(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Group lines by supplier
  const supplierGroups = useMemo<SupplierGroup[]>(() => {
    const lines = pr?.lines ?? [];
    const groupMap = new Map<string, SupplierGroup>();

    lines.forEach((line, idx) => {
      const key = line.supplier_id ?? "__no_supplier__";
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          supplierName: line.supplier_name || "Tanpa Supplier",
          supplierId: line.supplier_id ?? null,
          lines: [],
        });
      }
      const group = groupMap.get(key)!;
      group.lines.push({ ...line, _origIdx: idx + 1 });
    });

    // Sort: named suppliers first (alphabetical), "Tanpa Supplier" last
    return Array.from(groupMap.values()).sort((a, b) => {
      if (!a.supplierId) return 1;
      if (!b.supplierId) return -1;
      return a.supplierName.localeCompare(b.supplierName);
    });
  }, [pr?.lines]);

  const handleAction = async () => {
    if (!id || !confirmAction) return;
    try {
      if (confirmAction === "submit") await submitPR.mutateAsync(id);
      else if (confirmAction === "cancel") await cancelPR.mutateAsync(id);
      toast.success(
        confirmAction === "submit"
          ? "Berhasil diajukan"
          : "Berhasil dibatalkan",
      );
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal memproses"));
    } finally {
      setConfirmAction(null);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6">
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!pr) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Purchase request tidak ditemukan</p>
      </div>
    );
  }

  const statusCfg = PR_STATUS_CONFIG[pr.status] ?? PR_STATUS_CONFIG.DRAFT;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/inventory/purchase-requests")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ClipboardList className="w-6 h-6 text-orange-600 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {pr.request_number}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusCfg.color}`}
                >
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                {pr.branch_name} — {fmtDate(pr.request_date)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 shrink-0 overflow-x-auto">
            {["DRAFT", "PENDING_APPROVAL"].includes(pr.status) && canUpdate && (
              <button
                onClick={() =>
                  navigate(`/inventory/purchase-requests/${id}/edit`)
                }
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
              >
                Edit
              </button>
            )}

            {pr.status === "DRAFT" && canUpdate && (
              <button
                onClick={() => setConfirmAction("submit")}
                className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm whitespace-nowrap"
              >
                <Send className="w-4 h-4" /> <span className="hidden sm:inline">Ajukan</span> Approval
              </button>
            )}
            {pr.status === "PENDING_APPROVAL" && canApprove && (
              <button
                onClick={() =>
                  navigate(`/inventory/purchase-requests/${id}/approve`)
                }
                className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm whitespace-nowrap"
              >
                <CheckCircle className="w-4 h-4" /> Approve
              </button>
            )}

            {["DRAFT", "PENDING_APPROVAL"].includes(pr.status) && canUpdate && (
              <button
                onClick={() => setConfirmAction("cancel")}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
              >
                <Ban className="w-4 h-4" /> Batal
              </button>
            )}

            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 whitespace-nowrap"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="px-4 sm:px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Dibutuhkan</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {pr.needed_by_date ? fmtDate(pr.needed_by_date) : "—"}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">
              Dibuat oleh
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {pr.requested_by_name || "—"}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">
              Disetujui oleh
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {pr.approved_by_name || "—"}
            </p>
          </div>

          <div>
            <span className="text-gray-500 dark:text-gray-400">Catatan</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {pr.notes || "—"}
            </p>
          </div>
        </div>
        {pr.rejected_reason && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-700 dark:text-red-300">
              <strong>Alasan Penolakan:</strong> {pr.rejected_reason}
            </p>
          </div>
        )}
      </div>

      {/* Lines Grouped by Supplier */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
        {supplierGroups.map((group) => (
          <div
            key={group.supplierId ?? "__none__"}
            className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
          >
            {/* Supplier Header */}
            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" />
                <span className="font-semibold text-gray-900 dark:text-white text-sm">
                  {group.supplierName}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({group.lines.length} item)
                </span>
                {(() => {
                  const supplierPos =
                    pr.purchase_orders?.filter(
                      (p) => p.supplier_name === group.supplierName,
                    ) ?? [];
                  const po =
                    supplierPos.find((p) => !p.is_deleted) ?? supplierPos[0];
                  if (!po) return null;
                  return (
                    <>
                      {po.is_deleted ? (
                        <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded">
                          {po.po_number} (Dihapus)
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            navigate(`/inventory/purchase-orders/${po.id}`)
                          }
                          className="px-2 py-0.5 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-100 dark:hover:bg-blue-900/50"
                        >
                          {po.po_number}
                        </button>
                      )}
                      {!po.is_deleted &&
                        ["ORDERED", "PARTIAL_RECEIVED"].includes(po.status) && (
                          <button
                            onClick={() =>
                              navigate(
                                `/inventory/goods-receipts/new?po_id=${po.id}`,
                              )
                            }
                            className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-700 rounded hover:bg-teal-100 dark:hover:bg-teal-900/50"
                          >
                            <PackageCheck className="w-3 h-3" /> Terima
                            Barang
                          </button>
                        )}
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Table */}
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 dark:bg-gray-700/30 border-b dark:border-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-12">
                    #
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Produk
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">
                    Request
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">
                    Approved
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">
                    Ordered
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-24">
                    Diterima
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-20">
                    UOM
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {group.lines.map((line) => {
                  const qtyOrdered = Number(line.qty_ordered ?? 0)
                  const qtyReceived = Number(line.qty_received ?? 0)
                  const qtyTarget = line.qty_approved ?? line.qty
                  const isFullyOrdered = qtyOrdered >= qtyTarget
                  const isFullyReceived = qtyReceived >= qtyTarget
                  return (
                    <tr
                      key={line.id ?? line._origIdx}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30"
                    >
                      <td className="px-4 py-3 text-gray-500">{line._origIdx}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {line.product_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {line.product_code}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500 dark:text-gray-400">
                        {fmt(line.qty)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {line.qty_approved != null ? (
                          <span className={line.qty_approved !== line.qty ? 'text-orange-600 dark:text-orange-400 font-medium' : 'text-gray-900 dark:text-gray-200'}>
                            {fmt(line.qty_approved)}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={isFullyOrdered ? 'text-green-600 dark:text-green-400' : qtyOrdered > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}>
                          {qtyOrdered > 0 ? fmt(qtyOrdered) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={isFullyReceived ? 'text-green-600 dark:text-green-400' : qtyReceived > 0 ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400'}>
                          {qtyReceived > 0 ? fmt(qtyReceived) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {line.uom}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleAction}
        title={confirmAction === "submit" ? "Ajukan Approval" : "Batalkan PR"}
        message={
          confirmAction === "submit"
            ? "PR akan diajukan ke Stock Keeper untuk approval. Lanjutkan?"
            : "Yakin ingin membatalkan purchase request ini?"
        }
        confirmText={confirmAction === "submit" ? "Ajukan" : "Batalkan"}
        variant={confirmAction === "cancel" ? "danger" : "success"}
        isLoading={submitPR.isPending || cancelPR.isPending}
      />

      {/* Print Modal */}
      {showPrintModal && (
        <PrintPRModal prId={id!} supplierGroups={supplierGroups} onClose={() => setShowPrintModal(false)} />
      )}
    </div>
  );
}