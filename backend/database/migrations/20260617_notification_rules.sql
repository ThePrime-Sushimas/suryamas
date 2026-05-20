-- ============================================================================
-- NOTIFICATION ROUTING RULES — map business events → target position(s)
-- ============================================================================

-- Upgrade inbox table if an older notifications migration ran without company_id
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_key VARCHAR(100);

CREATE TABLE IF NOT EXISTS notification_rules (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id              UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_key               VARCHAR(100) NOT NULL,
  position_id             UUID REFERENCES positions(id) ON DELETE SET NULL,
  title_template          VARCHAR(255) NOT NULL,
  message_template        TEXT NOT NULL,
  type                    notification_type NOT NULL DEFAULT 'approval_required',
  category                notification_category NOT NULL DEFAULT 'system',
  redirect_url_template   VARCHAR(500),
  is_active               BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by              UUID REFERENCES auth_users(id),
  updated_by              UUID REFERENCES auth_users(id),
  CONSTRAINT notification_rules_active_requires_position
    CHECK (NOT is_active OR position_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_rules_company_event
  ON notification_rules(company_id, event_key);

CREATE INDEX IF NOT EXISTS idx_notification_rules_company_active
  ON notification_rules(company_id) WHERE is_active = true;
