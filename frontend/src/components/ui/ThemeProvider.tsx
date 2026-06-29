import { createContext, useContext, type ReactNode } from 'react'
import { getTheme, type PresetKey, type AccentKey, type Theme } from '@/lib/theme'

// ─── Context Shape ────────────────────────────────────────────────────────────

interface ThemeConfig {
  preset: PresetKey
  accent: AccentKey
}

const DEFAULT_CONFIG: ThemeConfig = {
  preset: 'standard',
  accent: 'sky',
}

// createContext diberi DEFAULT_CONFIG langsung — bukan null — supaya
// useThemeConfig() dan useTheme() bekerja normal tanpa Provider di atas.
// Tidak ada throw error, tidak ada warning. Sengaja untuk migrasi bertahap:
// modul yang belum dipasangi ThemeProvider tetap dapat default (standard +
// indigo) dan tidak pecah.
const ThemeConfigContext = createContext<ThemeConfig>(DEFAULT_CONFIG)

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ThemeProviderProps {
  preset?: PresetKey
  accent?: AccentKey
  children: ReactNode
}

export function ThemeProvider({
  preset = 'standard',
  accent = 'sky',
  children,
}: ThemeProviderProps) {
  return (
    <ThemeConfigContext.Provider value={{ preset, accent }}>
      {children}
    </ThemeConfigContext.Provider>
  )
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

/**
 * useThemeConfig — Return { preset, accent } dari context terdekat.
 * Kalau tidak ada ThemeProvider di atas, return DEFAULT_CONFIG
 * (standard + indigo). Tidak throw, tidak warn.
 */
export function useThemeConfig(): ThemeConfig {
  return useContext(ThemeConfigContext)
}

/**
 * useTheme — Return objek theme siap pakai (gabungan preset + accent).
 * Shorthand dari: const { preset, accent } = useThemeConfig(); getTheme(preset, accent)
 *
 * @example
 * const t = useTheme()
 * <div className={t.card}>...</div>
 * <button className={`${t.button.base} ${t.accentButton.solid}`}>Simpan</button>
 */
export function useTheme(): Theme {
  const { preset, accent } = useThemeConfig()
  return getTheme(preset, accent)
}
