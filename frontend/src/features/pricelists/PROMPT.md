# Pricelists Module - Production Documentation

## 🎯 Overview

The Pricelists module is a **production-grade ERP component** that manages pricing information for supplier-product combinations. It follows **domain-driven design principles** where pricelists are contextual to supplier-product relationships.

## 🏗️ Architecture

### Domain Hierarchy
```
Supplier Products (Master) → Pricelists (Transactional)
```

**Key Principle**: Pricelists cannot exist without a supplier-product context. This prevents invalid combinations and ensures data integrity.

### Module Structure
```
frontend/src/features/pricelists/
├── api/                    # API integration layer
│   └── pricelists.api.ts   # Type-safe REST client
├── components/             # Reusable UI components
│   ├── PricelistTable.tsx  # Data table with actions
│   └── PricelistFormContextual.tsx # Context-aware form
├── constants/              # Business rules & UI options
│   └── pricelist.constants.ts
├── hooks/                  # Custom React hooks
│   └── useUomSearch.ts     # UOM search with debounce
├── pages/                  # Route components
│   ├── SupplierProductPricelistsPage.tsx # List page
│   ├── CreatePricelistFromSupplierProductPage.tsx # Create page
│   ├── EditPricelistPage.tsx # Edit page
│   └── PricelistDetailPage.tsx # Detail page
├── store/                  # State management
│   └── pricelists.store.ts # Zustand store
├── types/                  # TypeScript definitions
│   └── pricelist.types.ts  # Complete type system
├── utils/                  # Utility functions
│   ├── errorParser.ts      # Error handling
│   ├── format.ts           # Data formatting
│   └── validation.ts       # Client-side validation
├── index.ts               # Export barrel
└── PROMPT.md              # This documentation
```

## 🔄 Business Logic

### Status Lifecycle
```
DRAFT → APPROVED/REJECTED → EXPIRED
```

**Rules**:
- Only `DRAFT` pricelists can be edited
- Only `DRAFT` pricelists can be approved/rejected
- `APPROVED` pricelists auto-expire when `valid_to` < today
- `REJECTED` and `EXPIRED` are terminal states

### Anti-Duplication Rule
**Constraint**: Only 1 active pricelist per `company_id + supplier_id + product_id + uom_id` where `status IN ('DRAFT', 'APPROVED')` and `deleted_at IS NULL`.

### PO Integration
Pricelists serve as pricing reference for Purchase Orders:
1. Lookup active `APPROVED` pricelist by supplier+product+uom+date
2. Snapshot the price to PO (don't reference directly)
3. This ensures price history integrity

## 🎨 User Experience

### Navigation Flow
```
Supplier Products List
  ↓ Click "Manage Prices"
Pricelists Page (filtered by context)
  ↓ Click "Add New Price"
Create Form (supplier+product fixed, select UOM)
  ↓ Submit
Back to Pricelists List
```

### Key UX Decisions
- **Context Display**: Blue box shows fixed supplier+product
- **Simplified Form**: Only UOM selection needed (not supplier+product)
- **Validation**: Real-time client-side + server-side
- **Loading States**: Explicit loading indicators
- **Error Handling**: User-friendly error messages

## 🔧 Technical Implementation

### State Management Strategy
- **Single Source of Truth**: Zustand store
- **Shallow Selectors**: Prevent infinite loops
- **Query Guards**: Prevent unnecessary API calls
- **Optimistic Updates**: For delete operations
- **Error Boundaries**: Graceful error handling

### Performance Optimizations
- **Memoized Components**: `memo()` for expensive renders
- **Debounced Search**: 300ms delay for UOM search
- **AbortController**: Cancel in-flight requests
- **Pagination**: Server-side pagination
- **CSV Export**: Streaming for large datasets

### Type Safety
- **Strict Types**: No `any` usage
- **Discriminated Unions**: For status types
- **API Contracts**: Frontend types match backend
- **Form Validation**: Type-safe validation rules

## 🛡️ Security & Validation

### Client-Side Validation
- **Price Range**: 0 to 999,999,999,999.99
- **Date Validation**: Valid from/to date logic
- **Required Fields**: Supplier, Product, UOM, Price
- **Business Rules**: Status transition validation

### Server-Side Integration
- **Error Parsing**: Backend errors → user messages
- **Field Errors**: Specific field validation
- **Network Errors**: Graceful degradation
- **Retry Logic**: For transient failures

## 📊 Data Flow

### Create Flow
```
User Input → Client Validation → API Call → Store Update → UI Update → Navigation
```

### List Flow
```
Page Load → Fetch Context → Fetch Pricelists → Render Table → User Actions
```

### Edit Flow
```
Load Existing → Populate Form → User Changes → Validation → Update API → Refresh
```

## 🧪 Testing Strategy

### Unit Tests
- Validation functions
- Format utilities
- Error parsers
- Business logic helpers

### Integration Tests
- API client methods
- Store actions
- Form submissions
- Navigation flows

### E2E Tests
- Complete user journeys
- Error scenarios
- Edge cases
- Performance benchmarks

## 🚀 Deployment Checklist

### Pre-Production
- [ ] All TypeScript errors resolved
- [ ] ESLint warnings addressed
- [ ] Accessibility compliance (WCAG 2.1)
- [ ] Performance benchmarks met
- [ ] Error handling tested
- [ ] Mobile responsiveness verified

### Production Monitoring
- [ ] API error rates
- [ ] Page load times
- [ ] User interaction metrics
- [ ] Conversion rates (create/edit success)

## 🔮 Future Enhancements

### Phase 2 Features
- **Bulk Import**: CSV upload for mass price updates
- **Price History**: Track price changes over time
- **Approval Workflow**: Multi-level approval process
- **Price Alerts**: Notify on significant price changes
- **Analytics Dashboard**: Pricing trends and insights

### Technical Debt
- **Component Library**: Extract reusable components
- **Caching Strategy**: Implement smart caching
- **Offline Support**: PWA capabilities
- **Real-time Updates**: WebSocket integration

## 📚 API Documentation

### Endpoints
- `GET /api/v1/pricelists` - List with filters
- `POST /api/v1/pricelists` - Create new
- `GET /api/v1/pricelists/:id` - Get by ID
- `PATCH /api/v1/pricelists/:id` - Update (DRAFT only)
- `DELETE /api/v1/pricelists/:id` - Soft delete
- `POST /api/v1/pricelists/:id/approve` - Approve/Reject
- `GET /api/v1/pricelists/lookup` - PO integration
- `GET /api/v1/pricelists/export` - CSV export

### Query Parameters
- `page`, `limit` - Pagination
- `supplier_id`, `product_id`, `uom_id` - Filters
- `status`, `is_active` - Status filters
- `valid_on` - Date-based filtering
- `sort_by`, `sort_order` - Sorting

## 🎓 Learning Resources

### Domain Knowledge
- ERP pricing concepts
- Supplier relationship management
- Purchase order workflows
- Financial data integrity

### Technical Skills
- React + TypeScript patterns
- Zustand state management
- Form validation strategies
- API integration best practices

---

**Maintainer**: Frontend Team  
**Last Updated**: 2024  
**Version**: 1.0.0  
**Status**: Production Ready ✅