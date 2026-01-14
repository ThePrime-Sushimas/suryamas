export interface FiscalPeriodsConfig {
  cache: {
    ttl: number
    maxSize: number
    cleanupInterval: number
  }
  limits: {
    pageSize: number
    bulkDelete: number
    export: number
  }
}

export const defaultConfig: FiscalPeriodsConfig = {
  cache: {
    ttl: 300000, // 5 minutes
    maxSize: 1000,
    cleanupInterval: 600000 // 10 minutes
  },
  limits: {
    pageSize: 100,
    bulkDelete: 50,
    export: 10000
  }
}
