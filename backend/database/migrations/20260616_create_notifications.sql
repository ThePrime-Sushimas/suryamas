-- ============================================================================
-- SYSTEM NOTIFICATIONS — inbox + enums
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
    CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error', 'approval_required');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_category') THEN
    CREATE TYPE notification_category AS ENUM ('system', 'purchase_request', 'purchase_order', 'purchase_invoice', 'inventory', 'accounting', 'hrd');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  recipient_id  UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  event_key     VARCHAR(100),
  title         VARCHAR(255) NOT NULL,
  message       TEXT NOT NULL,
  type          notification_type NOT NULL DEFAULT 'info',
  category      notification_category NOT NULL DEFAULT 'system',
  is_read       BOOLEAN NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,
  data          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread
  ON notifications(recipient_id) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created
  ON notifications(recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_company_recipient
  ON notifications(company_id, recipient_id, created_at DESC);
