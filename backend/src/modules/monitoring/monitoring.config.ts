/**
 * Monitoring & Audit Log Retention Policy Configuration
 * Konfigurasi untuk retention policy audit logs dan error logs
 */

export const monitoringRetentionPolicy = {
  auditLogs: {
    hot: '30 days',       // Di database utama
    warm: '90 days',      // Di database terpisah / compressed
    cold: '7 years',      // Di S3 / Glacier
    
    cleanup: {
      schedule: '0 2 * * *',          // Setiap hari jam 2 pagi
      batchSize: 10000,
      archiveBeforeDelete: true,
      archivePath: process.env.AUDIT_ARCHIVE_PATH || '/backup/audit-logs'
    }
  },
  
  errorLogs: {
    hot: '7 days',         // Error logs lebih pendek retention-nya
    warm: '30 days',
    cold: '1 year',
    
    cleanup: {
      schedule: '0 3 * * *',           // Setiap hari jam 3 pagi
      batchSize: 5000,
      archiveBeforeDelete: false       // Error logs bisa langsung delete
    }
  }
}

/**
 * Default retention periods in days
 */
export const retentionDays = {
  auditLogs: {
    softDelete: 30,       // Hari sebelum hard delete setelah soft delete
    hot: 30,             // Di database utama
    warm: 90,            // Di database terpisah
    cold: 2555           // 7 years di cold storage
  },
  errorLogs: {
    softDelete: 7,
    hot: 7,
    warm: 30,
    cold: 365
  }
}

/**
 * Cleanup configuration defaults
 */
export const cleanupConfig = {
  defaultBatchSize: 10000,
  maxBatchSize: 50000,
  minBatchSize: 100,
  batchDelayMs: 100,
  enablePreview: true,
  enableArchive: true,
  enableSoftDelete: true
}

// Re-export dengan nama lama untuk backward compatibility
export const auditRetentionPolicy = monitoringRetentionPolicy
