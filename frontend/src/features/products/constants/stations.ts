export const STATIONS = [
  { value: 'SUSHIBAR', label: 'Sushibar' },
  { value: 'KITCHEN', label: 'Kitchen' },
  { value: 'BARISTA', label: 'Barista' },
  { value: 'SERVER', label: 'Server' },
  { value: 'CENTRAL_SAUCE', label: 'Central Sauce' },
  { value: 'VEGETABLES', label: 'Vegetables' },
  { value: 'EQUIPMENT', label: 'Equipment' },
] as const

export type StationValue = typeof STATIONS[number]['value']
