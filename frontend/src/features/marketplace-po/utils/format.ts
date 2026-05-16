export const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n)
export const fmtCurrency = (n: number) => `Rp${fmt(n)}`

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

export const todayIso = () => new Date().toISOString().slice(0, 10)
