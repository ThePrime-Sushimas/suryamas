export const GOODS_PROCESSING_LIST_PATH = '/inventory/goods-processing'

/** Preset status filter chips on list page */
export const GP_LIST_STATUS_PRESETS = [
  { value: '', label: 'Semua' },
  { value: 'DRAFT,PROCESSING,PARTIAL,REJECTED,CORRECTING', label: 'Perlu diproses' },
  { value: 'CONFIRMED', label: 'Selesai' },
] as const

export type GpListStatusPreset = (typeof GP_LIST_STATUS_PRESETS)[number]['value']
