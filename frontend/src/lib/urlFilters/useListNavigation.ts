import { useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export type ListNavigationState = {
  listSearch?: string
}

/**
 * Navigate to detail while preserving list query string for back navigation.
 */
export function useListNavigation(listBasePath: string) {
  const navigate = useNavigate()
  const location = useLocation()

  const openDetail = useCallback(
    (detailPath: string) => {
      navigate(detailPath, {
        state: { listSearch: location.search } satisfies ListNavigationState,
      })
    },
    [navigate, location.search],
  )

  const backToList = useCallback(() => {
    const listSearch = (location.state as ListNavigationState | null)?.listSearch
    navigate(listSearch ? `${listBasePath}${listSearch}` : listBasePath)
  }, [navigate, location.state, listBasePath])

  return { openDetail, backToList, listSearchSuffix: location.search }
}
