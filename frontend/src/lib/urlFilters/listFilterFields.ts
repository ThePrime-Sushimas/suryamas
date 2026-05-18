/** Reusable parsers/serializers for list-page URL filters */

export function parsePositiveInt(
  value: string | null,
  fallback: number,
  max?: number,
): number {
  if (!value) return fallback
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  if (max != null && n > max) return max
  return n
}

export function parseEnum<T extends string>(
  value: string | null,
  allowed: ReadonlySet<T>,
  fallback: T,
): T {
  if (value && allowed.has(value as T)) return value as T
  return fallback
}

export function parseString(value: string | null, fallback = ''): string {
  return value ?? fallback
}

export function serializeString(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export function serializeNumber(value: number, defaultValue: number): string | null {
  return value === defaultValue ? null : String(value)
}

export function mergeWithPageReset<T extends { page: number }>(
  current: T,
  patch: Partial<T>,
  defaults: T,
  resetPageOnKeys: (keyof T)[],
): T {
  const next = { ...current, ...patch } as T

  const shouldResetPage = resetPageOnKeys.some(
    (key) =>
      key in patch &&
      patch[key] !== undefined &&
      !Object.is(patch[key], current[key]),
  )

  if (shouldResetPage && !('page' in patch)) {
    next.page = defaults.page
  }

  return next
}

export function filtersEqualFromStringify<T>(
  a: T,
  b: T,
  stringify: (filters: T) => URLSearchParams,
): boolean {
  return stringify(a).toString() === stringify(b).toString()
}
