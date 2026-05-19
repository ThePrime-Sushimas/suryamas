import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  XCircle,
  Send,
  Trash2,
  Edit,
  AlertCircle,
  ClipboardCheck,
  Paperclip,
  ExternalLink,
  Image,
  Plus,
  Loader2,
  Package,
} from "lucide-react";
import api from "@/lib/axios";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import {
  usePurchaseInvoice,
  useSubmitPurchaseInvoice,
  useApprovePurchaseInvoice,
  useRejectPurchaseInvoice,
  usePostPurchaseInvoice,
  useDeletePurchaseInvoice,
  usePurchaseInvoiceAttachments,
} from "../api/purchaseInvoices.api";
import { useEffect } from "react";

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(v);

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: any }
> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  SUBMITTED: {
    label: "Submitted",
    color: "bg-blue-100 text-blue-700",
    icon: Send,
  },
  APPROVED: {
    label: "Approved",
    color: "bg-indigo-100 text-indigo-700",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  POSTED: { label: "Posted", color: "bg-green-100 text-green-700", icon: ClipboardCheck },
};

const GP_LINE_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  PENDING: { label: "Menunggu", color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300" },
  PROCESSING: { label: "Diproses", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  CONFIRMED: { label: "Selesai", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-blue-300" },
  REJECTED: { label: "Ditolak", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};

function normalizeGpLineStatus(status: string): string {
  return status === "QC_REVIEW" ? "PROCESSING" : status
}

const fmtQty = (n: number) => new Intl.NumberFormat("id-ID").format(n);

const FILE_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Invoice",
  DELIVERY_NOTE: "Delivery Note",
  SURAT_JALAN: "Surat Jalan",
  PHOTO_BARANG: "Foto Barang",
  OTHER: "Lainnya",
};

function AttachmentThumbnail({
  filePath,
  isImage,
  onClick,
}: {
  filePath: string;
  isImage: boolean;
  onClick?: (url: string) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isImage) {
      api
        .get("/storage/signed-url", {
          params: { path: filePath, bucket: "invoices" },
        })
        .then((res) => setUrl(res.data.data.url))
        .catch(() => {});
    }
  }, [filePath, isImage]);

  if (!isImage) {
    return (
      <div className="w-12 h-12 flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">
        <FileText className="w-6 h-6 text-red-500" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="w-12 h-12 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
        <Image className="w-5 h-5 text-gray-400" />
      </div>
    );
  }

  return (
    <div
      className="group relative cursor-zoom-in"
      onClick={() => url && onClick?.(url)}
    >
      <img
        src={url}
        alt="thumbnail"
        className="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm transition-transform group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
        <ExternalLink className="w-3 h-3 text-white" />
      </div>
    </div>
  );
}

export default function PurchaseInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const canApprove = hasPermission("purchase_invoices", "approve");
  const canDelete = hasPermission("purchase_invoices", "delete");

  const { data: inv, isLoading } = usePurchaseInvoice(id ?? "");
  const { data: attachments } = usePurchaseInvoiceAttachments(id ?? "");
  const submitPI = useSubmitPurchaseInvoice();
  const approvePI = useApprovePurchaseInvoice();
  const rejectPI = useRejectPurchaseInvoice();
  const postPI = usePostPurchaseInvoice();
  const deletePI = useDeletePurchaseInvoice();

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirmOverQty, setConfirmOverQty] = useState(false);

  if (isLoading)
    return <div className="p-8 text-center">Loading detail...</div>;
  if (!inv)
    return (
      <div className="p-8 text-center text-gray-500">
        Invoice tidak ditemukan
      </div>
    );

  const hasOverQty = inv.lines.some((l: any) => l.match_status === "OVER");

  const gpLineAudits = inv.gp_line_audits;
  const gpAuditsByDoc = new Map<string, typeof gpLineAudits>();
  for (const row of gpLineAudits) {
    const arr = gpAuditsByDoc.get(row.processing_number) ?? [];
    arr.push(row);
    gpAuditsByDoc.set(row.processing_number, arr);
  }

  const allGpLinesConfirmed =
    gpLineAudits.length > 0 &&
    gpLineAudits.every((a) => a.gp_line_status === "CONFIRMED");
  const hasUnconfirmedGp =
    gpLineAudits.length > 0 &&
    gpLineAudits.some((a) => a.gp_line_status !== "CONFIRMED");

  const isStatusBusy =
    submitPI.isPending ||
    approvePI.isPending ||
    postPI.isPending ||
    rejectPI.isPending;

  const handleStatusAction = async (
    action: () => Promise<any>,
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

  const handlePostJournal = async () => {
    if (!id || postPI.isPending) return;
    try {
      await postPI.mutateAsync(id);
      toast.success("Invoice berhasil di-post ke jurnal");
      navigate("/inventory/purchase-invoices");
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal post jurnal"));
    }
  };

  const handleDelete = async () => {
    try {
      await deletePI.mutateAsync(id!);
      toast.success("Invoice dihapus");
      navigate("/inventory/purchase-invoices");
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal menghapus invoice"));
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/inventory/purchase-invoices")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {inv.invoice_number}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${STATUS_CONFIG[inv.status].color}`}
                >
                  {STATUS_CONFIG[inv.status].label}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {inv.supplier_name} — {inv.branch_name}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(inv.status === "DRAFT" || inv.status === "REJECTED") && (
              <>
                {canDelete && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trash2 className="w-4 h-4" /> Hapus
                  </button>
                )}
                <button
                  onClick={() =>
                    navigate(`/inventory/purchase-invoices/${id}/edit`)
                  }
                  className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors"
                >
                  <Edit className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={() => {
                    if (isStatusBusy) return;
                    if (!attachments || attachments.length === 0) {
                      toast.error("Upload minimal 1 foto invoice sebelum mengajukan.");
                      return;
                    }
                    if (hasOverQty && !confirmOverQty) {
                      toast.error("Mohon centang konfirmasi selisih Qty (OVER) sebelum mengajukan.");
                      return;
                    }
                    handleStatusAction(
                      () => submitPI.mutateAsync(id!),
                      inv.status === "REJECTED" ? "Invoice diajukan ulang" : "Invoice diajukan",
                    );
                  }}
                  disabled={isStatusBusy}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-all"
                >
                  {submitPI.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {submitPI.isPending ? "Mengajukan..." : "Ajukan"}
                </button>
              </>
            )}

            {inv.status === "SUBMITTED" && canApprove && (
              <>
                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isStatusBusy}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-all"
                >
                  <XCircle className="w-4 h-4" /> Tolak
                </button>
                <button
                  onClick={() => {
                    if (isStatusBusy) return;
                    handleStatusAction(
                      () => approvePI.mutateAsync(id!),
                      "Invoice disetujui",
                    );
                  }}
                  disabled={isStatusBusy}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-all"
                >
                  {approvePI.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {approvePI.isPending ? "Menyetujui..." : "Setujui"}
                </button>
              </>
            )}

            {inv.status === "APPROVED" && canApprove && (
              <div className="flex flex-col">
                <button
                  onClick={handlePostJournal}
                  disabled={isStatusBusy || hasUnconfirmedGp}
                  title={hasUnconfirmedGp ? "Ada item GP yang belum dikonfirmasi (QC). Selesaikan QC dulu sebelum Post Jurnal." : undefined}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium shadow-sm transition-all"
                >
                {postPI.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="w-4 h-4" />
                )}
                {postPI.isPending ? "Memposting jurnal..." : "Post Jurnal"}
                </button>
                {hasUnconfirmedGp && (
                  <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                    Tidak bisa post jurnal karena masih ada GP dengan status selain CONFIRMED.
                  </p>
                )}
              </div>
            )}

            {inv.status === "POSTED" && (
              <button className="flex items-center gap-2 px-4 py-2 border border-green-200 bg-green-50 text-green-700 rounded-lg text-sm font-medium cursor-default">
                <CheckCircle2 className="w-4 h-4" /> Sudah Di-post
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Detail Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Tanggal Invoice
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {fmtDate(inv.invoice_date)}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Jatuh Tempo
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {inv.due_date ? fmtDate(inv.due_date) : "—"}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Supplier
            </p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {inv.supplier_name}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Penerimaan Barang (GR)
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {inv.gr_links.map((gl) => (
                <span
                  key={gl.id}
                  className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-medium text-gray-600 dark:text-gray-300"
                >
                  {gl.goods_receipt_number}
                </span>
              ))}
            </div>
          </div>
        </div>

        {inv.status === "DRAFT" && hasOverQty && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-1">
                Peringatan: Selisih Qty (OVER)
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                Terdapat item dengan jumlah tagihan melebihi jumlah yang diterima (Qty Invoice &gt; Qty GR). Mohon pastikan hal ini sudah sesuai dengan kebijakan perusahaan.
              </p>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={confirmOverQty}
                  onChange={e => setConfirmOverQty(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500" 
                />
                <span className="text-sm font-medium text-amber-900 dark:text-amber-200 group-hover:text-amber-700 transition-colors">
                  Saya mengonfirmasi selisih Qty ini benar
                </span>
              </label>
            </div>
          </div>
        )}

        {inv.status === "REJECTED" && inv.rejection_reason && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800 dark:text-red-400">
                Invoice Ditolak
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">
                {inv.rejection_reason}
              </p>
            </div>
          </div>
        )}

        {/* Lines Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Detail Barang
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left text-[10px] uppercase font-bold tracking-wider">
                    Barang
                  </th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">
                    Qty Received
                  </th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">
                    Qty Invoiced
                  </th>
                  <th className="px-4 py-2 text-right text-[10px] uppercase font-bold tracking-wider">
                    Harga Satuan
                  </th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">
                    PPN %
                  </th>
                  <th className="px-4 py-2 text-right text-[10px] uppercase font-bold tracking-wider">
                    Subtotal
                  </th>
                  <th className="px-4 py-2 text-center text-[10px] uppercase font-bold tracking-wider">
                    Match Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {inv.lines.map((l, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {l.product_name}
                      </p>
                      <p className="text-[10px] text-gray-500 font-mono">
                        {l.product_code}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-center font-medium text-gray-600 dark:text-gray-400">
                      {l.qty_received}
                    </td>
                    <td className="px-4 py-3 text-center font-bold text-gray-900 dark:text-white">
                      {l.qty_invoiced}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {fmtCurrency(l.unit_price)}
                      </p>
                      {l.unit_price !== l.unit_price_po && (
                        <p className="text-[10px] text-yellow-600 font-medium">
                          PO: {fmtCurrency(l.unit_price_po ?? 0)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">
                      {l.tax_rate}%
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                      {fmtCurrency(l.total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          l.match_status === "MATCH"
                            ? "bg-green-100 text-green-700"
                            : l.match_status === "OVER"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {l.match_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50/30 dark:bg-gray-700/30 px-6 py-6 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-end gap-2">
              <div className="flex justify-between w-64 text-sm text-gray-600 dark:text-gray-400">
                <span>Subtotal</span>
                <span className="font-medium">{fmtCurrency(inv.subtotal)}</span>
              </div>
              <div className="flex justify-between w-64 text-sm text-gray-600 dark:text-gray-400">
                <span>Total PPN</span>
                <span className="font-medium">
                  {fmtCurrency(inv.total_tax)}
                </span>
              </div>
              <div className="flex justify-between w-64 pt-3 mt-1 border-t border-gray-200 dark:border-gray-600 font-bold text-xl text-indigo-600 dark:text-indigo-400 tracking-tight">
                <span>TOTAL AKHIR</span>
                <span>{fmtCurrency(inv.total_amount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Lampiran ({attachments?.length ?? 0})
              </h2>
            </div>
            <p className="text-[10px] text-gray-400 font-medium">Disalin otomatis dari GR</p>
          </div>
          {!attachments || attachments.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              Tidak ada lampiran
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {attachments.map((att) => {
                const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(
                  att.file_path,
                );
                return (
                  <div
                    key={att.id}
                    className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <AttachmentThumbnail
                        filePath={att.file_path}
                        isImage={isImage}
                        onClick={(url) => setPreviewUrl(url)}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none mb-1">
                          {att.file_name ?? att.file_path.split("/").pop()}
                        </p>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                          {FILE_TYPE_LABELS[att.file_type] ?? att.file_type}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const { data } = await api.get("/storage/signed-url", {
                            params: { path: att.file_path, bucket: "invoices" },
                          });
                          window.open(data.data.url, "_blank");
                        } catch (err: unknown) {
                          toast.error(parseApiError(err, "Gagal membuka file"));
                        }
                      }}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Goods Processing (Barang Masuk) audit */}
        {gpLineAudits.length > 0 && (
          <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-500" />
                  Riwayat Barang Masuk (QC)
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Prasyarat post jurnal: semua item harus status{" "}
                  <span className="font-semibold text-green-600">Selesai</span>
                </p>
              </div>
              {inv.status === "APPROVED" && hasUnconfirmedGp && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 max-w-md">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Masih ada item yang belum dikonfirmasi di Barang Masuk. Selesaikan QC
                    sebelum Post Jurnal.
                  </span>
                </div>
              )}
              {allGpLinesConfirmed && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                  <CheckCircle2 className="w-3 h-3" /> Siap Post Jurnal
                </span>
              )}
            </div>

            <div className="space-y-4">
              {[...gpAuditsByDoc.entries()].map(([gpNumber, rows]) => (
                <div
                  key={gpNumber}
                  className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                >
                  <div className="px-4 py-2.5 bg-orange-50/80 dark:bg-orange-900/10 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {gpNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/inventory/goods-processing/${rows[0].goods_processing_id}`)
                      }
                      className="text-[10px] font-medium text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                    >
                      Buka di Barang Masuk
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {rows.map((row) => {
                      const st =
                        GP_LINE_STATUS_CONFIG[normalizeGpLineStatus(row.gp_line_status)] ??
                        GP_LINE_STATUS_CONFIG.PENDING;
                      const goodOutputs = row.outputs.filter((o) => !o.is_waste);
                      return (
                        <div
                          key={row.gp_input_id}
                          className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {row.product_name}
                              </span>
                              <span className="text-[10px] font-mono text-gray-400">
                                {row.product_code}
                              </span>
                              {row.requires_processing ? (
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                  Proses
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                                  Pass
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${st.color}`}
                              >
                                {st.label}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                              {fmtQty(row.qty_input)} {row.uom}
                            </p>
                            {goodOutputs.length > 0 &&
                              goodOutputs.some((o) => o.product_name !== row.product_name) && (
                                <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                  →{" "}
                                  {goodOutputs
                                    .map(
                                      (o) =>
                                        `${o.product_name} ${fmtQty(o.qty_output)} ${o.uom}`,
                                    )
                                    .join(" + ")}
                                </p>
                              )}
                            {row.gp_line_status === "CONFIRMED" && row.qc_confirmed_at && (
                              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                                ✓ Dikonfirmasi oleh {row.qc_confirmed_by_name ?? "QC"} ·{" "}
                                {fmtDate(row.qc_confirmed_at)}
                              </p>
                            )}
                            {row.gp_line_status === "REJECTED" && row.rejection_reason && (
                              <p className="text-xs text-red-500 mt-1 italic">
                                {row.rejection_reason}
                              </p>
                            )}
                            {row.processed_at && row.gp_line_status !== "CONFIRMED" && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                Diproses{" "}
                                {row.processed_by_name ? `oleh ${row.processed_by_name}` : ""} ·{" "}
                                {fmtDate(row.processed_at)}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              navigate(
                                `/inventory/goods-processing/${row.goods_processing_id}?line=${row.gp_input_id}`,
                              )
                            }
                            className="shrink-0 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                          >
                            Detail item
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Timeline — Verifikasi Invoice */}
        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-indigo-500" /> Riwayat Verifikasi Invoice
          </h3>

          <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-linear-to-b before:from-indigo-500 before:via-gray-200 dark:before:via-gray-700 before:to-transparent">
            {/* Created */}
            <div className="relative flex items-center justify-between md:justify-start">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow shrink-0 md:order-1 border-4 border-white dark:border-gray-800">
                <Plus className="w-5 h-5" />
              </div>
              <div className="flex-1 ml-4 md:order-2">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-gray-900 dark:text-white text-sm">Draft Dibuat</div>
                  <time className="text-[10px] font-mono text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-full">{fmtDateTime(inv.created_at)}</time>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Oleh: <span className="font-medium text-gray-700 dark:text-gray-200">{inv.creator_name || "System"}</span></div>
              </div>
            </div>

            {/* Submitted */}
            {inv.submitted_at && (
              <div className="relative flex items-center justify-between md:justify-start">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shadow shrink-0 md:order-1 border-4 border-white dark:border-gray-800">
                  <Send className="w-4 h-4" />
                </div>
                <div className="flex-1 ml-4 md:order-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">Diajukan untuk Verifikasi</div>
                    <time className="text-[10px] font-mono text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">{fmtDateTime(inv.submitted_at)}</time>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Oleh: <span className="font-medium text-gray-700 dark:text-gray-200">{inv.submitter_name || "Staff Finance"}</span></div>
                </div>
              </div>
            )}

            {/* Rejected */}
            {inv.status === 'REJECTED' && inv.rejected_at && (
              <div className="relative flex items-center justify-between md:justify-start">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow shrink-0 md:order-1 border-4 border-white dark:border-gray-800">
                  <XCircle className="w-5 h-5" />
                </div>
                <div className="flex-1 ml-4 md:order-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-red-600 dark:text-red-400 text-sm">Ditolak</div>
                    <time className="text-[10px] font-mono text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-full">{fmtDateTime(inv.rejected_at)}</time>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">Oleh: <span className="font-medium text-gray-700 dark:text-gray-200">{inv.rejector_name || "Approver"}</span></div>
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-lg text-xs text-red-700 dark:text-red-300 italic">
                    {inv.rejection_reason}
                  </div>
                </div>
              </div>
            )}

            {/* Approved */}
            {inv.approved_at && (
              <div className="relative flex items-center justify-between md:justify-start">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 shadow shrink-0 md:order-1 border-4 border-white dark:border-gray-800">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1 ml-4 md:order-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">Disetujui</div>
                    <time className="text-[10px] font-mono text-green-500 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full">{fmtDateTime(inv.approved_at)}</time>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Oleh: <span className="font-medium text-gray-700 dark:text-gray-200">{inv.approver_name || "Manager"}</span></div>
                </div>
              </div>
            )}

            {/* Posted */}
            {inv.posted_at && (
              <div className="relative flex items-center justify-between md:justify-start">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shadow shrink-0 md:order-1 border-4 border-white dark:border-gray-800">
                  <FileText className="w-5 h-5" />
                </div>
                <div className="flex-1 ml-4 md:order-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-bold text-gray-900 dark:text-white text-sm">Berhasil Di-post ke Jurnal</div>
                    <time className="text-[10px] font-mono text-blue-500 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">{fmtDateTime(inv.posted_at)}</time>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Oleh: <span className="font-medium text-gray-700 dark:text-gray-200">{inv.poster_name || "Accounting"}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Hapus Invoice"
        message="Yakin ingin menghapus invoice ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        variant="danger"
        isLoading={deletePI.isPending}
      />

      <ConfirmModal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        onConfirm={() =>
          handleStatusAction(
            () => rejectPI.mutateAsync({ id: id!, reason: rejectReason }),
            "Invoice ditolak",
          ).then(() => setShowRejectModal(false))
        }
        title="Tolak Invoice"
        message={
          <div className="space-y-3 pt-2">
            <p className="text-sm text-gray-500">
              Berikan alasan penolakan agar tim finance dapat merevisi invoice
              ini.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Alasan penolakan..."
              className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 outline-none focus:ring-2 focus:ring-red-500"
              rows={3}
            />
          </div>
        }
        confirmText="Tolak Invoice"
        variant="danger"
        isLoading={rejectPI.isPending}
      />

      {/* Image Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute top-6 right-6 text-white/70 hover:text-white p-2 transition-colors"
            onClick={() => setPreviewUrl(null)}
          >
            <XCircle className="w-8 h-8" />
          </button>
          <img
            src={previewUrl}
            alt="Full Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
