---
trigger: always_on
description: Suryamas ERP project status, priorities, and key reference files
globs:
---

# Project Context — Suryamas ERP

## Before starting work

Read when relevant:
- `.amazonq/rules/memory-bank/INFRASTRUCTURE.md` — server, DB tunnel, deploy, storage
- `.amazonq/rules/memory-bank/DEV_STATUS.md` — progress, backlog, conventions
- `.amazonq/rules/memory-bank/CODING_PATTERNS.md` — backend + **frontend list URL filters**
- `.amazonq/rules/memory-bank/MODULE_CHECKLIST.md` — new module checklist

## Current priority

**Purchase Invoice module** — next feature. See `.amazonq/docs/GOODS_PROCESSING_PURCHASE_INVOICE_HANDOFF.md`.

## Stack

- Backend: Node 22, Express, PostgreSQL 17 (Hetzner)
- Frontend: React, Vite, TanStack Query, Zustand, Shadcn/Tailwind
- Storage: Cloudflare R2 (`forcePathStyle: true`)
- Deploy: GitHub Actions → VPS (`/var/www/suryamas`), PM2 `suryamas-backend`

## Key files

| File | Purpose |
|------|---------|
| `backend/src/types/express.d.ts` | Request augmentation |
| `backend/src/utils/error-handler.util.ts` | `handleError` |
| `backend/src/config/error-registry.ts` | Error → HTTP status |
| `frontend/src/lib/errorParser.ts` | `parseApiError` |
| `frontend/src/hooks/_shared/useUserBranches.ts` | Branch access filter |
| `backend/src/modules/branches/branches.controller.ts` | Reference controller |
| `frontend/src/lib/urlFilters/` | Shared `useUrlFilters`, `useListNavigation`, parse/serialize helpers |
| `frontend/src/features/purchase-orders/` | Reference list page with URL-synced filters |
| `frontend/src/features/products/pages/ProductsPage.tsx` | Legacy pagination (migrate when touched) |

## Local dev

- DB access: SSH tunnel only (`tunnel` → `localhost:5433`) — never expose 5432
- Rebuild backend after TS changes: `cd backend && npx tsc`
- Credentials: use `.env` / GitHub secrets — never commit passwords or API tokens

## Completed highlights

Fiscal closing/reopen, branch closure write-guard, financial reports (TB, P&L, balance sheet), error monitoring + Telegram, 46 backend modules compliant with standards.
