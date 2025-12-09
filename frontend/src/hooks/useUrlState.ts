import { useSearchParams } from 'react-router-dom'
import { useCallback } from 'react'

export function useUrlState<T extends Record<string, string>>(defaults: T) {
  const [searchParams, setSearchParams] = useSearchParams()

  const state = Object.keys(defaults).reduce((acc, key) => {
    const value = searchParams.get(key)
    acc[key as keyof T] = (value !== null ? value : defaults[key]) as T[keyof T]
    return acc
  }, {} as T)

  const setState = useCallback((updates: Partial<T>) => {
    const newParams = new URLSearchParams(searchParams)
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        newParams.delete(key)
      } else {
        newParams.set(key, String(value))
      }
    })
    setSearchParams(newParams)
  }, [searchParams, setSearchParams])

  const resetState = useCallback(() => {
    setSearchParams(new URLSearchParams())
  }, [setSearchParams])

  return { state, setState, resetState }
}
