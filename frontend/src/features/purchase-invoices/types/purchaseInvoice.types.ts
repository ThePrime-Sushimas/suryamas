export interface PILine {
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

export type PIChargeType = "DISCOUNT" | "SHIPPING" | "ADMIN_FEE" | "OTHER";

export interface PIChargeRow {
  charge_type: PIChargeType;
  description: string;
  /** Raw string so user can type "-" then digits (type="number" breaks that). */
  amount: string;
  tax_rate: number;
  sort_order: number;
  /** Diskon memperkecil DPP barang (PPN dari net DPP); hanya jenis Diskon, PPN % baris harus seragam. */
  affects_dpp: boolean;
}

export interface SplitNotaDraft {
  key: string;
  invoice_number: string;
  invoice_date: string;
  notes: string;
  gr_line_ids: string[];
  supplier_bank_account_id: number | null;
}
