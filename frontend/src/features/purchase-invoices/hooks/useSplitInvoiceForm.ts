import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { bankAccountsApi } from "@/features/bank-accounts/api/bankAccounts.api";
import type { PurchaseInvoiceDetail } from "../api/purchaseInvoices.api";
import type { SplitNotaDraft } from "../types/purchaseInvoice.types";

function newNotaKey() {
  return `nota-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createEmptyNota(
  invoiceDate: string,
  defaultBankId: number | null = null,
): SplitNotaDraft {
  return {
    key: newNotaKey(),
    invoice_number: "",
    invoice_date: invoiceDate.slice(0, 10),
    notes: "",
    gr_line_ids: [],
    supplier_bank_account_id: defaultBankId,
  };
}

export type SplitSubmitPayload = Array<{
  invoice_number: string;
  invoice_date: string;
  notes: string | null;
  gr_line_ids: string[];
  supplier_bank_account_id?: number | null;
}>;

interface UseSplitInvoiceFormOptions {
  invoice: PurchaseInvoiceDetail;
  open: boolean;
  onSubmit: (splits: SplitSubmitPayload) => void;
}

export function useSplitInvoiceForm({
  invoice,
  open,
  onSubmit,
}: UseSplitInvoiceFormOptions) {
  const defaultDate = invoice.invoice_date.slice(0, 10);

  const { data: supplierBankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts", "supplier", invoice.supplier_id],
    queryFn: () => bankAccountsApi.getByOwner("supplier", invoice.supplier_id),
    enabled: !!invoice.supplier_id,
    staleTime: 60_000,
  });

  const defaultBankId =
    invoice.supplier_bank_account_id ??
    (supplierBankAccounts.length === 1 ? supplierBankAccounts[0].id : null);

  const [notas, setNotas] = useState<SplitNotaDraft[]>(() => [
    createEmptyNota(defaultDate, defaultBankId),
    createEmptyNota(defaultDate, defaultBankId),
  ]);
  const [error, setError] = useState<string | null>(null);

  // Reset draft whenever modal opens
  useEffect(() => {
    if (!open) return;
    const bankId =
      invoice.supplier_bank_account_id ??
      (supplierBankAccounts.length === 1 ? supplierBankAccounts[0].id : null);
    setNotas([
      createEmptyNota(defaultDate, bankId),
      createEmptyNota(defaultDate, bankId),
    ]);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const assignmentMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const nota of notas) {
      for (const gid of nota.gr_line_ids) {
        map.set(gid, nota.key);
      }
    }
    return map;
  }, [notas]);

  const unassignedLines = invoice.lines.filter(
    (l) => !assignmentMap.has(l.gr_line_id),
  );
  const allAssigned = unassignedLines.length === 0;

  const toggleLine = (notaKey: string, grLineId: string) => {
    setNotas((prev) =>
      prev.map((n) => {
        if (n.key === notaKey) {
          const has = n.gr_line_ids.includes(grLineId);
          return {
            ...n,
            gr_line_ids: has
              ? n.gr_line_ids.filter((id) => id !== grLineId)
              : [...n.gr_line_ids, grLineId],
          };
        }
        // Remove from any other nota (exclusive assignment)
        return {
          ...n,
          gr_line_ids: n.gr_line_ids.filter((id) => id !== grLineId),
        };
      }),
    );
    setError(null);
  };

  const addNota = () => {
    setNotas((prev) => [...prev, createEmptyNota(defaultDate, defaultBankId)]);
  };

  const removeNota = (key: string) => {
    if (notas.length <= 2) return;
    setNotas((prev) => prev.filter((n) => n.key !== key));
  };

  const updateNota = (key: string, patch: Partial<SplitNotaDraft>) => {
    setNotas((prev) =>
      prev.map((n) => (n.key === key ? { ...n, ...patch } : n)),
    );
    setError(null);
  };

  const handleSubmit = () => {
    if (notas.length < 2) {
      setError("Minimal 2 nota supplier.");
      return;
    }
    if (!allAssigned) {
      setError(
        `${unassignedLines.length} baris belum dialokasi ke nota manapun.`,
      );
      return;
    }
    for (const nota of notas) {
      if (nota.gr_line_ids.length === 0) {
        setError("Setiap nota wajib memiliki minimal 1 baris item.");
        return;
      }
      if (!nota.invoice_number.trim()) {
        setError("Isi nomor invoice supplier untuk setiap nota.");
        return;
      }
    }
    const numbers = notas.map((n) => n.invoice_number.trim().toLowerCase());
    if (new Set(numbers).size !== numbers.length) {
      setError("Nomor invoice tidak boleh duplikat antar nota.");
      return;
    }

    onSubmit(
      notas.map((n) => ({
        invoice_number: n.invoice_number.trim(),
        invoice_date: n.invoice_date,
        notes: n.notes.trim() || null,
        gr_line_ids: n.gr_line_ids,
        supplier_bank_account_id: n.supplier_bank_account_id,
      })),
    );
  };

  return {
    notas,
    error,
    allAssigned,
    unassignedLines,
    assignmentMap,
    supplierBankAccounts,
    toggleLine,
    addNota,
    removeNota,
    updateNota,
    handleSubmit,
  };
}
