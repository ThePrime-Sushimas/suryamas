import type { PiPaymentDueInfo } from "../api/purchaseInvoices.api";
import { fmtDate } from "../utils/purchaseInvoice.formatters";

type Variant = "card" | "inline" | "table";

export function PurchaseInvoicePaymentDue({
  info,
  variant = "card",
}: {
  info: PiPaymentDueInfo | null | undefined;
  variant?: Variant;
}) {
  if (!info)
    return variant === "table" ? (
      <span className="text-gray-400">—</span>
    ) : null;

  const dateLabel =
    info.date != null
      ? fmtDate(info.date) + (!info.confirmed ? " (estimasi)" : "")
      : info.text;

  if (variant === "table") {
    return (
      <div className="min-w-0">
        {dateLabel ? (
          <p className="text-gray-700 dark:text-gray-300">{dateLabel}</p>
        ) : (
          <p className="text-gray-400">—</p>
        )}
        {info.term_name && (
          <p className="text-[10px] text-gray-400 truncate" title={info.hint}>
            {info.term_name}
          </p>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span
        className="text-sm text-gray-700 dark:text-gray-300"
        title={info.hint}
      >
        {dateLabel ?? "—"}
      </span>
    );
  }

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm ${
        info.confirmed
          ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20"
          : "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
      }`}
    >
      <p className="font-medium text-gray-900 dark:text-white">
        {info.label}
        {dateLabel != null && `: ${dateLabel}`}
      </p>
      {info.term_name && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Term: {info.term_name}
          {info.base_source === "invoice" && " · dari tanggal invoice"}
          {info.base_source === "gr" && " · dari tanggal terima barang (GR)"}
        </p>
      )}
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        {info.hint}
      </p>
    </div>
  );
}
