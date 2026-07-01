import { PI_STATUS_CONFIG } from "../types/purchaseInvoice.status";

interface InvoiceStatusBadgeProps {
  status: string;
}

export function InvoiceStatusBadge({ status }: InvoiceStatusBadgeProps) {
  const config = PI_STATUS_CONFIG[status];
  if (!config) return null;

  return (
    <span
      className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider ${config.color}`}
    >
      {config.label}
    </span>
  );
}