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
import { useProductUoms } from '@/features/product-uoms/api/productUoms.api'

const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const VARIANCE_COLORS: Record<string, string> = {
  OK: "text-green-600 dark:text-green-400",
  NOTICE: "text-yellow-600 dark:text-yellow-400",
  DISPUTED: "text-red-600 dark:text-red-400",
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
// ADD before: export default function GoodsReceiptDetailPage() {
  function EstimasiBeratCell({ productId, qtyReceived, uomReceived }: {
    productId: string
    qtyReceived: number
    uomReceived: string
  }) {
    const { data: productUoms } = useProductUoms(productId)
    if (!productUoms || productUoms.length === 0) return <span className="text-gray-400">—</span>
  
    const baseUom = productUoms.find(u => u.is_base_unit) ?? productUoms.find(u => u.is_default_stock_unit)
    if (!baseUom?.metric_units?.unit_name) return <span className="text-gray-400">—</span>
  
    const receivedUomEntry = productUoms.find(u => u.metric_units?.unit_name === uomReceived)
    if (!receivedUomEntry || baseUom.conversion_factor === 0) return <span className="text-gray-400">—</span>
  
    const qtyBase = qtyReceived * (receivedUomEntry.conversion_factor / baseUom.conversion_factor)
    const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
  
    return (
      <span className="font-mono text-gray-700 dark:text-gray-300">
        {fmt(Math.round(qtyBase))} {baseUom.metric_units.unit_name}
      </span>
    )
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
              const qtyDisplay = hasDual
                ? `${fmt(l.qty_po_uom ?? l.qty_received)} ${esc(l.uom_po ?? "")} (${fmt(l.qty_received)} ${esc(l.uom_received ?? "")})`
                : `${fmt(l.qty_received)}`;
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

  if (!gr) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500">Penerimaan barang tidak ditemukan</p>
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
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/inventory/goods-receipts")}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <PackageCheck className="w-6 h-6 text-teal-600 shrink-0 hidden sm:block" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
                  {gr.gr_number}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${gr.status === "CONFIRMED" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
                >
                  {gr.status === "CONFIRMED" ? "Confirmed" : "Draft"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">
                {gr.supplier_name} — {gr.branch_name}
              </p>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            {gr.status === "CONFIRMED" && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              >
                <Printer className="w-4 h-4" />{" "}
                <span className="hidden sm:inline">Cetak</span>
              </button>
            )}
            {gr.status === "DRAFT" && canUpdate && (
              <>
                <button
                  onClick={() =>
                    navigate(`/inventory/goods-receipts/${id}/edit`)
                  }
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm"
                >
                  <CheckCircle className="w-4 h-4" />{" "}
                  <span className="hidden sm:inline">Konfirmasi</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div className="px-4 sm:px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 text-sm">
          <div>
            <span className="text-gray-500 dark:text-gray-400">PO</span>
            <p
              className="font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline"
              onClick={() => navigate(`/inventory/purchase-orders/${gr.po_id}`)}
            >
              {gr.po_number}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">
              Tanggal Terima
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {fmtDate(gr.received_date)}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">Gudang</span>
            <p className="font-medium text-gray-900 dark:text-white">
              {gr.warehouse_name}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">
              No. Invoice
            </span>
            <p className="font-medium text-gray-900 dark:text-white">
              {gr.invoice_number || "—"}
            </p>
          </div>
          <div>
            <span className="text-gray-500 dark:text-gray-400">
              Total Invoice
            </span>
            <p className="font-bold text-gray-900 dark:text-white">
              Rp {fmt(gr.total_invoice_amount)}
            </p>
          </div>
        </div>

        {hasDisputed && gr.status === "DRAFT" && (
          <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Ada selisih harga &gt; 15% yang perlu diperhatikan.
            </p>
          </div>
        )}

        {gr.status === "DRAFT" && !hasInvoiceAttachment && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-blue-600" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Upload foto invoice di bagian Lampiran sebelum konfirmasi.
            </p>
          </div>
        )}
      </div>

      {/* Lines Table + Attachments */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 border-b dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Produk</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Diterima</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ditolak</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Est. Berat</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Harga PO</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Selisih</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {(gr.lines ?? []).map((line, idx) => {
                const hasDualUom =
                  line.uom_po &&
                  line.uom_received &&
                  line.uom_po !== line.uom_received;
                return (
                  <tr key={line.id ?? idx}>
                    <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {line.product_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {line.product_code}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {hasDualUom ? (
                        <div>
                          <span className="font-mono text-gray-900 dark:text-gray-200">
                            {fmt(line.qty_po_uom ?? line.qty_received)}{" "}
                            {line.uom_po}
                          </span>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            = {fmt(line.qty_received)} {line.uom_received}
                            <span className="ml-1 text-gray-400">
                              (1:{(line.conversion_factor ?? 1).toFixed(2)})
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono text-gray-900 dark:text-gray-200">
                          {fmt(line.qty_received)}{" "}
                          {line.uom_received ?? line.uom}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {(line.qty_rejected ?? 0) > 0 ? (
                        <span className="text-red-600 dark:text-red-400">
                          {fmt(line.qty_rejected ?? 0)}{" "}
                          {line.uom_po ?? line.uom}
                          {line.reject_reason && (
                            <span className="text-xs ml-1">
                              (
                              {line.reject_reason === "DAMAGED"
                                ? "Rusak"
                                : line.reject_reason === "EXPIRED"
                                  ? "Expired"
                                  : line.reject_reason === "WRONG_ITEM"
                                    ? "Salah"
                                    : "Lain"}
                              )
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-mono text-gray-500">
                        Rp {fmt(line.unit_price_po ?? 0)}
                      </span>
                      <div className="text-xs text-gray-400">
                        /{line.uom_po ?? line.uom}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">

                      <span
                        className={
                          VARIANCE_COLORS[line.variance_status ?? "OK"]
                        }
                      >
                        {(line.price_variance ?? 0) > 0 ? "+" : ""}
                        {fmt(line.price_variance ?? 0)}
                        {(line.price_variance_pct ?? 0) > 0 && (
                          <span className="text-xs ml-1">
                            ({fmt(line.price_variance_pct ?? 0)}%)
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`text-xs font-medium ${VARIANCE_COLORS[line.variance_status ?? "OK"]}`}
                      >
                        {line.variance_status === "DISPUTED"
                          ? "⚠️ Disputed"
                          : line.variance_status === "NOTICE"
                            ? "Notice"
                            : "✓"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-900 dark:text-gray-200">
                      Rp{" "}
                      {fmt(
                        line.total_price_invoice ??
                          line.qty_received * line.unit_price_invoice,
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
  <EstimasiBeratCell
    productId={line.product_id}
    qtyReceived={line.qty_received}
    uomReceived={line.uom_received ?? line.uom ?? ''}
  />
</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t dark:border-gray-700">
              <tr>
                <td
                  colSpan={8}

                  className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white"
                >
                  Total:
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                  Rp {fmt(gr.total_invoice_amount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Attachments Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Lampiran ({attachments?.length ?? 0})
              </h3>
            </div>
            {canUpdate && (
              <div className="flex items-center gap-2">
                <select
                  value={uploadType}
                  onChange={(e) => setUploadType(e.target.value)}
                  className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                  className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  <Upload className="w-3 h-3" />{" "}
                  {uploadAttachment.isPending ? "Uploading..." : "Upload"}
                </button>
              </div>
            )}
          </div>
          {!attachments || attachments.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              Belum ada lampiran
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {attachments.map((att) => {
                const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(
                  att.file_path,
                );
                return (
                  <div
                    key={att.id}
                    className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <AttachmentThumbnail
                        filePath={att.file_path}
                        isImage={isImage}
                      />
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none mb-1">
                          {att.file_name ?? att.file_path.split("/").pop()}
                        </p>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                          {FILE_TYPE_LABELS[att.file_type] ?? att.file_type}
                          {" • "}
                          {new Date(att.uploaded_at).toLocaleDateString(
                            "id-ID",
                            { day: "2-digit", month: "short", year: "numeric" },
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                      {canUpdate && (
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
                          className="text-red-500 hover:text-red-700"
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

      <ConfirmModal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirm}
        title="Konfirmasi Penerimaan Barang"
        message={`Konfirmasi penerimaan barang ini?\n\n• Update status PO\n• Buat Goods Processing (Barang Masuk) otomatis\n\nLanjutkan?`}
        confirmText="Konfirmasi"
        variant="success"
        isLoading={confirmGR.isPending}
      />

      {/* Image Preview Modal */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 animate-in fade-in duration-200"
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
