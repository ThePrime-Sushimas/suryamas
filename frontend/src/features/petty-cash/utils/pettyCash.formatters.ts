export const fmtCurrency = (v: number | null) =>
  v == null ? '—' : new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(v)

export const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

export const fmtQty = (v: number | null) =>
  v == null ? '—' : v % 1 === 0 ? String(v) : v.toFixed(2)
