# Fiscal Periods Module - Frontend

## 📁 Structure

```
fiscal-periods/
├── api/
│   └── fiscalPeriods.api.ts       # API client
├── components/
│   ├── ClosePeriodModal.tsx       # Critical: Close period confirmation
│   ├── FiscalPeriodFilters.tsx    # Filter UI
│   ├── FiscalPeriodForm.tsx       # Create form
│   ├── FiscalPeriodTable.tsx      # Data table
│   └── StatusBadge.tsx            # Status indicator
├── constants/
│   └── fiscal-period.constants.ts # Constants & enums
├── pages/
│   ├── FiscalPeriodFormPage.tsx   # Create page
│   ├── FiscalPeriodsDeletedPage.tsx # Deleted periods
│   ├── FiscalPeriodsListPage.tsx  # Main list
│   └── FiscalPeriodsPage.tsx      # Router
├── store/
│   └── fiscalPeriods.store.ts     # Zustand store
├── types/
│   └── fiscal-period.types.ts     # TypeScript types
├── utils/
│   └── validation.ts              # Validation helpers
├── index.ts                        # Module exports
└── README.md                       # This file
```

## 🚀 Usage

### 1. Add to Router

```tsx
// In your main router
import { FiscalPeriodsPage } from '@/features/accounting/fiscal-periods'

<Route path="/accounting/fiscal-periods/*" element={<FiscalPeriodsPage />} />
```

### 2. Use Store

```tsx
import { useFiscalPeriodsStore } from '@/features/accounting/fiscal-periods'

function MyComponent() {
  const { periods, fetchPeriods } = useFiscalPeriodsStore()
  
  useEffect(() => {
    fetchPeriods()
  }, [])
}
```

## ⚠️ Critical Features

### Close Period Modal
- **Irreversible action** - requires explicit confirmation
- Shows warning about consequences
- Optional close reason (max 500 chars)
- Red button to emphasize danger

### Status Badge
- 🟢 Green for Open periods
- 🔴 Red for Closed periods

### Permissions
- Edit/Close: Only for open periods
- Delete: Only for open periods with no journals
- Restore: Only for deleted periods

### Global Warning
- Shows when no open period exists
- Warns that journal posting is disabled

## 🔧 Configuration

### API Base URL
Update in `api/fiscalPeriods.api.ts`:
```ts
const BASE_URL = '/accounting/fiscal-periods'
```

### Pagination
Default page size: 10 (configurable in constants)

### Export
Uses token-based export for security

## ✅ Checklist

- [x] Types & interfaces
- [x] Constants & validation
- [x] API client with all endpoints
- [x] Zustand store with state management
- [x] Status badge component
- [x] Filters component
- [x] Form component with validation
- [x] Table component with actions
- [x] Close period modal (critical)
- [x] List page with pagination
- [x] Create page
- [x] Deleted periods page
- [x] Router setup
- [x] Module exports

## 🎯 Next Steps

1. Add to main router
2. Configure permissions
3. Test close period flow
4. Test with backend API
5. Add loading states
6. Add toast notifications
7. Add audit trail view (optional)

## 📝 Notes

- All dates use ISO format (YYYY-MM-DD)
- Period format: YYYY-MM (e.g., 2024-01)
- Backend validates business rules (overlaps, year-end)
- Frontend validates format only
- Closed periods are immutable
