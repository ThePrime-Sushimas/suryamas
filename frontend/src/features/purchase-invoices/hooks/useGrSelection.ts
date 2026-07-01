import { useState, useEffect } from "react";
import { useToast } from "@/contexts/ToastContext";
import api from "@/lib/axios";
import {
  buildProductUomsMap,
  defaultQtyInvoicedInInvoiceUom,
  mergePricelistUomForConversion,
  qtyReceivedInInvoiceUom,
  resolveInvoiceUom,
} from "../utils/purchaseInvoiceUom";
import type { PILine } from "../types/purchaseInvoice.types";

interface UseGrSelectionOptions {
  supplierId: string;
  isEdit: boolean;
  availableGrs: Array<{ id: string; gr_number: string; received_date: string }> | undefined;
  onLinesChange: (updater: (prev: PILine[]) => PILine[]) => void;
  onInvoiceDateChange: (date: string) => void;
}

export function useGrSelection({
  supplierId,
  isEdit,
  availableGrs,
  onLinesChange,
  onInvoiceDateChange,
}: UseGrSelectionOptions) {
  const toast = useToast();
  const [selectedGrIds, setSelectedGrIds] = useState<string[]>([]);

  const syncInvoiceDateFromSelectedGrs = (grIds: string[]) => {
    if (isEdit || !availableGrs?.length || grIds.length === 0) return;
    const dates = availableGrs
      .filter((g) => grIds.includes(g.id))
      .map((g) => String(g.received_date).slice(0, 10))
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
    if (dates.length > 0) {
      onInvoiceDateChange(dates.sort((a, b) => (a < b ? 1 : -1))[0]);
    }
  };

  // Re-sync invoice date whenever selection or availableGrs changes
  useEffect(() => {
    syncInvoiceDateFromSelectedGrs(selectedGrIds);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGrIds, availableGrs, isEdit]);

  const fetchGrLines = async (grId: string): Promise<PILine[]> => {
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
    let priceMap: Record<
      string,
      { price: number; uom_name: string; conversion_factor: number }
    > = {};
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
      const product_uoms = mergePricelistUomForConversion(
        uomsMap[l.product_id] ?? [],
        pl,
      );
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
      const nextIds = selectedGrIds.filter((id) => id !== grId);
      setSelectedGrIds(nextIds);
      const grData = availableGrs?.find((g) => g.id === grId);
      if (grData) {
        onLinesChange((prev) =>
          prev.filter((l) => l.gr_number !== grData.gr_number),
        );
      }
      syncInvoiceDateFromSelectedGrs(nextIds);
    } else {
      try {
        const newLines = await fetchGrLines(grId);
        const nextIds = [...selectedGrIds, grId];
        setSelectedGrIds(nextIds);
        onLinesChange((prev) => [...prev, ...newLines]);
        syncInvoiceDateFromSelectedGrs(nextIds);
      } catch {
        toast.error("Gagal mengambil data GR");
      }
    }
  };

  return {
    selectedGrIds,
    setSelectedGrIds,
    handleGrToggle,
  };
}
