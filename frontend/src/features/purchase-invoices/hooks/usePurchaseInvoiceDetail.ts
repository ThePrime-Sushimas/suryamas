import { useParams } from "react-router-dom";
import { usePermissionStore } from "@/features/branch_context/store/permission.store";
import {
  usePurchaseInvoice,
  usePurchaseInvoiceAttachments,
} from "../api/purchaseInvoices.api";
import { isStagingInvoiceNumber } from "../utils/purchaseInvoiceStaging";
import type { PurchaseInvoiceGpLineAudit } from "../api/purchaseInvoices.api";

export function usePurchaseInvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const hasPermission = usePermissionStore((state) => state.hasPermission);

  const canApprove = hasPermission("purchase_invoices", "approve");
  const canRelease = hasPermission("purchase_invoices", "release");

  const { data: inv, isLoading } = usePurchaseInvoice(id ?? "");
  const { data: attachments } = usePurchaseInvoiceAttachments(id ?? "");

  // Derived — only computed when inv is available
  const hasOverQty = inv?.lines.some((l) => l.match_status === "OVER") ?? false;
  const isStaging = inv ? isStagingInvoiceNumber(inv.invoice_number) : false;
  const canSplit =
    !!inv &&
    (inv.status === "DRAFT" || inv.status === "REJECTED") &&
    inv.lines.length >= 2 &&
    (inv.charges?.length ?? 0) === 0;

  // GP audit grouping
  const gpLineAudits: PurchaseInvoiceGpLineAudit[] = inv?.gp_line_audits ?? [];

  const gpAuditsByDoc = new Map<string, PurchaseInvoiceGpLineAudit[]>();
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

  return {
    id: id ?? "",
    inv,
    isLoading,
    attachments,
    canApprove,
    canRelease,
    hasOverQty,
    isStaging,
    canSplit,
    gpLineAudits,
    gpAuditsByDoc,
    allGpLinesConfirmed,
    hasUnconfirmedGp,
  };
}
