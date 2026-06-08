---
type: domain
name: Production
last_updated: 2026-06-08
---

# Production Domain

> Production Request → WIP → Goods Processing → Output → COGS

## Modules

```dataview
TABLE slug, status, api_base, last_updated
FROM "30-MODULES"
WHERE domain = link([[20-DOMAINS/Production/_Index]])
SORT slug ASC
```

## Flow Diagram

```mermaid
flowchart LR
  PR[Production Requests] --> WIP[WIP Items]
  WIP --> GP[Goods Processing]
  GP --> OUT[Output to Stock]
  GP --> COST[COGS Calculation]
  MAT[Materials] --> GP
```

## Related Domains

- [[20-DOMAINS/Inventory/_Index|Inventory]] — Output updates stock
- [[20-DOMAINS/Accounting/_Index|Accounting]] — COGS posts journals