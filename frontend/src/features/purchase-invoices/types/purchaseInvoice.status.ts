import {
  FileText,
  Send,
  CheckCircle2,
  XCircle,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";

/** Status display untuk Purchase Invoice */
export const PI_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  DRAFT: {
    label: "Draft",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    icon: FileText,
  },
  SUBMITTED: {
    label: "Submitted",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    icon: Send,
  },
  APPROVED: {
    label: "Approved",
    color:
      "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    icon: XCircle,
  },
  POSTED: {
    label: "Posted",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    icon: ClipboardCheck,
  },
};

/** Status display untuk Goods Processing line (digunakan di DetailPage) */
export const GP_LINE_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  PENDING: {
    label: "Menunggu",
    color: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  },
  PROCESSING: {
    label: "Diproses",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  DONE: {
    label: "Item selesai",
    color:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  },
  CONFIRMED: {
    label: "Selesai",
    color:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-blue-300",
  },
  REJECTED: {
    label: "Ditolak",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  },
};

/** Label untuk charge type */
export const PI_CHARGE_LABELS: Record<string, string> = {
  DISCOUNT: "Diskon",
  SHIPPING: "Ongkir",
  ADMIN_FEE: "Biaya admin",
  OTHER: "Lainnya",
};

/** Label untuk file type attachment */
export const FILE_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Invoice",
  DELIVERY_NOTE: "Delivery Note",
  SURAT_JALAN: "Surat Jalan",
  PHOTO_BARANG: "Foto Barang",
  OTHER: "Lainnya",
};

/** Normalize GP line status (QC_REVIEW → PROCESSING) */
export function normalizeGpLineStatus(status: string): string {
  return status === "QC_REVIEW" ? "PROCESSING" : status;
}
