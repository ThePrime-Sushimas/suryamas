import { z } from 'zod'

export const trialBalanceQuerySchema = z.object({
  query: z.object({
    company_id: z.string().optional(),
    date_from: z.string().min(1, 'date_from wajib diisi').regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    date_to: z.string().min(1, 'date_to wajib diisi').regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD'),
    branch_id: z.string().optional()
  }).refine((data) => {
    return data.date_from <= data.date_to
  }, {
    message: "date_from tidak boleh lebih besar dari date_to",
    path: ["date_from"]
  })
})
