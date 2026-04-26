const DIGITAL_TYPES = new Set(['ewallet', 'qris', 'digital', 'va'])
const CARD_TYPES = new Set(['debit_card', 'credit_card', 'card', 'debit', 'credit'])

export function paymentDotColor(paymentType: string): string {
  const pt = paymentType.toLowerCase()
  if (DIGITAL_TYPES.has(pt)) return 'bg-emerald-500'
  if (CARD_TYPES.has(pt)) return 'bg-amber-500'
  return 'bg-gray-400'
}
