import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { bankAccountsApi } from "@/features/bank-accounts/api/bankAccounts.api";
import { isSupplierEligibleForPurchaseInvoice } from "@/lib/marketplaceSupplier";
import { parseChargeAmountInput } from "../utils/purchaseInvoice.charges";
import { useGrSelection } from "./useGrSelection";
import type { PILine, PIChargeRow } from "../types/purchaseInvoice.types";

const TAX_RATE_EPS = 0.001;

export function usePurchaseInvoiceForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const toast = useToast();

  // Header fields
  const [supplierId, setSupplierId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [supplierBankAccountId, setSupplierBankAccountId] = useState<
    number | null
  >(null);

  // Line + charge state — lifted here so GrSelection can write into them
  const [lines, setLines] = useState<PILine[]>([]);
  const [charges, setCharges] = useState<PIChargeRow[]>([]);

  // Remote data
  const { data: existingPI, isLoading: isFetchingPI } = usePurchaseInvoice(
    isEdit ? (id ?? "") : "",
  );
  const { data: suppliersData } = useSuppliers({ limit: 100 });
  const { data: branchesData } = useBranches({ limit: 100, filter: { status: 'active' } });
  const { data: supplierBankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", "supplier", supplierId],
    queryFn: () => bankAccountsApi.getByOwner("supplier", supplierId),
    enabled: !!supplierId,
    staleTime: 60_000,
  });
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

  // GR selection (manages selectedGrIds + line population)
  const { selectedGrIds, setSelectedGrIds, handleGrToggle } = useGrSelection({
    supplierId,
    isEdit,
    availableGrs,
    onLinesChange: setLines,
    onInvoiceDateChange: setInvoiceDate,
  });

  // Initialize edit mode
  useEffect(() => {
    if (isEdit && existingPI) {
      setSupplierId(existingPI.supplier_id);
      setBranchId(existingPI.branch_id);
      setInvoiceNumber(existingPI.invoice_number);
      setInvoiceDate(existingPI.invoice_date.slice(0, 10));
      setNotes(existingPI.notes ?? "");
      setSupplierBankAccountId(existingPI.supplier_bank_account_id ?? null);
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
          amount:
            c.amount === 0 || c.amount === -0 ? "0" : String(Number(c.amount)),
          tax_rate: Number(c.tax_rate),
          sort_order: c.sort_order ?? i,
          affects_dpp: Boolean(c.affects_dpp),
        })),
      );
    }
  }, [isEdit, existingPI]);

  // Auto-select bank account when only one available
  useEffect(() => {
    if (isEdit) return;
    if (supplierBankAccounts.length === 1 && supplierBankAccountId == null) {
      setSupplierBankAccountId(supplierBankAccounts[0].id);
    }
  }, [isEdit, supplierBankAccounts, supplierBankAccountId]);

  // Line + charge handlers
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
        amount: "",
        tax_rate: 0,
        sort_order: prev.length,
        affects_dpp: false,
      },
    ]);
  };

  const removeChargeRow = (index: number) => {
    setCharges((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-clear affects_dpp when all lines are 0% tax
  const allLinesTaxRateZero = useMemo(
    () =>
      lines.length > 0 &&
      lines.every((l) => Math.abs(Number(l.tax_rate)) < TAX_RATE_EPS),
    [lines],
  );

  useEffect(() => {
    if (!allLinesTaxRateZero) return;
    setCharges((prev) => {
      if (!prev.some((c) => c.affects_dpp)) return prev;
      return prev.map((c) => ({ ...c, affects_dpp: false }));
    });
  }, [allLinesTaxRateZero]);

  // Mutations
  const createPI = useCreatePurchaseInvoice();
  const updatePI = useUpdatePurchaseInvoice();

  const handleSubmit = async () => {
    if (!supplierId) return toast.error("Pilih Supplier");
    if (!branchId) return toast.error("Pilih Cabang");
    if (!invoiceNumber) return toast.error("Isi Nomor Invoice");
    if (lines.length === 0) return toast.error("Minimal 1 item");

    if (charges.some((c) => c.affects_dpp)) {
      if (lines.every((l) => Math.abs(Number(l.tax_rate)) < TAX_RATE_EPS)) {
        toast.error(
          "PPN baris 0%: opsi memperkecil DPP barang tidak berlaku. Matikan centang DPP pada diskon.",
        );
        return;
      }
      const rates = new Set(lines.map((l) => Number(l.tax_rate)));
      if (rates.size > 1) {
        toast.error(
          "Diskon memperkecil DPP: semua barang harus memiliki PPN % yang sama. Samakan PPN per baris atau matikan centang DPP pada diskon.",
        );
        return;
      }
    }

    for (const c of charges) {
      const amt = parseChargeAmountInput(c.amount);
      if (c.charge_type === "DISCOUNT" && amt > 0) {
        toast.error("Diskon: nominal harus nol atau negatif.");
        return;
      }
      if (c.charge_type === "SHIPPING" && amt < 0) {
        toast.error("Ongkir tidak boleh negatif.");
        return;
      }
      if (c.charge_type === "ADMIN_FEE" && amt < 0) {
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
      supplier_bank_account_id: supplierBankAccountId,
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
        amount: parseChargeAmountInput(c.amount),
        tax_rate: c.tax_rate,
        sort_order: i,
        affects_dpp: c.charge_type === "DISCOUNT" ? c.affects_dpp : false,
      })),
    };

    try {
      if (isEdit) {
        await updatePI.mutateAsync({ id: id!, body: payload });
        toast.success("Invoice diperbarui");
        navigate(`/inventory/purchase-invoices/${id}`);
      } else {
        await createPI.mutateAsync(payload);
        toast.success("Invoice dibuat");
        navigate("/inventory/purchase-invoices");
      }
    } catch (err) {
      toast.error(parseApiError(err, "Gagal menyimpan invoice"));
    }
  };

  return {
    // identity
    id,
    isEdit,
    isFetchingPI,
    existingPI,
    // header fields
    supplierId,
    setSupplierId,
    branchId,
    setBranchId,
    invoiceNumber,
    setInvoiceNumber,
    invoiceDate,
    setInvoiceDate,
    notes,
    setNotes,
    supplierBankAccountId,
    setSupplierBankAccountId,
    // reference data
    suppliers,
    branches,
    supplierBankAccounts,
    availableGrs,
    isFetchingGrs,
    // GR selection
    selectedGrIds,
    handleGrToggle,
    // lines + charges
    lines,
    charges,
    handleLineChange,
    handleChargeChange,
    addChargeRow,
    removeChargeRow,
    allLinesTaxRateZero,
    // submit
    createPI,
    updatePI,
    handleSubmit,
  };
}
