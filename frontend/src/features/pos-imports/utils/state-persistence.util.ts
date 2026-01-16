/**
 * State Persistence Utility
 * Saves and restores state from localStorage
 */

import type { PosImport } from '../types/pos-imports.types'

interface PersistedState {
  imports: PosImport[]
  selectedIds: string[]
  filters: Record<string, string | undefined>
  lastFetchTime: number
}

const STORAGE_KEY = 'pos_imports_state'
const MAX_AGE_MS = 60 * 60 * 1000 // 1 hour

export const saveState = (state: Partial<PersistedState>): void => {
  try {
    const current = loadState()
    const merged = { ...current, ...state, lastFetchTime: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch (error) {
    console.warn('Failed to save state:', error)
  }
}

export const loadState = (): PersistedState | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return null

    const parsed: PersistedState = JSON.parse(saved)
    
    // Check if data is stale
    if (Date.now() - parsed.lastFetchTime > MAX_AGE_MS) {
      clearState()
      return null
    }

    return parsed
  } catch (error) {
    console.warn('Failed to load state:', error)
    return null
  }
}

export const clearState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.warn('Failed to clear state:', error)
  }
}
