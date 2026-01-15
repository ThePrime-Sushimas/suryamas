# Product Overview - Suryamas ERP System

## Project Purpose
Suryamas is a comprehensive Enterprise Resource Planning (ERP) system designed for multi-branch business operations. It provides end-to-end management of accounting, inventory, suppliers, employees, and financial operations with robust permission controls and branch-level context management.

## Value Proposition
- **Multi-Branch Operations**: Seamlessly manage multiple business locations with branch-specific data isolation and permissions
- **Financial Compliance**: Production-ready accounting module with journal entries, chart of accounts, fiscal periods, and general ledger
- **Role-Based Access Control**: Granular permission system with module-level and action-level controls
- **Supplier & Inventory Management**: Complete product catalog, supplier relationships, pricing, and UOM management
- **Audit Trail**: Comprehensive tracking of all financial transactions and state changes
- **Real-time Context Switching**: Dynamic branch context with automatic permission recalculation

## Key Features

### Accounting & Finance
- **Chart of Accounts**: Hierarchical account structure with 5-level depth, account types (Asset, Liability, Equity, Revenue, Expense)
- **Journal Entries**: Complete double-entry bookkeeping with status workflow (Draft → Submitted → Approved → Posted)
- **Fiscal Periods**: Period management with opening/closing controls to prevent posting to closed periods
- **General Ledger**: Automated posting from journals with balance tracking
- **Accounting Purposes**: Predefined account mappings for automated journal generation (COGS, Sales, Inventory, etc.)
- **Multi-Currency Support**: Exchange rate handling with base currency conversion

### Inventory & Products
- **Product Management**: Complete product catalog with categories, sub-categories, and hierarchical organization
- **Metric Units (UOM)**: Base units and conversion factors for flexible measurement
- **Product UOMs**: Product-specific unit conversions with pricing per unit
- **Supplier Products**: Supplier-specific product codes, pricing, and lead times
- **Pricelists**: Flexible pricing with effective dates, branch-specific pricing, and supplier integration

### Supplier Management
- **Supplier Registry**: Complete supplier information with contact details, addresses, and bank accounts
- **Supplier Types**: Categorization (Manufacturer, Distributor, Wholesaler, Retailer, Service Provider)
- **Payment Terms**: Configurable payment terms with due date calculations
- **Bank Accounts**: Multiple bank accounts per supplier with primary account designation

### Organization & Access Control
- **Companies**: Multi-company support with company-level data isolation
- **Branches**: Branch hierarchy with location tracking (latitude/longitude for mapping)
- **Employees**: Employee management with role assignments and branch access
- **Employee Branches**: Many-to-many relationship allowing employees to access multiple branches
- **Roles & Permissions**: Granular permission matrix (module × action) with role-based assignments
- **Branch Context**: Dynamic context switching with automatic permission recalculation

### User Management
- **Authentication**: Supabase-based authentication with JWT tokens
- **User Profiles**: User accounts linked to employees with role assignments
- **Permission Caching**: Optimized permission checks with in-memory caching
- **Session Management**: Secure session handling with automatic token refresh

## Target Users

### Primary Users
1. **Finance Managers**: Manage chart of accounts, journal entries, fiscal periods, and financial reporting
2. **Accountants**: Create and post journal entries, reconcile accounts, manage ledger entries
3. **Inventory Managers**: Manage products, categories, UOMs, and stock levels
4. **Purchasing Managers**: Manage suppliers, supplier products, pricelists, and payment terms
5. **Branch Managers**: Oversee branch-specific operations with appropriate permissions
6. **System Administrators**: Configure companies, branches, roles, permissions, and user access

### Secondary Users
1. **Auditors**: Review audit trails, journal entries, and financial transactions
2. **Executives**: View reports and dashboards (future feature)
3. **Sales Staff**: Access product information and pricing (future feature)

## Use Cases

### Accounting Operations
1. **Manual Journal Entry**: Create, submit, approve, and post manual journal entries
2. **Period Closing**: Close fiscal periods to prevent further postings
3. **Account Setup**: Configure chart of accounts with proper hierarchy and account types
4. **Journal Reversal**: Reverse posted journals with automatic reversal entry creation
5. **Multi-Currency Transactions**: Record transactions in foreign currencies with exchange rates

### Inventory Operations
1. **Product Catalog Management**: Create and organize products with categories and sub-categories
2. **UOM Configuration**: Set up base units and conversion factors
3. **Supplier Product Mapping**: Link products to suppliers with supplier-specific codes and pricing
4. **Pricelist Management**: Create and maintain pricelists with effective dates and branch-specific pricing

### Supplier Management
1. **Supplier Onboarding**: Register new suppliers with complete information
2. **Payment Terms Setup**: Configure payment terms with due date calculations
3. **Bank Account Management**: Maintain supplier bank accounts for payment processing
4. **Supplier Product Pricing**: Track supplier-specific pricing and lead times

### Access Control
1. **Branch Context Switching**: Switch between branches with automatic permission updates
2. **Role Assignment**: Assign roles to users with module-level permissions
3. **Permission Verification**: Real-time permission checks for all operations
4. **Multi-Branch Access**: Grant employees access to multiple branches

### Data Management
1. **Bulk Import**: Import products, suppliers, and other master data via Excel
2. **Bulk Export**: Export data to Excel for reporting and analysis
3. **Audit Trail Review**: Track all changes to financial data with complete audit logs
4. **Data Validation**: Comprehensive validation at API and database levels

## Technical Highlights
- **Monorepo Structure**: Separate backend (Express.js) and frontend (React + Vite) with shared types
- **Type Safety**: Full TypeScript implementation with strict type checking
- **Database**: PostgreSQL via Supabase with ENUM types for data integrity
- **State Management**: Zustand for frontend state with optimistic updates
- **API Documentation**: OpenAPI/Swagger documentation for all endpoints
- **Error Handling**: Centralized error handling with custom error classes
- **Logging**: Winston-based logging with daily rotation
- **Security**: Helmet, CORS, rate limiting, and JWT authentication
- **Validation**: Zod schemas for request/response validation
- **Performance**: Pagination, caching, and optimized queries
