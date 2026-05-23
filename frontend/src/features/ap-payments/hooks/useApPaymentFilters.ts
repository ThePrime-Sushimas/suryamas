import { useState, useMemo, useCallback, useEffect } from 'react'
import { useUrlFilters, type UrlFilterUtils } from '@/lib/urlFilters'
import type { ApPaymentFilters } from '../types/apPaymentFilters.types'
import type { ApPaymentListQuery } from '../types/apPaymentFilters.types'
import {
  DEFAULT_AP_PAYMENT_FILTERS,
  filtersAreEqual,
  mergeApPaymentFilters,
  parseApPaymentFilters,
  stringifyApPaymentFilters,
  toApPaymentListQuery,
} from '../utils/apPaymentFilters.url'

const AP_FILTER_UTILS: UrlFilterUtils<ApPaymentFilters> = {
  defaults: DEFAULT_AP_PAYMENT_FILTERS,
  parse: parseApPaymentFilters,
  stringify: stringifyApPaymentFilters,
  merge: mergeApPaymentFilters,
  equals: filtersAreEqual,
}

export function useApPaymentFilters() {
  // Draft state — always declared first (stable hook order)
  const [draft, setDraftState] = useState<ApPaymentFilters>(DEFAULT_AP_PAYMENT_FILTERS)

  const base = useUrlFilters<ApPaymentFilters>({
    ...AP_FILTER_UTILS,
    searchField: undefined,
    debounceMs: 0,
  })

  // Sync draft from URL on first mount and when URL changes externally (back button, tab click)
  // Only sync if draft is not dirty (no pending user edits)
  const appliedStr = stringifyApPaymentFilters(base.filters).toString()
  const isDirtyRef = { current: !filtersAreEqual(draft, base.filters) }
  useEffect(() => {
    if (!isDirtyRef.current) {
      setDraftState(base.filters)
    }
  }, [appliedStr]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDirty = useMemo(
    () => !filtersAreEqual(draft, base.filters),
    [draft, base.filters],
  )

  const setDraft = useCallback((patch: Partial<ApPaymentFilters>) => {
    setDraftState((prev) => mergeApPaymentFilters(prev, patch))
  }, [])

  const applyFilters = useCallback(() => {
    base.setFilters(draft)
  }, [base, draft])

  const setTab = useCallback((tab: ApPaymentFilters['tab']) => {
    const next = mergeApPaymentFilters(draft, { tab, status: '' })
    setDraftState(next)
    base.setFilters({ tab, status: '' })
  }, [base, draft])

  const resetFilters = useCallback(() => {
    setDraftState(DEFAULT_AP_PAYMENT_FILTERS)
    base.resetFilters()
  }, [base])

  const apiQuery: ApPaymentListQuery = useMemo(
    () => toApPaymentListQuery(base.filters),
    [base.filters],
  )

  return {
    filters: base.filters,
    draft,
    setDraft,
    isDirty,
    applyFilters,
    setTab,
    resetFilters,
    setPage: base.setPage,
    setLimit: base.setLimit,
    apiQuery,
  }
}
