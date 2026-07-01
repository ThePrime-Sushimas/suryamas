import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Send,
  Trash2,
  Edit,
  AlertCircle,
  Paperclip,
  ExternalLink,
  Undo2,
  Scissors,
} from "lucide-react";
import api from "@/lib/axios";
import { PurchaseInvoicePaymentDue } from "../components/PurchaseInvoicePaymentDue";
import { parseApiError } from "@/lib/errorParser";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PurchaseInvoiceSplitModal } from "../components/PurchaseInvoiceSplitModal";
import { AttachmentThumbnail } from "../components/AttachmentThumbnail";
import { PurchaseInvoiceRejectModal } from "../components/PurchaseInvoiceRejectModal";
import { InvoiceAuditTimeline } from "../components/InvoiceAuditTimeline";
import { InvoiceGpAuditSection } from "../components/InvoiceGpAuditSection";
import { usePurchaseInvoiceDetail } from "../hooks/usePurchaseInvoiceDetail";
import { usePurchaseInvoiceDetailModals } from "../hooks/usePurchaseInvoiceDetailModals";
import { fmtDate } from "../utils/purchaseInvoice.formatters";
import { PI_STATUS_CONFIG, FILE_TYPE_LABELS } from "../types/purchaseInvoice.status";
import { InvoiceLineTable } from "../components/InvoiceLineTable";
import { InvoiceChargeTable } from "../components/InvoiceChargeTable";
import { InvoiceTotalsFooter } from "../components/InvoiceTotalsFooter";
import { useToast } from "@/contexts/ToastContext";

export default function PurchaseInvoiceDetailPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const {
    id,
    inv,
    isLoading,
    attachments,
    canApprove,
    canRelease,
    hasOverQty,
    isStaging,
    canSplit,
    gpAuditsByDoc,
    allGpLinesConfirmed,
    hasUnconfirmedGp,
  } = usePurchaseInvoiceDetail();

  const modals = usePurchaseInvoiceDetailModals({
    id,
    attachmentsCount: attachments?.length ?? 0,
    hasOverQty,
    invoiceNumber: inv?.invoice_number ?? "",
  });

  // Totals for footer — use pre-computed server values to avoid frontend rounding differences


  if (isLoading)
    return <div className="p-8 text-center">Loading detail...</div>;
  if (!inv)
    return (
      <div className="p-8 text-center text-gray-500">
        Invoice tidak ditemukan
      </div>
    );

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              aria-label="Kembali"
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {inv.invoice_number}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${PI_STATUS_CONFIG[inv.status].color}`}
                >
                  {PI_STATUS_CONFIG[inv.status].label}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {inv.supplier_name} — {inv.branch_name}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {(inv.status === "DRAFT" || inv.status === "REJECTED") && (
              <>
                {canRelease && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="w-4 h-4" />}
                    onClick={() => modals.setShowDeleteModal(true)}
                    className="text-red-600"
                    title="Hanya draft yang belum disubmit — untuk koreksi operasional"
                  >
                    Hapus
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Edit className="w-4 h-4" />}
                  onClick={() => navigate(`/inventory/purchase-invoices/${id}/edit`)}
                >
                  Edit
                </Button>
                {canSplit && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Scissors className="w-4 h-4" />}
                    onClick={() => modals.setShowSplitModal(true)}
                    className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/20"
                  >
                    Pecah Invoice
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Send className="w-4 h-4" />}
                  loading={modals.submitPI.isPending}
                  disabled={modals.isStatusBusy}
                  onClick={() => modals.handleSubmit(inv.status)}
                >
                  {modals.submitPI.isPending ? "Mengajukan..." : "Ajukan"}
                </Button>
              </>
            )}

            {inv.status === "SUBMITTED" && canApprove && (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  leftIcon={<XCircle className="w-4 h-4" />}
                  loading={modals.isStatusBusy}
                  disabled={modals.isStatusBusy}
                  onClick={() => modals.setShowRejectModal(true)}
                >
                  Tolak
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<CheckCircle2 className="w-4 h-4" />}
                  loading={modals.approvePI.isPending}
                  disabled={modals.isStatusBusy}
                  onClick={modals.handleApprove}
                  className="bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700"
                >
                  {modals.approvePI.isPending ? "Menyetujui..." : "Setujui"}
                </Button>
              </>
            )}

            {inv.status === "POSTED" && (
              <>
                <span className="flex items-center gap-2 px-4 py-2 border border-green-200 bg-green-50 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300 rounded-lg text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" /> Sudah Di-post
                </span>
                {canRelease && (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<Undo2 className="w-4 h-4" />}
                    loading={modals.unpostPI.isPending}
                    onClick={() => modals.setShowUnpostModal(true)}
                    className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200"
                  >
                    {modals.unpostPI.isPending ? "Membatalkan..." : "Batalkan Post"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Tanggal Invoice</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{fmtDate(inv.invoice_date)}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Jatuh Tempo</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {inv.payment_due_info?.date
                ? fmtDate(inv.payment_due_info.date) + (!inv.payment_due_info.confirmed ? " (est.)" : "")
                : inv.payment_due_info?.text ?? "—"}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Supplier</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{inv.supplier_name}</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Penerimaan Barang (GR)</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {inv.gr_links.map((gl) => (
                <span key={gl.id} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                  {gl.goods_receipt_number}
                </span>
              ))}
            </div>
          </div>
        </div>

        {inv.payment_due_info && (
          <PurchaseInvoicePaymentDue info={inv.payment_due_info} variant="card" />
        )}

        {/* Staging banner */}
        {(inv.status === "DRAFT" || inv.status === "REJECTED") && isStaging && (
          <div className="p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-900/20">
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 mb-1">
              Invoice staging dari penerimaan barang
            </p>
            <p className="text-sm text-indigo-800/90 dark:text-indigo-300/90">
              {canSplit ? (
                <>
                  Jika supplier mengirim <strong>satu nota</strong> untuk semua item: klik{" "}
                  <strong>Edit</strong>, isi nomor invoice supplier, lalu <strong>Ajukan</strong> — tidak
                  perlu pecah. Jika ada <strong>beberapa nota</strong> dengan rekening tujuan berbeda:
                  gunakan <strong>Pecah Invoice</strong>.
                </>
              ) : (
                <>
                  Isi nomor invoice supplier yang sebenarnya (bukan placeholder{" "}
                  <code className="text-xs">[INV] …</code>), lalu Ajukan. Pecah invoice hanya jika ada
                  minimal 2 barang dan tidak ada baris charge.
                </>
              )}
            </p>
          </div>
        )}

        {/* Over Qty warning */}
        {inv.status === "DRAFT" && hasOverQty && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-1">Peringatan: Selisih Qty (OVER)</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                Terdapat item dengan jumlah tagihan melebihi jumlah yang diterima (Qty Invoice &gt; Qty GR). Mohon pastikan hal ini sudah sesuai dengan kebijakan perusahaan.
              </p>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={modals.confirmOverQty}
                  onChange={(e) => modals.setConfirmOverQty(e.target.checked)}
                  className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-amber-900 dark:text-amber-200 group-hover:text-amber-700 transition-colors">
                  Saya mengonfirmasi selisih Qty ini benar
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Rejection reason banner */}
        {inv.status === "REJECTED" && inv.rejection_reason && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800 dark:text-red-400">Invoice Ditolak</p>
              <p className="text-sm text-red-700 dark:text-red-300">{inv.rejection_reason}</p>
            </div>
          </div>
        )}

        {/* Lines + charges + totals */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">Detail Barang</h2>
          </div>

          <InvoiceLineTable lines={inv.lines} />

          <InvoiceChargeTable charges={inv.charges ?? []} />

          <InvoiceTotalsFooter
            totals={{
              subtotal: inv.subtotal,
              tax: inv.total_tax,
              totalCharges: Number(inv.total_charges),
              total: inv.total_amount,
            }}
            hasCharges={(inv.charges ?? []).length > 0}
            variant="view"
          />
        </div>

        {/* Attachments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/30 dark:bg-gray-700/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Lampiran ({attachments?.length ?? 0})</h2>
            </div>
            <p className="text-[10px] text-gray-400 font-medium">Disalin otomatis dari GR</p>
          </div>
          {!attachments || attachments.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">Tidak ada lampiran</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {attachments.map((att) => {
                const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(att.file_path);
                return (
                  <div key={att.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors">
                    <div className="flex items-center gap-4">
                      <AttachmentThumbnail
                        filePath={att.file_path}
                        isImage={isImage}
                        onClick={(url) => modals.setPreviewUrl(url)}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Buka file"
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
                      className="p-1"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* GP audit section */}
        <InvoiceGpAuditSection
          gpAuditsByDoc={gpAuditsByDoc}
          allGpLinesConfirmed={allGpLinesConfirmed}
          hasUnconfirmedGp={hasUnconfirmedGp}
          invoiceStatus={inv.status}
        />

        {/* Audit timeline */}
        <InvoiceAuditTimeline inv={inv} />
      </div>

      {/* Modals */}
      <ConfirmModal
        isOpen={modals.showDeleteModal}
        onClose={() => modals.setShowDeleteModal(false)}
        onConfirm={modals.handleDelete}
        title="Hapus Invoice"
        message="Yakin ingin menghapus invoice ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        variant="danger"
        isLoading={modals.deletePI.isPending}
      />

      <ConfirmModal
        isOpen={modals.showUnpostModal}
        onClose={() => modals.setShowUnpostModal(false)}
        onConfirm={modals.handleUnpost}
        title="Batalkan Post Jurnal"
        message={
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>
              Semua efek post jurnal akan dibatalkan untuk invoice{" "}
              <span className="font-semibold text-gray-900 dark:text-white">{inv.invoice_number}</span>:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Jurnal dihapus permanen (bukan reversal)</li>
              <li>Alokasi biaya GP &amp; avg cost stok dikembalikan ke 0</li>
              <li>Status invoice kembali ke Approved</li>
              <li>Qty invoiced GR &amp; jatuh tempo PO disesuaikan ulang</li>
            </ul>
          </div>
        }
        confirmText="Batalkan Post"
        variant="danger"
        isLoading={modals.unpostPI.isPending}
      />

      <PurchaseInvoiceRejectModal
        isOpen={modals.showRejectModal}
        onClose={() => modals.setShowRejectModal(false)}
        onConfirm={modals.handleReject}
        rejectReason={modals.rejectReason}
        onRejectReasonChange={modals.setRejectReason}
        isLoading={modals.rejectPI.isPending}
      />

      <PurchaseInvoiceSplitModal
        open={modals.showSplitModal}
        invoice={inv}
        onClose={() => modals.setShowSplitModal(false)}
        isSubmitting={modals.splitPI.isPending}
        onSubmit={modals.handleSplit}
      />

      {/* Image preview */}
      {modals.previewUrl && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => modals.setPreviewUrl(null)}
        >
          <button
            className="absolute top-6 right-6 text-white/70 hover:text-white p-2 transition-colors"
            onClick={() => modals.setPreviewUrl(null)}
          >
            <XCircle className="w-8 h-8" />
          </button>
          <img
            src={modals.previewUrl}
            alt="Full Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
