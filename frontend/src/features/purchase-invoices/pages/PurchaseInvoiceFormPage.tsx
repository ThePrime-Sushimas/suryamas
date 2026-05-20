import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, AlertCircle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { parseApiError } from "@/lib/errorParser";
import {
  usePurchaseInvoice,
  useCreatePurchaseInvoice,
  useUpdatePurchaseInvoice,
  useAvailableGrs,
} from "../api/purchaseInvoices.api";
import { useSuppliers } from "@/features/suppliers/api/suppliers.api";
import { useBranches } from "@/features/branches/api/branches.api";
import { isSupplierEligibleForPurchaseInvoice } from "@/lib/marketplaceSupplier";
import api from "@/lib/axios";
import {
  buildProductUomsMap,
  defaultQtyInvoicedInInvoiceUom,
  mergePricelistUomForConversion,
  qtyReceivedInInvoiceUom,
  resolveInvoiceUom,
} from "../utils/purchaseInvoiceUom";

const CHARGE_TYPE_LABELS = {
  DISCOUNT: "Diskon",
  SHIPPING: "Ongkir",
  ADMIN_FEE: "Biaya admin",
  OTHER: "Lainnya",
} as const;

function computeChargeLine(amount: number, taxRate: number) {
  const tax = amount * (taxRate / 100);
  return { tax_amount: tax, total: amount + tax };
}

interface PILine {
  gr_line_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  qty_received: number;
  qty_invoiced: number;
  unit_price: number;
  tax_rate: number;
  qty_po: number;
  unit_price_po: number;
  uom_received: string;
  uom_po: string;
  uom_invoice: string;
  qty_received_invoice_uom: number;
  gr_number: string;
}

interface PIChargeRow {
  charge_type: "DISCOUNT" | "SHIPPING" | "ADMIN_FEE" | "OTHER";
  description: string;
  amount: number;
  tax_rate: number;
  sort_order: number;
}

export default function PurchaseInvoiceFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const toast = useToast();

  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [selectedGrIds, setSelectedGrIds] = useState<string[]>([]);
  const [lines, setLines] = useState<PILine[]>([]);
  const [charges, setCharges] = useState<PIChargeRow[]>([]);

  const { data: existingPI, isLoading: isFetchingPI } = usePurchaseInvoice(
    isEdit ? id : "",
  );
  const { data: suppliersData } = useSuppliers({ limit: 100 });
  const { data: branchesData } = useBranches({ limit: 100 });
  const { data: availableGrs, isLoading: isFetchingGrs } = useAvailableGrs(
    supplierId,
    branchId,
  );

  const suppliers = useMemo(() => {
    const all = suppliersData?.data ?? [];
    return all.filter(
      (s) =>
        isSupplierEligibleForPurchaseInvoice(s) ||
        (isEdit && s.id === existingPI?.supplier_id),
    );
  }, [suppliersData, isEdit, existingPI?.supplier_id]);
  const branches = branchesData?.data ?? [];

  // Initialize for edit mode
  useEffect(() => {
    if (isEdit && existingPI) {
      setSupplierId(existingPI.supplier_id);
      setBranchId(existingPI.branch_id);
      setInvoiceNumber(existingPI.invoice_number);
      setInvoiceDate(existingPI.invoice_date.slice(0, 10));
      setNotes(existingPI.notes ?? "");
      setSelectedGrIds(existingPI.gr_links.map((l) => l.goods_receipt_id));
      setLines(
        existingPI.lines.map((l) => ({
          gr_line_id: l.gr_line_id,
          product_id: l.product_id,
          product_code: l.product_code,
          product_name: l.product_name,
          qty_received: Number(l.qty_received),
          qty_invoiced: Number(l.qty_invoiced),
          unit_price: Number(l.unit_price),
          tax_rate: Number(l.tax_rate),
          qty_po: Number(l.qty_po ?? l.qty_po_uom ?? 0),
          unit_price_po: Number(l.unit_price_po ?? 0),
          uom_received: l.uom_received ?? "",
          uom_po: l.uom_po ?? "",
          uom_invoice: l.uom_invoice ?? l.uom_po ?? l.uom_received ?? "",
          qty_received_invoice_uom: Number(
            l.qty_received_invoice_uom ?? l.qty_received,
          ),
          gr_number:
            existingPI.gr_links.find(() =>
              existingPI.lines.some((pl) => pl.gr_line_id === l.gr_line_id),
            )?.goods_receipt_number ?? "—",
        })),
      );
      setCharges(
        (existingPI.charges ?? []).map((c, i) => ({
          charge_type: c.charge_type,
          description: c.description ?? "",
          amount: Number(c.amount),
          tax_rate: Number(c.tax_rate),
          sort_order: c.sort_order ?? i,
        })),
      );
    }
  }, [isEdit, existingPI]);

  // Fetch GR lines when GRs are selected (only in create mode or when adding new GRs)
  const fetchGrLines = async (grId: string) => {
    const { data } = await api.get(`/goods-receipts/${grId}`);
    const grLines = data.data.lines as Array<{
      id: string;
      product_id: string;
      product_code: string;
      product_name: string;
      qty_received: number;
      qty_po_uom: number;
      uom_po: string;
      uom_received: string;
      unit_price_invoice: number;
      unit_price_po: number;
    }>;

    const productIds = grLines.map((l) => l.product_id);
    let priceMap: Record<string, { price: number; uom_name: string; conversion_factor: number }> = {};
    let uomsMap: ReturnType<typeof buildProductUomsMap> = {};

    if (supplierId && productIds.length > 0) {
      const [plRes, uomRes] = await Promise.all([
        api.post("/pricelists/batch-lookup", {
          supplier_id: supplierId,
          product_ids: productIds,
        }),
        api.post("/product-uoms/conversions-batch", {
          product_ids: productIds,
        }),
      ]);
      priceMap = plRes.data.data ?? {};
      const rawUoms = uomRes.data.data ?? {};
      const flatRows: Array<{
        product_id: string;
        unit_name: string;
        conversion_factor: number;
      }> = [];
      for (const [productId, uoms] of Object.entries(rawUoms)) {
        for (const u of uoms as Array<{
          unit_name: string;
          conversion_factor: number;
        }>) {
          flatRows.push({
            product_id: productId,
            unit_name: u.unit_name,
            conversion_factor: u.conversion_factor,
          });
        }
      }
      uomsMap = buildProductUomsMap(flatRows);
    }

    return grLines.map((l) => {
      const qtyReceived = Number(l.qty_received);
      const pl = priceMap[l.product_id];
      const product_uoms = mergePricelistUomForConversion(uomsMap[l.product_id] ?? [], pl);
      const uom_invoice = resolveInvoiceUom(
        pl?.uom_name,
        l.uom_po ?? "",
        l.uom_received ?? "",
      );
      const qty_received_invoice_uom = qtyReceivedInInvoiceUom({
        qty_received: qtyReceived,
        uom_received: l.uom_received ?? "",
        uom_invoice,
        product_uoms,
      });
      const qty_invoiced = defaultQtyInvoicedInInvoiceUom({
        qty_received: qtyReceived,
        uom_received: l.uom_received ?? "",
        qty_po_uom: Number(l.qty_po_uom ?? 0),
        uom_po: l.uom_po ?? "",
        uom_invoice,
        product_uoms,
      });

      return {
        gr_line_id: l.id,
        product_id: l.product_id,
        product_code: l.product_code,
        product_name: l.product_name,
        qty_received: qtyReceived,
        qty_invoiced,
        unit_price: Number(l.unit_price_invoice ?? l.unit_price_po ?? 0),
        tax_rate: 11,
        qty_po: Number(l.qty_po_uom ?? 0),
        unit_price_po: Number(l.unit_price_po ?? 0),
        uom_received: l.uom_received ?? l.uom_po ?? "",
        uom_po: l.uom_po ?? "",
        uom_invoice,
        qty_received_invoice_uom,
        gr_number: data.data.gr_number,
      };
    });
  };

  const handleGrToggle = async (grId: string) => {
    if (selectedGrIds.includes(grId)) {
      setSelectedGrIds((prev) => prev.filter((id) => id !== grId));
      const grData = availableGrs?.find((g) => g.id === grId);
      if (grData) {
        setLines((prev) =>
          prev.filter((l) => l.gr_number !== grData.gr_number),
        );
      }
    } else {
      try {
        const newLines = await fetchGrLines(grId);
        setSelectedGrIds((prev) => [...prev, grId]);
        setLines((prev) => [...prev, ...newLines]);
      } catch (err) {
        toast.error("Gagal mengambil data GR");
      }
    }
  };

  const handleLineChange = (index: number, updates: Partial<PILine>) => {
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, ...updates } : l)),
    );
  };

  const handleChargeChange = (index: number, updates: Partial<PIChargeRow>) => {
    setCharges((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c)),
    );
  };

  const addChargeRow = () => {
    setCharges((prev) => [
      ...prev,
      {
        charge_type: "SHIPPING",
        description: "",
        amount: 0,
        tax_rate: 0,
        sort_order: prev.length,
      },
    ]);
  };

  const removeChargeRow = (index: number) => {
    setCharges((prev) => prev.filter((_, i) => i !== index));
  };

  const createPI = useCreatePurchaseInvoice();
  const updatePI = useUpdatePurchaseInvoice();

  const handleSubmit = async () => {
    if (!supplierId) return toast.error("Pilih Supplier");
    if (!branchId) return toast.error("Pilih Cabang");
    if (!invoiceNumber) return toast.error("Isi Nomor Invoice");
    if (lines.length === 0) return toast.error("Minimal 1 item");

    for (const c of charges) {
      if (c.charge_type === "DISCOUNT" && c.amount > 0) {
        toast.error("Diskon: nominal harus nol atau negatif.");
        return;
      }
      if (c.charge_type === "SHIPPING" && c.amount < 0) {
        toast.error("Ongkir tidak boleh negatif.");
        return;
      }
      if (c.charge_type === "ADMIN_FEE" && c.amount < 0) {
        toast.error("Biaya admin tidak boleh negatif.");
        return;
      }
    }

    const payload = {
      supplier_id: supplierId,
      branch_id: branchId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      notes: notes || null,
      lines: lines.map((l, i) => ({
        gr_line_id: l.gr_line_id,
        qty_invoiced: l.qty_invoiced,
        unit_price: l.unit_price,
        tax_rate: l.tax_rate,
        sort_order: i,
      })),
      charges: charges.map((c, i) => ({
        charge_type: c.charge_type,
        description: c.description.trim() || null,
        amount: c.amount,
        tax_rate: c.tax_rate,
        sort_order: i,
      })),
    };

    try {
      if (isEdit) {
        await updatePI.mutateAsync({ id: id!, body: payload });
        toast.success("Invoice diperbarui");
      } else {
        await createPI.mutateAsync(payload);
        toast.success("Invoice dibuat");
      }
      navigate("/inventory/purchase-invoices");
    } catch (err) {
      toast.error(parseApiError(err, "Gagal menyimpan invoice"));
    }
  };

  const totals = useMemo(() => {
    const lineAgg = lines.reduce(
      (acc, l) => {
        const subtotal = l.qty_invoiced * l.unit_price;
        const tax = subtotal * (l.tax_rate / 100);
        return {
          subtotal: acc.subtotal + subtotal,
          lineTax: acc.lineTax + tax,
          lineGrand: acc.lineGrand + subtotal + tax,
        };
      },
      { subtotal: 0, lineTax: 0, lineGrand: 0 },
    );
    const chargeAgg = charges.reduce(
      (acc, c) => {
        const { tax_amount, total } = computeChargeLine(c.amount, c.tax_rate);
        return {
          chargeTax: acc.chargeTax + tax_amount,
          chargeGrand: acc.chargeGrand + total,
        };
      },
      { chargeTax: 0, chargeGrand: 0 },
    );
    return {
      subtotal: lineAgg.subtotal,
      tax: lineAgg.lineTax + chargeAgg.chargeTax,
      totalCharges: chargeAgg.chargeGrand,
      total: lineAgg.lineGrand + chargeAgg.chargeGrand,
    };
  }, [lines, charges]);

  const fmtCurrency = (v: number) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(v);

  if (isEdit && isFetchingPI)
    return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 lg:px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/inventory/purchase-invoices")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-500"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg lg:text-xl font-bold text-gray-900 dark:text-white">
              {isEdit ? "Edit Invoice" : "Buat Invoice Baru"}
            </h1>
          </div>
          <button
            onClick={handleSubmit}
            disabled={createPI.isPending || updatePI.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 font-medium transition-all shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{isEdit ? "Simpan Perubahan" : "Buat Invoice"}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
        {/* Header Form */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Supplier
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => {
                    setSupplierId(e.target.value);
                    setSelectedGrIds([]);
                    setLines([]);
                  }}
                  disabled={isEdit}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                >
                  <option value="">Pilih Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.supplier_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Cabang
                </label>
                <select
                  value={branchId}
                  onChange={(e) => {
                    setBranchId(e.target.value);
                    setSelectedGrIds([]);
                    setLines([]);
                  }}
                  disabled={isEdit}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none disabled:opacity-50"
                >
                  <option value="">Pilih Cabang</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.branch_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Nomor Invoice Supplier
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Contoh: INV/2026/001"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Tanggal Invoice
                </label>
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Bisa diubah. Jatuh tempo dihitung dari tanggal ini; draft dari GR
                  otomatis memakai tanggal terima barang sampai finance menggantinya.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                Catatan
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opsional..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>
          </div>

          {/* Available GRs Section */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm">
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Pilih Penerimaan Barang (GR)
            </h2>
            {!supplierId || !branchId ? (
              <div className="text-center py-8 text-gray-400 text-sm italic">
                Pilih supplier dan cabang terlebih dahulu
              </div>
            ) : isFetchingGrs ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"
                  />
                ))}
              </div>
            ) : availableGrs?.length === 0 && !isEdit ? (
              <div className="text-center py-8 text-gray-400 text-sm">
                Tidak ada GR tersedia untuk supplier & cabang ini
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-auto pr-2 no-scrollbar">
                {availableGrs?.map((gr) => (
                  <label
                    key={gr.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGrIds.includes(gr.id)}
                      onChange={() => handleGrToggle(gr.id)}
                      disabled={isEdit}
                      className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {gr.gr_number}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {new Date(gr.received_date).toLocaleDateString()}
                      </div>
                    </div>
                  </label>
                ))}
                {isEdit &&
                  existingPI?.gr_links.map((gl) => (
                    <div
                      key={gl.goods_receipt_id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/30 dark:bg-indigo-900/10"
                    >
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {gl.goods_receipt_number}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {new Date(gl.received_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Line Items Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Detail Barang
            </h2>
            <div className="text-xs text-gray-500">
              {lines.length} item dipilih
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-[10px] uppercase">
                    Produk
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-[10px] uppercase">
                    Qty GR
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-[10px] uppercase">
                    Qty Invoice
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-[10px] uppercase">
                    Harga Satuan
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-[10px] uppercase">
                    PPN %
                  </th>
                  <th className="px-4 py-2 text-right font-semibold text-[10px] uppercase">
                    Total
                  </th>
                  <th className="px-4 py-2 text-center font-semibold text-[10px] uppercase">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {lines.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-gray-400 italic"
                    >
                      Belum ada barang. Pilih GR di atas untuk memulai.
                    </td>
                  </tr>
                ) : (
                  lines.map((l, index) => {
                    const lineSubtotal = l.qty_invoiced * l.unit_price;
                    const lineTotal = lineSubtotal * (1 + l.tax_rate / 100);
                    const uomInvoice = l.uom_invoice || l.uom_received;
                    const qtyReceivedInv = l.qty_received_invoice_uom;
                    const isOver = l.qty_invoiced > qtyReceivedInv;
                    const isUnder = l.qty_invoiced < qtyReceivedInv;

                    return (
                      <tr
                        key={index}
                        className="hover:bg-gray-50/50 dark:hover:bg-gray-700/20 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {l.product_name}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono">
                            {l.product_code} · {l.gr_number}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400 font-medium">
                          {qtyReceivedInv}
                          {uomInvoice ? (
                            <span className="text-[10px] text-gray-400 block">
                              {uomInvoice}
                            </span>
                          ) : null}
                          {l.uom_received &&
                          uomInvoice &&
                          l.uom_received !== uomInvoice ? (
                            <span className="text-[10px] text-gray-400 block">
                              ({l.qty_received} {l.uom_received} di GR)
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            value={l.qty_invoiced}
                            onChange={(e) =>
                              handleLineChange(index, {
                                qty_invoiced: Number(e.target.value),
                              })
                            }
                            className={`w-20 px-2 py-1 border rounded text-center text-sm outline-none focus:ring-2 ${isOver ? "border-red-300 focus:ring-red-500 text-red-600" : "border-gray-200 dark:border-gray-600 focus:ring-indigo-500"}`}
                          />
                          {uomInvoice ? (
                            <span className="text-[10px] text-gray-400 block">
                              {uomInvoice}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            value={l.unit_price}
                            onChange={(e) =>
                              handleLineChange(index, {
                                unit_price: Number(e.target.value),
                              })
                            }
                            className="w-28 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-right text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            PO: {fmtCurrency(l.unit_price_po)}
                            {uomInvoice ? `/${uomInvoice}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="number"
                            value={l.tax_rate}
                            onChange={(e) =>
                              handleLineChange(index, {
                                tax_rate: Number(e.target.value),
                              })
                            }
                            className="w-16 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-center text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white">
                          {fmtCurrency(lineTotal)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isOver ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                              <AlertCircle className="w-3 h-3" /> OVER
                            </span>
                          ) : isUnder ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700 text-[10px] font-bold">
                              UNDER
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">
                              MATCH
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between bg-gray-50/30 dark:bg-gray-800/40">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">
              Diskon &amp; biaya lain
            </h2>
            <button
              type="button"
              onClick={addChargeRow}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah baris
            </button>
          </div>
          <div className="overflow-x-auto px-2 pb-2">
            {charges.length === 0 ? (
              <p className="text-sm text-gray-400 italic px-3 py-4 text-center">
                Opsional — ongkir, diskon nota, biaya admin, dll.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-gray-500 dark:text-gray-400 text-[10px] uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left">Jenis</th>
                    <th className="px-3 py-2 text-left">Keterangan</th>
                    <th className="px-3 py-2 text-right">Nilai (pra-PPN)</th>
                    <th className="px-3 py-2 text-center">PPN %</th>
                    <th className="px-3 py-2 text-right">Total baris</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {charges.map((c, index) => {
                    const { total } = computeChargeLine(c.amount, c.tax_rate);
                    return (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <select
                            value={c.charge_type}
                            onChange={(e) =>
                              handleChargeChange(index, {
                                charge_type: e.target.value as PIChargeRow["charge_type"],
                              })
                            }
                            className="w-full max-w-[140px] px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800"
                          >
                            {(Object.keys(CHARGE_TYPE_LABELS) as Array<keyof typeof CHARGE_TYPE_LABELS>).map(
                              (k) => (
                                <option key={k} value={k}>
                                  {CHARGE_TYPE_LABELS[k]}
                                </option>
                              ),
                            )}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={c.description}
                            onChange={(e) =>
                              handleChargeChange(index, { description: e.target.value })
                            }
                            placeholder="Opsional"
                            className="w-full min-w-[120px] px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-800"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            value={c.amount}
                            onChange={(e) =>
                              handleChargeChange(index, {
                                amount: Number(e.target.value),
                              })
                            }
                            className="w-28 px-2 py-1 border border-gray-200 dark:border-gray-600 rounded text-right text-xs bg-white dark:bg-gray-800"
                          />
                          {c.charge_type === "DISCOUNT" ? (
                            <p className="text-[10px] text-amber-600 mt-0.5">
                              Gunakan nilai negatif
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            value={c.tax_rate}
                            onChange={(e) =>
                              handleChargeChange(index, {
                                tax_rate: Number(e.target.value),
                              })
                            }
                            className="w-14 px-1 py-1 border border-gray-200 dark:border-gray-600 rounded text-center text-xs bg-white dark:bg-gray-800"
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900 dark:text-white">
                          {fmtCurrency(total)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeChargeRow(index)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            aria-label="Hapus baris"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Summary Footer */}
          <div className="bg-gray-50/50 dark:bg-gray-700/30 px-6 py-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-col items-end gap-2">
              <div className="flex justify-between w-64 text-sm">
                <span className="text-gray-500">Subtotal barang</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {fmtCurrency(totals.subtotal)}
                </span>
              </div>
              {charges.length > 0 ? (
                <div className="flex justify-between w-64 text-sm">
                  <span className="text-gray-500">Diskon &amp; biaya (net)</span>
                  <span
                    className={`font-medium ${
                      totals.totalCharges < 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-900 dark:text-white"
                    }`}
                  >
                    {fmtCurrency(totals.totalCharges)}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between w-64 text-sm">
                <span className="text-gray-500">Total PPN</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {fmtCurrency(totals.tax)}
                </span>
              </div>
              <div className="flex justify-between w-64 pt-2 border-t border-gray-200 dark:border-gray-600 font-bold text-lg">
                <span className="text-indigo-600 dark:text-indigo-400">
                  Total Akhir
                </span>
                <span className="text-indigo-600 dark:text-indigo-400">
                  {fmtCurrency(totals.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
