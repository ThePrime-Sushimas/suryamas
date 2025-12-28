export const CompanyConfig = {
  TYPES: ['PT', 'CV', 'Firma', 'Koperasi', 'Yayasan'] as const,
  STATUSES: ['active', 'inactive', 'suspended', 'closed'] as const,
  VALIDATION: {
    CODE_MAX_LENGTH: 20,
    NAME_MAX_LENGTH: 255,
    NPWP_LENGTH: 15,
    PHONE_MIN_LENGTH: 10,
    PHONE_MAX_LENGTH: 20
  },
  EXPORT: {
    MAX_ROWS: parseInt(process.env.COMPANY_EXPORT_MAX_ROWS || '10000')
  },
  PAGINATION: {
    DEFAULT_LIMIT: 25,
    MAX_LIMIT: 1000
  }
}
