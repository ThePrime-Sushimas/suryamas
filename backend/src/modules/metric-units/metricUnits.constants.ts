export const METRIC_UNIT_CONFIG = {
  TABLE_NAME: 'metric_units',
  VALID_TYPES: ['Unit', 'Volume', 'Weight'] as const,
  VALIDATION: {
    UNIT_NAME_MAX_LENGTH: 100,
    NOTES_MAX_LENGTH: 500
  },
  SORTABLE_FIELDS: ['metric_type', 'unit_name', 'is_active', 'id', 'created_at', 'updated_at'] as const
} as const

export type MetricType = typeof METRIC_UNIT_CONFIG.VALID_TYPES[number]
