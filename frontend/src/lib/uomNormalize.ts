/** Canonical UOM name for case-insensitive / alias matching (Gram, KG, etc.). */
const UOM_ALIASES: Record<string, string> = {
  kg: 'kilogram',
  kilo: 'kilogram',
  kilogram: 'kilogram',
  g: 'gram',
  gr: 'gram',
  gram: 'gram',
}

export function normalizeUomName(name: string): string {
  const key = name.trim().toLowerCase()
  return UOM_ALIASES[key] ?? key
}

export function uomNamesMatch(a: string, b: string): boolean {
  return normalizeUomName(a) === normalizeUomName(b)
}
