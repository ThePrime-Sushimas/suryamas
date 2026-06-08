---
type: domain
name: Auth
last_updated: 2026-06-08
---

# Auth Domain

> Authentication → Authorization → Users → Permissions → Notifications

## Modules

```dataview
TABLE slug, status, api_base, last_updated
FROM "30-MODULES"
WHERE domain = link([[20-DOMAINS/Auth/_Index]])
SORT slug ASC
```

## Flow Diagram

```mermaid
flowchart LR
  AUTH[Auth] --> USR[Users]
  AUTH --> PERM[Permissions]
  USR --> NOTIF[Notifications]
  PERM --> MON[Monitoring]
  COMP[Companies] --> AUTH
```

## Related Domains
- All domains — every module uses `authenticate` + `canView`/`canInsert` middleware