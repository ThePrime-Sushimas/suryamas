-- Fix stale redirect URL templates and rendered redirectUrl in existing rows.

UPDATE notification_rules
SET redirect_url_template = '/inventory/pr-approval',
    updated_at = now()
WHERE redirect_url_template IN (
  '/inventory/pr-approval/{{id}}/approve',
  '/inventory/purchase-requests/{{id}}/approve'
);

UPDATE notification_rules
SET redirect_url_template = '/pricelists',
    updated_at = now()
WHERE redirect_url_template = '/inventory/pricelists';

UPDATE notifications
SET data = jsonb_set(data, '{redirectUrl}', to_jsonb('/inventory/pr-approval'::text)),
    updated_at = now()
WHERE data->>'redirectUrl' ~ '^/inventory/(pr-approval|purchase-requests)/.*/approve$';

UPDATE notifications
SET data = jsonb_set(data, '{redirectUrl}', to_jsonb('/pricelists'::text)),
    updated_at = now()
WHERE data->>'redirectUrl' = '/inventory/pricelists';
