export const fmtCurrency = (v: number | null | undefined): string =>
  v == null
    ? '—'
    : new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(v)

export const fmtDate = (d: string | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—'

export const fmtDateTime = (d: string | null | undefined): string =>
  d
    ? new Date(d).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

export const fmtQty = (n: number | null | undefined): string =>
  n == null ? '—' : n % 1 === 0 ? String(n) : n.toFixed(2)
