-- Fix stale redirect URL templates and rendered redirectUrl in existing rows.

UPDATE notification_rules
SET redirect_url_template = '/inventory/purchase-requests/{{id}}/approve',
    updated_at = now()
WHERE redirect_url_template = '/inventory/pr-approval/{{id}}/approve';

UPDATE notification_rules
SET redirect_url_template = '/pricelists',
    updated_at = now()
WHERE redirect_url_template = '/inventory/pricelists';

UPDATE notifications
SET data = jsonb_set(
      data,
      '{redirectUrl}',
      to_jsonb(
        regexp_replace(
          data->>'redirectUrl',
          '^/inventory/pr-approval/',
          '/inventory/purchase-requests/'
        )
      )
    ),
    updated_at = now()
WHERE data->>'redirectUrl' ~ '^/inventory/pr-approval/';

UPDATE notifications
SET data = jsonb_set(data, '{redirectUrl}', to_jsonb('/pricelists'::text)),
    updated_at = now()
WHERE data->>'redirectUrl' = '/inventory/pricelists';
