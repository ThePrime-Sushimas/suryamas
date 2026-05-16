import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  PackageCheck,
  Save,
  ClipboardList,
  Info,
  Store,
  FileText,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import {
  useCreateGoodsReceipt,
  useGoodsReceipt,
} from "../api/goodsReceipts.api";
import { useWarehouses } from "@/features/inventory/api/inventory.api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { GRLineCard, type GRLineData } from "../components/GRLineCard";

interface POOption {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  branch_id: string;
  branch_name: string;
  warehouse_id?: string;
  lines?: {
    id: string;
    product_id: string;
    product_code: string;
    product_name: string;
    qty: number;
    qty_received: number;
    uom: string;
    unit_price: number;
  }[];
}

const emptyPendingQty: Record<string, number> = {};

export default function GoodsReceiptFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [searchParams] = useSearchParams();
  const [selectedPoId, setSelectedPoId] = useState(
    searchParams.get("po_id") || "",
  );
  const [warehouseId, setWarehouseId] = useState("");
  const [receivedDate, setReceivedDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<GRLineData[]>([]);

  // Fetch existing GR for edit mode
  const { data: existingGR } = useGoodsReceipt(isEdit ? id : "");
  const [initialized, setInitialized] = useState(false);
  const [enriched, setEnriched] = useState(false);

  // Update mutation
  const updateGR = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.put(`/goods-receipts/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goods-receipts"] });
      toast.success("Penerimaan barang berhasil diperbarui");
      navigate(`/inventory/goods-receipts/${id}`);
    },
    onError: (err: unknown) =>
      toast.error(parseApiError(err, "Gagal memperbarui")),
  });

  // Fetch POs that can receive goods
  const { data: posData } = useQuery({
    queryKey: ["purchase-orders", "receivable"],
    queryFn: async () => {
      const { data } = await api.get("/purchase-orders", {
        params: { status: "ORDERED", limit: 50 },
      });
      const ordered = data.data as POOption[];
      const { data: data2 } = await api.get("/purchase-orders", {
        params: { status: "PARTIAL_RECEIVED", limit: 50 },
      });
      const partial = data2.data as POOption[];
      return [...ordered, ...partial];
    },
    staleTime: 30_000,
  });
  const receivablePOs = posData ?? [];

  // Fetch PO detail when selected
  const { data: selectedPO } = useQuery({
    queryKey: ["purchase-orders", selectedPoId, "detail-for-gr"],
    queryFn: async () => {
      const { data } = await api.get(`/purchase-orders/${selectedPoId}`);
      return data.data as POOption;
    },
    enabled: !!selectedPoId,
  });

  // Fetch pricelist prices for supplier + products in PO
  const supplierId = selectedPO?.supplier_id;
  const productIdsInPO = useMemo(
    () => selectedPO?.lines?.map((l) => l.product_id) ?? [],
    [selectedPO],
  );

  const { data: pricelistData } = useQuery({
    queryKey: ["pricelists", "batch-lookup", supplierId, productIdsInPO],
    queryFn: async () => {
      const { data } = await api.post("/pricelists/batch-lookup", {
        supplier_id: supplierId,
        product_ids: productIdsInPO,
      });
      return data.data as Record<string, { price: number; uom_name: string }>;
    },
    enabled: !!supplierId && productIdsInPO.length > 0,
    staleTime: 60_000,
  });
  const priceMap = pricelistData ?? {};

  // Fetch requires_processing flag for products
  const { data: productFlagsData } = useQuery({
    queryKey: ["products", "flags", productIdsInPO],
    queryFn: async () => {
      if (productIdsInPO.length === 0) return {};
      const { data } = await api.get("/products/batch-flags", {
        params: { ids: productIdsInPO.join(",") },
      });
      return data.data as Record<string, { requires_processing: boolean }>;
    },
    enabled: productIdsInPO.length > 0,
    staleTime: 60_000,
  });
  const productFlags = productFlagsData ?? {};

  // Fetch pending qty from existing DRAFT GRs
  const { data: pendingData } = useQuery({
    queryKey: ["goods-receipts", "pending-qty", selectedPoId, id],
    queryFn: async () => {
      const params: Record<string, string> = { po_id: selectedPoId };
      if (isEdit && id) params.exclude_gr_id = id;
      const { data } = await api.get("/goods-receipts/pending-qty", { params });
      return data.data as Record<string, number>;
    },
    enabled: !!selectedPoId,
  });
  const pendingQty = pendingData ?? emptyPendingQty;

  // Fetch warehouses
  const { data: warehousesData } = useWarehouses({
    limit: 50,
    warehouse_type: "MAIN",
  });
  const warehouses = warehousesData?.data ?? [];

  // Edit mode: populate form
  useEffect(() => {
    if (!isEdit || initialized || !existingGR) return;
    setSelectedPoId(existingGR.po_id);
    setWarehouseId(existingGR.warehouse_id);
    setReceivedDate(
      existingGR.received_date?.slice(0, 10) ??
        new Date().toISOString().slice(0, 10),
    );
    setInvoiceNumber(existingGR.invoice_number ?? "");
    setInvoiceDate(existingGR.invoice_date?.slice(0, 10) ?? "");
    setNotes(existingGR.notes ?? "");
    if (existingGR.lines) {
      setLines(
        existingGR.lines.map((l) => {
          const qtyPoUom = Number(l.qty_po_uom ?? l.qty_received);
          const qtyRejected = Number(l.qty_rejected ?? 0);
          const netMasukSebelumnya = qtyPoUom - qtyRejected;
          return {
            key: crypto.randomUUID(),
            po_line_id: l.po_line_id ?? "",
            product_id: l.product_id,
            product_name: l.product_name ?? "",
            product_code: l.product_code ?? "",
            uom_po: l.uom_po ?? l.uom ?? "",
            qty_ordered: qtyPoUom, // akan dienrich dari PO
            // qty_remaining sementara = qty yg sedang diedit ini,
            // akan dienrich ulang di useEffect enrichLines di bawah
            qty_remaining: netMasukSebelumnya,
            qty_po_uom: qtyPoUom,
            qty_received: Number(l.qty_received),
            uom_received: l.uom_received ?? l.uom ?? "",
            conversion_factor: Number(l.conversion_factor ?? 1),
            qty_rejected: qtyRejected,
            reject_reason: l.reject_reason ?? "",
            unit_price_invoice: Number(l.unit_price_invoice),
            unit_price_po: Number(l.unit_price_po ?? l.unit_price_invoice),
            requires_processing:
              (l.uom_po ?? l.uom ?? "") !== (l.uom_received ?? l.uom ?? ""),
          };
        }),
      );
    }
    setInitialized(true);
  }, [existingGR, isEdit, initialized]);

  // Edit mode: enrich lines with PO data
  // AFTER
  useEffect(() => {
    if (!isEdit || !initialized || enriched || !selectedPO?.lines) return;
    setLines((prev) =>
      prev.map((l) => {
        const poLine = selectedPO.lines?.find((pl) => pl.id === l.po_line_id);
        if (!poLine) return l;
        // qty_received di PO belum include GR DRAFT ini (baru di-increment saat CONFIRM)
        // Jadi sisa = qty - qty_received saja, sudah benar tanpa koreksi tambahan
        const qtyRemaining = Number(poLine.qty) - Number(poLine.qty_received);
        return {
          ...l,
          qty_ordered: Number(poLine.qty),
          qty_remaining: qtyRemaining,
        };
      }),
    );
    setEnriched(true);
  }, [isEdit, initialized, enriched, selectedPO]);

  // Create mode: auto-populate lines
  const lastPopulatedPoRef = useRef<string>("");

  const computedLines = useMemo(() => {
    if (isEdit || !selectedPO?.lines) return null;
    return selectedPO.lines
      .map((l) => {
        const pendingAmt = pendingQty[l.id] ?? 0;
        const remaining = Math.max(
          0,
          Number(l.qty) - Number(l.qty_received) - pendingAmt,
        );
        // Price priority: pricelist > PO unit_price > 0
        const plPrice = priceMap[l.product_id]?.price;
        const defaultPrice = plPrice ?? (Number(l.unit_price) || 0);
        const reqProcessing =
          productFlags[l.product_id]?.requires_processing ?? false;
        return {
          key: crypto.randomUUID(),
          po_line_id: l.id,
          product_id: l.product_id,
          product_name: l.product_name ?? "",
          product_code: l.product_code ?? "",
          uom_po: l.uom,
          qty_ordered: Number(l.qty),
          qty_remaining: remaining,
          qty_po_uom: remaining,
          qty_received: remaining,
          uom_received: l.uom,
          conversion_factor: 1,
          qty_rejected: 0,
          reject_reason: "",
          unit_price_invoice: defaultPrice,
          unit_price_po: Number(l.unit_price),
          requires_processing: reqProcessing,
        } satisfies GRLineData;
      })
      .filter((l) => l.qty_remaining > 0);
  }, [isEdit, selectedPO, pendingQty, priceMap, productFlags]);

  useEffect(() => {
    if (!computedLines) return;
    if (lastPopulatedPoRef.current === selectedPoId) return;
    lastPopulatedPoRef.current = selectedPoId;
    setLines(computedLines);
  }, [computedLines, selectedPoId]);

  // Update prices when priceMap loads (after lines already populated)
  useEffect(() => {
    if (!priceMap || Object.keys(priceMap).length === 0) return;
    setLines((prev) =>
      prev.map((l) => {
        const pl = priceMap[l.product_id];
        if (!pl || l.unit_price_invoice > 0) return l;
        // Pricelist price is always in purchase UOM — set directly
        return { ...l, unit_price_invoice: pl.price };
      }),
    );
  }, [priceMap]);

  // Auto-set warehouse
  useEffect(() => {
    if (isEdit || !selectedPO || warehouseId) return;
    const poWarehouse = warehouses.find(
      (w) => w.branch_id === selectedPO.branch_id,
    );
    if (poWarehouse) setWarehouseId(poWarehouse.id);
  }, [isEdit, selectedPO, warehouses, warehouseId]);

  const createGR = useCreateGoodsReceipt();

  const handleLineChange = (key: string, updates: Partial<GRLineData>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...updates } : l)),
    );
  };

  const handleLineRemove = (key: string) =>
    setLines((prev) => prev.filter((l) => l.key !== key));

  const handleSubmit = async () => {
    if (!isEdit && !selectedPoId) { toast.error('Pilih Purchase Order'); return }
    if (!warehouseId) { toast.error('Pilih Gudang'); return }
    if (lines.length === 0) { toast.error('Minimal 1 item'); return }

    // Validasi: qty datang tidak boleh negatif (tidak terkirim tidak boleh > qty_ordered)
    const invalidNotDelivered = lines.filter(l => l.qty_po_uom < 0)
    if (invalidNotDelivered.length > 0) {
      toast.error('Qty tidak terkirim tidak boleh melebihi total PO')
      return
    }

    // Validasi: qty diterima (net) tidak boleh melebihi sisa PO
    // qtyDiterima = qty_po_uom - qty_rejected
    const invalidLines = lines.filter(l => {
      const qtyDiterima = Math.max(0, l.qty_po_uom - l.qty_rejected)
      return qtyDiterima > l.qty_remaining
    })
    if (invalidLines.length > 0) {
      toast.error('Qty diterima tidak boleh melebihi sisa qty PO')
      return
    }

    // Validasi: qty ditolak tidak boleh melebihi qty datang (qty_po_uom)
    const invalidReject = lines.filter(l => l.qty_rejected > l.qty_po_uom)
    if (invalidReject.length > 0) {
      toast.error('Qty ditolak tidak boleh melebihi qty barang yang datang')
      return
    }

    // Validasi: alasan tolak wajib diisi kalau ada yang ditolak
    const missingReason = lines.filter(l => l.qty_rejected > 0 && !l.reject_reason)
    if (missingReason.length > 0) {
      toast.error('Pilih alasan penolakan untuk item yang ditolak')
      return
    }

    // Validasi: minimal ada 1 item yang benar-benar diterima
    const allZero = lines.every(l => (l.qty_po_uom - l.qty_rejected) <= 0)
    if (allZero) {
      toast.error('Minimal 1 item harus diterima (qty diterima > 0)')
      return
    }

    const payload = {
      po_id: selectedPoId,
      warehouse_id: warehouseId,
      received_date: receivedDate || undefined,
      invoice_number: invoiceNumber || null,
      invoice_date: invoiceDate || null,
      notes: notes || null,
      lines: lines.map(l => ({
        po_line_id: l.po_line_id,
        product_id: l.product_id,
        qty_po_uom: l.qty_po_uom,           // qty datang = qty_ordered - qty_not_delivered
        qty_received: l.qty_received,        // hasil timbang (satuan operasional)
        uom_received: l.uom_received,
        qty_rejected: l.qty_rejected || 0,
        reject_reason: l.reject_reason || null,
        unit_price_invoice: l.unit_price_invoice,
      })),
    }

    if (isEdit) {
      updateGR.mutate(payload)
    } else {
      createGR.mutateAsync(payload)
        .then(() => { toast.success('Penerimaan barang berhasil dibuat'); navigate('/inventory/goods-receipts') })
        .catch((err: unknown) => toast.error(parseApiError(err, 'Gagal membuat penerimaan barang')))
    }
  }

  const totalInvoice = lines.reduce((sum, l) => {
    const qtyDiterima = Math.max(0, l.qty_po_uom - l.qty_rejected)
    return sum + qtyDiterima * l.unit_price_invoice
  }, 0)
  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <div className="h-screen flex flex-col bg-gray-50/50 dark:bg-gray-900/50">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/60 px-6 py-4 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/inventory/goods-receipts")}
              className="p-2 -ml-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-2.5 bg-teal-50 dark:bg-teal-900/20 rounded-xl hidden sm:block">
              <PackageCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                {isEdit ? "Edit Penerimaan Barang" : "Terima Barang"}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                {isEdit
                  ? "Perbarui data penerimaan barang"
                  : "Pilih PO dan catat penerimaan barang ke gudang"}
              </p>
            </div>
          </div>
          <button
            onClick={handleSubmit}
            disabled={
              createGR.isPending || updateGR.isPending || lines.length === 0
            }
            className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 disabled:opacity-50 transition-all shadow-sm shadow-teal-600/20 shrink-0"
          >
            <Save className="w-4 h-4" />{" "}
            <span className="hidden sm:inline">
              {createGR.isPending || updateGR.isPending
                ? "Menyimpan..."
                : "Simpan Penerimaan"}
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-6 pb-24">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* General Information Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200/60 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/80 flex items-center gap-2">
              <Info className="w-5 h-5 text-gray-400 dark:text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                Informasi Dasar
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Purchase Order <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={selectedPoId}
                      onChange={(e) => setSelectedPoId(e.target.value)}
                      disabled={isEdit}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm disabled:opacity-60 disabled:bg-gray-50 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all appearance-none shadow-sm"
                    >
                      <option value="">Pilih Purchase Order...</option>
                      {receivablePOs.map((po) => (
                        <option key={po.id} value={po.id}>
                          {po.po_number} — {po.supplier_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Gudang Tujuan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <select
                      value={warehouseId}
                      onChange={(e) => setWarehouseId(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all appearance-none shadow-sm"
                    >
                      <option value="">Pilih Gudang Penerima...</option>
                      {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.warehouse_name} ({w.branch_name})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tanggal Terima
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(e) => setReceivedDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    No. Invoice Supplier
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Contoh: INV-2026-001"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tanggal Invoice
                  </label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm"
                  />
                </div>
                <div className="md:col-span-2 lg:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Catatan Tambahan
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Opsional"
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all shadow-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Line Items Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200/60 dark:border-gray-700/60 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200/60 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-800/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                  Daftar Barang ({lines.length})
                </h2>
              </div>
              {lines.length > 0 && (
                <div className="bg-teal-50 dark:bg-teal-900/30 px-3 py-1.5 rounded-lg border border-teal-100 dark:border-teal-800">
                  <span className="text-xs text-teal-700 dark:text-teal-400 font-medium mr-2">
                    Estimasi Tagihan:
                  </span>
                  <span className="text-sm font-mono font-bold text-teal-800 dark:text-teal-300">
                    Rp {fmt(Math.round(totalInvoice))}
                  </span>
                </div>
              )}
            </div>

            {lines.length === 0 ? (
              <div className="px-6 py-20 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-gray-50 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 border border-gray-100 dark:border-gray-700">
                  <PackageCheck className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                </div>
                <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">
                  Belum Ada Barang
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
                  {selectedPoId &&
                  selectedPO?.lines &&
                  selectedPO.lines.length > 0
                    ? "Semua item pada PO ini sudah diterima sepenuhnya."
                    : "Pilih Purchase Order di atas untuk memuat daftar barang yang akan diterima."}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                {lines.map((l) => (
                  <GRLineCard
                    key={l.key}
                    line={l}
                    onChange={handleLineChange}
                    onRemove={handleLineRemove}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
