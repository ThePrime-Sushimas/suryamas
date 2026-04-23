import { z } from "zod"

const statusValues = [
  "READY",
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "CANCELLED",
  "FAILED",
  "SUPERSEDED",
] as const

export const posAggregatesFormSchema = z.object({
  branch_id: z.string().nullable(),

  source_type: z.literal("POS"),

  source_id: z
    .string()
    .min(1, "Source ID wajib diisi"),

  source_ref: z
    .string()
    .min(1, "Reference wajib diisi"),

  transaction_date: z
    .string()
    .min(1, "Tanggal transaksi wajib diisi"),

  payment_method_id: z.number({
    required_error: "Metode pembayaran wajib dipilih",
    invalid_type_error: "Metode pembayaran wajib dipilih",
  }),

  gross_amount: z.number().min(0, "Gross tidak boleh negatif"),
  discount_amount: z.number().min(0),
  tax_amount: z.number().min(0),
  service_charge_amount: z.number().min(0),
  bill_after_discount: z.number().min(0),
  rounding_amount: z.number(),
  delivery_cost: z.number().min(0),
  order_fee: z.number().min(0),
  promotion_discount_amount: z.number().min(0),
  voucher_discount_amount: z.number().min(0),
  percentage_fee_amount: z.number().min(0),
  fixed_fee_amount: z.number().min(0),
  total_fee_amount: z.number().min(0),
  nett_amount: z.number().min(0),

  currency: z
    .string()
    .min(1, "Currency wajib diisi"),

  status: z.enum(statusValues),
})

export type PosAggregatesFormData = z.infer<typeof posAggregatesFormSchema>

