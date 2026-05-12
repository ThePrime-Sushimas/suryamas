import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Send,
  CheckCircle,
  Ban,
  Package,
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
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/inventory/purchase-requests")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ClipboardList className="w-6 h-6 text-orange-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {pr.request_number}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {pr.branch_name} — {fmtDate(pr.request_date)}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}
            >
              {statusCfg.label}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {["DRAFT", "PENDING_APPROVAL"].includes(pr.status) && canUpdate && (
              <button
                onClick={() =>
                  navigate(`/inventory/purchase-requests/${id}/edit`)
                }
                className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Edit
              </button>
            )}

            {pr.status === "DRAFT" && canUpdate && (
              <button
                onClick={() => setConfirmAction("submit")}
                className="flex items-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <span className="flex items-center gap-1">
                  <Send className="w-4 h-4" /> Ajukan Approval
                </span>
              </button>
            )}
            {pr.status === "PENDING_APPROVAL" && canApprove && (
              <button
                onClick={() =>
                  navigate(`/inventory/purchase-requests/${id}/approve`)
                }
                className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                <CheckCircle className="w-4 h-4" /> Review & Approve
              </button>
            )}

            {["DRAFT", "PENDING_APPROVAL"].includes(pr.status) && canUpdate && (
              <button
                onClick={() => setConfirmAction("cancel")}
                className="flex items-center gap-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Ban className="w-4 h-4" /> Batalkan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
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
      <div className="flex-1 overflow-auto p-6 space-y-4">
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
                    Qty
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase w-20">
                    UOM
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {group.lines.map((line) => (
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
                    <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                      {fmt(line.qty)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {line.uom}
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}
