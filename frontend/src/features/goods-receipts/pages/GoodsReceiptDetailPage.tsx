import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  PackageCheck,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Printer,
  Paperclip,
  Upload,
  Trash2,
  FileText,
  XCircle,
  Image,
  Info,
  Calendar,
  Building,
  FileDigit,
  Receipt,
  ListChecks,
  Package,
  Scale,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import {
  useGoodsReceipt,
  useConfirmGoodsReceipt,
  useGRAttachments,
  useUploadGRAttachment,
  useDeleteGRAttachment,
} from "../api/goodsReceipts.api";
import api from "@/lib/axios";

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const VARIANCE_COLORS: Record<string, string> = {
  OK: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
  NOTICE: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  DISPUTED: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
};

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
      <div className="w-14 h-14 flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <FileText className="w-6 h-6 text-gray-400" />
      </div>
    );
  }

  if (!url) {
    return (
      <div className="w-14 h-14 flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl animate-pulse">
        <Image className="w-6 h-6 text-gray-300" />
      </div>
    );
  }

  return (
    <div
      className="group relative cursor-zoom-in rounded-xl overflow-hidden shadow-sm"
      onClick={() => url && onClick?.(url)}
    >
      <img
        src={url}
        alt="thumbnail"
        className="w-14 h-14 object-cover border border-gray-200 dark:border-gray-700 transition-transform duration-300 group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <ExternalLink className="w-4 h-4 text-white" />
      </div>
    </div>
  );
}



export default function GoodsReceiptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const hasPermission = usePermissionStore((state) => state.hasPermission);
  const canUpdate = hasPermission("goods_receipts", "update");

  const { data: gr, isLoading } = useGoodsReceipt(id ?? "");
  const confirmGR = useConfirmGoodsReceipt();
  const { data: attachments } = useGRAttachments(id ?? "");
  const uploadAttachment = useUploadGRAttachment();
  const deleteAttachment = useDeleteGRAttachment();

  const [showConfirm, setShowConfirm] = useState(false);
  const [uploadType, setUploadType] = useState<string>("INVOICE");
  const attachFileRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const esc = (s: string) =>
    s?.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") ?? "";

  const handlePrint = () => {
    if (!gr) return;
    const lines = gr.lines ?? [];
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>GR ${gr.gr_number}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 11pt; color: #000; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: bold; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .header { text-align: center; margin-bottom: 20px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px; font-size: 10pt; }
        .signatures { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; text-align: center; }
        .sig-line { border-bottom: 1px solid #000; width: 150px; margin: 50px auto 5px; }
        @media print { body { margin: 0; } }
      </style></head><body>
      <div class="header">
        <h2 style="margin:0">BUKTI PENERIMAAN BARANG</h2>
        <p style="margin:5px 0">No: ${esc(gr.gr_number)}</p>
      </div>
      <div class="info-grid">
        <div><strong>Tanggal:</strong> ${fmtDate(gr.received_date)}</div>
        <div><strong>PO:</strong> ${esc(gr.po_number)}</div>
        <div><strong>Supplier:</strong> ${esc(gr.supplier_name)}</div>
        <div><strong>Gudang:</strong> ${esc(gr.warehouse_name)}</div>
        <div><strong>Cabang:</strong> ${esc(gr.branch_name)}</div>
        <div><strong>No. Invoice:</strong> ${esc(gr.invoice_number || "-")}</div>
      </div>
      <table>
        <thead><tr><th class="text-center">No</th><th>Produk</th><th class="text-right">Diterima</th><th class="text-right">Ditolak</th><th>UOM</th><th class="text-right">Harga</th><th class="text-right">Subtotal</th></tr></thead>
        <tbody>
          ${lines
            .map((l, i) => {
              const hasDual =
                l.uom_po && l.uom_received && l.uom_po !== l.uom_received;
              const netQty = (l.qty_po_uom ?? l.qty_received) - (l.qty_rejected ?? 0)
              const qtyDisplay = hasDual
                ? `${fmt(netQty)} ${esc(l.uom_po ?? "")} (${fmt(l.qty_received)} ${esc(l.uom_received ?? "")})`
                : `${fmt(netQty)}`;
              const uomDisplay = hasDual
                ? esc(l.uom_received ?? l.uom ?? "")
                : esc(l.uom ?? "");
              return `<tr><td class="text-center">${i + 1}</td><td>${esc(l.product_name ?? "")}</td><td class="text-right">${qtyDisplay}</td><td class="text-right">${(l.qty_rejected ?? 0) > 0 ? fmt(l.qty_rejected ?? 0) : "-"}</td><td>${uomDisplay}</td><td class="text-right">Rp ${fmt(l.unit_price_invoice)}</td><td class="text-right">Rp ${fmt(l.total_price_invoice ?? l.qty_received * l.unit_price_invoice)}</td></tr>`;
            })
            .join("")}
        </tbody>
        <tfoot><tr><td colspan="6" class="text-right"><strong>Total:</strong></td><td class="text-right"><strong>Rp ${fmt(gr.total_invoice_amount)}</strong></td></tr></tfoot>
      </table>
      ${gr.notes ? `<p><strong>Catatan:</strong> ${esc(gr.notes)}</p>` : ""}
      <div class="signatures">
        <div><p><strong>Diterima oleh:</strong></p><div class="sig-line"></div><p>(________________)</p></div>
        <div><p><strong>Diketahui oleh:</strong></p><div class="sig-line"></div><p>(________________)</p></div>
      </div>
      <p style="text-align:center;font-size:9pt;color:#666;margin-top:30px">Dicetak oleh: ${esc(gr.confirmed_by_name || gr.created_by_name || "—")} · ${new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
    </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  const handleConfirm = async () => {
    if (!id) return;
    try {
      await confirmGR.mutateAsync({ id });
      toast.success("Penerimaan barang dikonfirmasi");
      setShowConfirm(false);
    } catch (err: unknown) {
      toast.error(parseApiError(err, "Gagal mengkonfirmasi"));
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 p-6">
        <div className="space-y-4 max-w-6xl mx-auto w-full">
          <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
          <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
          <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!gr) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <PackageCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Penerimaan barang tidak ditemukan</p>
          <button onClick={() => navigate('/inventory/goods-receipts')} className="mt-4 text-teal-600 hover:underline text-sm font-medium">Kembali ke Daftar</button>
        </div>
      </div>
    );
  }

  const hasDisputed = (gr.lines ?? []).some(
    (l) => l.variance_status === "DISPUTED",
  );
  const hasInvoiceAttachment = attachments?.some(
    (a) => a.file_type === "INVOICE",
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4 sticky top-0 z-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/inventory/goods-receipts")}
              className="p-2 -ml-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-2.5 bg-teal-50 dark:bg-teal-900/20 rounded-xl hidden sm:block">
              <PackageCheck className="w-6 h-6 text-teal-600 dark:text-teal-400 shrink-0" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                  {gr.gr_number}
                </h1>
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${gr.status === "CONFIRMED" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50" : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50"}`}
                >
                  {gr.status === "CONFIRMED" ? "Confirmed" : "Draft"}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                {gr.supplier_name} — {gr.branch_name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {gr.status === "CONFIRMED" && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors bg-white dark:bg-gray-800 shadow-sm"
              >
                <Printer className="w-4 h-4" />{" "}
                <span className="hidden sm:inline">Cetak GR</span>
              </button>
            )}
            {gr.status === "DRAFT" && canUpdate && (
              <>
                <button
                  onClick={() =>
                    navigate(`/inventory/goods-receipts/${id}/edit`)
                  }
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium transition-colors bg-white dark:bg-gray-800 shadow-sm"
                >
                  Edit Data
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 text-sm transition-all shadow-sm shadow-teal-600/20"
                >
                  <CheckCircle className="w-4 h-4" />{" "}
                  <span className="hidden sm:inline">Konfirmasi Penerimaan</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-6 pb-24">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Alerts */}
          {((hasDisputed && gr.status === "DRAFT") || (gr.status === "DRAFT" && !hasInvoiceAttachment)) && (
            <div className="space-y-3">
              {hasDisputed && gr.status === "DRAFT" && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-start gap-3 shadow-sm">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400">Peringatan Harga</h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Ada selisih harga lebih dari 15% dari estimasi yang perlu diperhatikan sebelum konfirmasi.
                    </p>
                  </div>
                </div>
              )}

              {gr.status === "DRAFT" && !hasInvoiceAttachment && (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl flex items-start gap-3 shadow-sm">
                  <Info className="w-5 h-5 text-blue-600 dark:text-blue-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-400">Dokumen Belum Lengkap</h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      Silakan upload foto invoice supplier di bagian Lampiran sebelum melakukan konfirmasi.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Info Cards */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
             <div className="px-6 py-4 border-b border-gray-200/60 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/80 flex items-center gap-2">
              <Info className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider">Informasi Penerimaan</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <FileDigit className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Referensi PO</span>
                  </div>
                  <p
                    className="font-mono font-medium text-teal-600 dark:text-teal-400 cursor-pointer hover:underline"
                    onClick={() => navigate(`/inventory/purchase-orders/${gr.po_id}`)}
                  >
                    {gr.po_number}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Tanggal Terima</span>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {fmtDate(gr.received_date)}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <Building className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Gudang Tujuan</span>
                  </div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {gr.warehouse_name}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 mb-1">
                    <Receipt className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">No. Invoice</span>
                  </div>
                  <p className="font-mono text-gray-900 dark:text-white">
                    {gr.invoice_number || "—"}
                  </p>
                </div>
                <div className="col-span-2 md:col-span-4 lg:col-span-1 lg:border-l lg:border-gray-200 dark:lg:border-gray-700 lg:pl-6 pt-4 lg:pt-0 border-t lg:border-t-0 mt-2 lg:mt-0">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 block">
                    Total Estimasi Tagihan
                  </span>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    Rp {fmt(gr.total_invoice_amount)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lines Table */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden flex flex-col h-full">
              <div className="px-6 py-4 border-b border-gray-200/60 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Daftar Barang Diterima
                  </h2>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 divide-y divide-gray-100 dark:divide-gray-700/50">
                {(gr.lines ?? []).map((line, idx) => {
                  const hasDualUom = line.uom_po && line.uom_received && line.uom_po !== line.uom_received;
                  const qtyDatang = line.qty_po_uom ?? line.qty_received;
                  const qtyDitolak = line.qty_rejected ?? 0;
                  const qtyDiterima = qtyDatang - qtyDitolak;
                  const uomPo = line.uom_po ?? line.uom ?? "";
                  const uomRec = line.uom_received ?? line.uom ?? "";
                  
                  return (
                    <div key={line.id ?? idx} className="p-5 sm:p-6 space-y-5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                      {/* Header */}
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg shrink-0 mt-0.5">
                            <Package className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 dark:text-white text-lg leading-tight truncate">
                              {line.product_name}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                {line.product_code}
                              </span>
                              <span
                                className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-xs font-semibold border ${VARIANCE_COLORS[line.variance_status ?? "OK"]}`}
                              >
                                {line.variance_status === "DISPUTED"
                                  ? "Disputed"
                                  : line.variance_status === "NOTICE"
                                    ? "Notice"
                                    : "Sesuai"}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Harga & Subtotal */}
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-gray-900 dark:text-gray-200">
                            Rp {fmt(line.total_price_invoice ?? qtyDiterima * line.unit_price_invoice)}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                            Rp {fmt(line.unit_price_invoice)} /{uomPo}
                          </div>
                          {(line.price_variance ?? 0) !== 0 && (
                            <div className={`text-xs font-medium mt-1 ${VARIANCE_COLORS[line.variance_status ?? "OK"].split(' ')[0]}`}>
                              {(line.price_variance ?? 0) > 0 ? "+" : ""}
                              Rp {fmt(line.price_variance ?? 0)} 
                              {(line.price_variance_pct ?? 0) !== 0 && (
                                <span> ({fmt(line.price_variance_pct ?? 0)}%)</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Summary auto-calculated style */}
                      <div className="rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Datang */}
                        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />
                            <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Barang Datang</span>
                          </div>
                          <span className="text-lg font-mono font-bold text-gray-800 dark:text-gray-200">
                            {fmt(qtyDatang)} <span className="text-sm font-normal text-gray-500">{uomPo}</span>
                          </span>
                        </div>

                        {/* Ditolak row */}
                        {qtyDitolak > 0 && (
                          <div className="flex items-center justify-between px-4 py-3 bg-red-50/50 dark:bg-red-900/10 border-b border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-2.5">
                              <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                              <span className="text-sm font-semibold text-red-600 dark:text-red-400">Ditolak</span>
                              {line.reject_reason && (
                                <span className="text-xs text-red-400 italic hidden sm:inline">
                                  · {line.reject_reason}
                                </span>
                              )}
                            </div>
                            <span className="text-lg font-mono font-bold text-red-600 dark:text-red-400">
                              −{fmt(qtyDitolak)} <span className="text-sm font-normal">{uomPo}</span>
                            </span>
                          </div>
                        )}

                        {/* Diterima */}
                        <div className="flex items-center justify-between px-4 py-4 bg-teal-50/70 dark:bg-teal-900/20 border-b-2 border-teal-100 dark:border-teal-800/50">
                          <div className="flex items-center gap-2.5">
                            <div className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
                            <span className="text-base font-bold text-teal-700 dark:text-teal-400">Diterima (Masuk Stok)</span>
                          </div>
                          <span className="text-2xl font-mono font-extrabold text-teal-800 dark:text-teal-300">
                            {fmt(qtyDiterima)} <span className="text-base font-semibold">{uomPo}</span>
                          </span>
                        </div>

                        {/* Hasil Timbang / Konversi info in same box if dual UOM */}
                        {hasDualUom && (
                          <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800">
                            <div className="flex items-center gap-2.5">
                              <Scale className="w-4 h-4 text-teal-500 shrink-0" />
                              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Hasil Timbang</span>
                              <span className="text-xs text-gray-500">
                                1 {uomPo} = {(line.conversion_factor ?? 1).toFixed(2)} {uomRec}
                              </span>
                            </div>
                            <span className="text-lg font-mono font-bold text-gray-800 dark:text-gray-200">
                              {fmt(line.qty_received)} <span className="text-sm font-normal text-gray-500">{uomRec}</span>
                            </span>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Attachments Section */}
            <div className="lg:col-span-1 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden flex flex-col h-fit">
              <div className="px-6 py-4 border-b border-gray-200/60 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Lampiran ({attachments?.length ?? 0})
                  </h3>
                </div>
              </div>
              <div className="p-4">
                {canUpdate && gr.status === "DRAFT" && (
                  <div className="mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Tambah Lampiran Baru</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={uploadType}
                        onChange={(e) => setUploadType(e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      >
                        <option value="INVOICE">Invoice</option>
                        <option value="DELIVERY_NOTE">Delivery Note</option>
                        <option value="SURAT_JALAN">Surat Jalan</option>
                        <option value="PHOTO_BARANG">Foto Barang</option>
                        <option value="OTHER">Lainnya</option>
                      </select>
                      <input
                        type="file"
                        ref={attachFileRef}
                        className="hidden"
                        accept="image/*,.pdf"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !id) return;
                          try {
                            await uploadAttachment.mutateAsync({
                              grId: id,
                              file,
                              fileType: uploadType,
                            });
                            toast.success("Lampiran berhasil diupload");
                          } catch (err: unknown) {
                            toast.error(parseApiError(err, "Gagal upload lampiran"));
                          }
                          e.target.value = "";
                        }}
                      />
                      <button
                        onClick={() => attachFileRef.current?.click()}
                        disabled={uploadAttachment.isPending}
                        className="flex items-center justify-center p-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        title="Upload"
                      >
                        <Upload className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                
                {!attachments || attachments.length === 0 ? (
                  <div className="py-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    <Paperclip className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Belum ada lampiran</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {attachments.map((att) => {
                      const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(
                        att.file_path,
                      );
                      return (
                        <div
                          key={att.id}
                          className="p-3 flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-xl hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/30 dark:hover:bg-teal-900/10 transition-colors group"
                        >
                          <div className="flex items-center gap-4 min-w-0">
                            <AttachmentThumbnail
                              filePath={att.file_path}
                              isImage={isImage}
                              onClick={setPreviewUrl}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate mb-0.5">
                                {att.file_name ?? att.file_path.split("/").pop()}
                              </p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 px-2 py-0.5 rounded">
                                  {FILE_TYPE_LABELS[att.file_type] ?? att.file_type}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400 truncate">
                                  {new Date(att.uploaded_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={async () => {
                                try {
                                  const { data } = await api.get(
                                    "/storage/signed-url",
                                    {
                                      params: {
                                        path: att.file_path,
                                        bucket: "invoices",
                                      },
                                    },
                                  );
                                  window.open(data.data.url, "_blank");
                                } catch (err: unknown) {
                                  toast.error(
                                    parseApiError(err, "Gagal membuka file"),
                                  );
                                }
                              }}
                              className="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 bg-gray-100 dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                              title="Buka di tab baru"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>
                            {canUpdate && gr.status === "DRAFT" && (
                              <button
                                onClick={() => {
                                  if (!id) return;
                                  if (
                                    !window.confirm(
                                      `Hapus lampiran "${att.file_name ?? "file"}"?`,
                                    )
                                  )
                                    return;
                                  deleteAttachment
                                    .mutateAsync({ grId: id, attachmentId: att.id })
                                    .then(() => toast.success("Lampiran dihapus"))
                                    .catch((err: unknown) =>
                                      toast.error(parseApiError(err, "Gagal hapus")),
                                    );
                                }}
                                className="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Hapus"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title="Konfirmasi Penerimaan Barang"
        message={`Apakah Anda yakin ingin mengkonfirmasi penerimaan barang ini?\n\n• Status PO akan diperbarui\n• Goods Processing (Barang Masuk) akan dibuat otomatis\n\nTindakan ini tidak dapat dibatalkan.`}
        confirmText="Ya, Konfirmasi"
        variant="success"
        isLoading={confirmGR.isPending}
      />

      {/* Image Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute top-6 right-6 text-white/70 hover:text-white p-2 bg-black/50 hover:bg-black/80 rounded-full backdrop-blur-sm transition-all"
            onClick={() => setPreviewUrl(null)}
          >
            <XCircle className="w-8 h-8" />
          </button>
          <img
            src={previewUrl}
            alt="Full Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl animate-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
