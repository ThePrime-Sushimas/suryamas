// Branch Module Constants

export const BRANCH_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const

export const DAYS_OF_WEEK = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
] as const

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  LIMIT_OPTIONS: [10, 25, 50, 100],
} as const

export const TOAST_DURATION = {
  SUCCESS: 3000,
  ERROR: 4000,
  INFO: 3000,
} as const

export const SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc',
} as const

export type BranchStatus = typeof BRANCH_STATUS[keyof typeof BRANCH_STATUS]
export type DayOfWeek = typeof DAYS_OF_WEEK[number]
export type SortOrder = typeof SORT_ORDER[keyof typeof SORT_ORDER]
