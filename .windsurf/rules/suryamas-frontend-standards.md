---
trigger: model_decision
description: Suryamas ERP frontend — features structure, React Query, Zustand, UI patterns
globs: frontend/**/*.{ts,tsx}
---

# Frontend Standards — Suryamas ERP

## Feature structure (`src/features/*`)

Each feature: `api/`, `components/`, `store/`, `pages/`, `types/`, `index.ts` (public exports).

## Data fetching (`api/*.ts`)

- TanStack Query with defined `queryKeys`
- Custom hooks wrapping `useQuery` / `useMutation`
- `toast` on errors; `qc.invalidateQueries` on mutation success

## State (`store/*.ts`)

- Zustand — small focused stores (`useAuthStore`, filter stores)
- `persist` middleware when data survives refresh
- Errors: **`parseApiError()`** from `@/lib/errorParser` — no inline `error instanceof Error`

## UI

- Shadcn UI + Tailwind utilities (no ad-hoc colors/spacing)
- Dark mode: `dark:` classes
- Loading: skeleton (`animate-pulse`), not "Loading..." text
- Confirm: `ConfirmModal` — no `alert()` / `confirm()`
- Toast: `useToast` from `@/contexts/ToastContext`
- Dates: display `dd-MMM-yyyy` via `formatDate`; backend sends ISO / `YYYY-MM-DD`
- Tailwind JIT: **no** dynamic classes (`bg-${color}-500`) — use literal object maps
- User-facing labels: Bahasa Indonesia; technical: English
- Permissions: `usePermissionStore.hasPermission(module, action)`

## List pages — URL-synced filters (WAJIB untuk halaman list baru)

Filter, pagination, search, tab, sort, page size → **URL query params** via `frontend/src/lib/urlFilters/`.

**WAJIB baca:** `.amazonq/rules/memory-bank/CODING_PATTERNS.md` → section *Frontend List Pages — URL-Synced Filters*

**Referensi:** `frontend/src/features/purchase-orders/` (`usePurchaseOrderFilters`, `purchaseOrderFilters.url.ts`, `PurchaseOrdersPage.tsx`)

```typescript
// Per feature: types + utils/*Filters.url.ts + hooks/use*Filters.ts
const { filters, searchInput, setSearchInput, apiQuery, setFilters, setPage, setLimit } = useFooFilters()
const { openDetail } = useListNavigation('/inventory/foo')
const { data } = useFooList(apiQuery)

// JANGAN: useState untuk page/filter/search saja, api.get() di page, navigate('/list') tanpa query di back
```

## Pagination & fetch

- List pages: `setPage` / `setLimit` from `useUrlFilters` (URL-driven)
- Legacy/store pages: combined `fetchPage(page, limit?, ...)` in stores
- Search/filter change → reset page 1 (via `mergeWithPageReset` in URL utils)
- **No** separate `setPage()` + `useEffect([pagination.page])` (double-fetch)
- `total` from API drives `totalPages` — never stale cache

## Branch dropdown

| Page type | Hook / API |
|-----------|------------|
| Transaction forms, operational lists | `useUserBranches()` |
| Admin/settings, reporting | `GET /branches?status=active` or `branchContext` |

Never hardcode branch lists.

## Accounting display

- No hardcoded COA labels — use DB hierarchy
- No `Math.abs` for balances — use debit/credit helpers per account type
- `fmt(0)` in totals: `showZero = true`
- CSV: `escapeCsv()` from `src/utils/csv.utils.ts`
- 500 errors: generic message to user, not stack traces
