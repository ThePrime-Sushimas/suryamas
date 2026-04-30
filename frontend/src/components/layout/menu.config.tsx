import {
  LayoutDashboard,
  Package,
  Factory,
  Warehouse,
  ShoppingCart,
  Building2,
  DollarSign,
  Calculator,
  FileSpreadsheet,
  AlertTriangle,
  ShieldCheck,
  Users,
  Settings,
  UserCog,
  Shield,
  Activity,
  Coins,
  Scale,
  TrendingUp,
  Layers,
  BookOpen,
  CreditCard,
  ArrowLeftRight,
  ClipboardList,
  GitMerge,
  Banknote,
  BarChart3,
  Tag,
  Ruler,
  Receipt,
  ScanLine,
  Database,
  FolderKanban,
  RefreshCcw,
  FileCheck,
  PieChart,
} from "lucide-react";
import type { MenuItem } from "./types";

export const menuItems: MenuItem[] = [
  // ─────────────────────────────────────────────
  // 1. DASHBOARD
  // ─────────────────────────────────────────────
  {
    id: "dashboard",
    name: "Dashboard",
    icon: <LayoutDashboard size={18} />,
    submenu: [
      {
        id: "dashboard-sales",
        name: "Sales",
        href: "/dashboard/sales",
        icon: <TrendingUp size={16} />,
        module: "dashboard_sales",
      },
      {
        id: "dashboard-accounting",
        name: "Accounting",
        href: "/dashboard/accounting",
        icon: <BarChart3 size={16} />,
        module: "dashboard_accounting",
      },
      {
        id: "dashboard-finance",
        name: "Finance",
        href: "/dashboard/finance",
        icon: <PieChart size={16} />,
        module: "dashboard_finance",
      },
      {
        id: "dashboard-hrd",
        name: "HRD",
        href: "/dashboard/hrd",
        icon: <Users size={16} />,
        module: "dashboard_hrd",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 2. MASTER DATA — setup awal, jarang diubah
  // ─────────────────────────────────────────────
  {
    id: "master-data",
    name: "Master Data",
    icon: <Database size={18} />,
    submenu: [
      {
        id: "companies",
        name: "Companies",
        href: "/companies",
        icon: <Factory size={16} />,
        module: "companies",
      },
      {
        id: "branches",
        name: "Branches",
        href: "/branches",
        icon: <Warehouse size={16} />,
        module: "branches",
      },
      {
        id: "categories",
        name: "Categories",
        href: "/categories",
        icon: <FolderKanban size={16} />,
        module: "categories",
      },
      {
        id: "sub-categories",
        name: "Sub Categories",
        href: "/sub-categories",
        icon: <Tag size={16} />,
        module: "sub_categories",
      },
      {
        id: "metric-units",
        name: "Metric Units",
        href: "/metric-units",
        icon: <Ruler size={16} />,
        module: "metric_units",
      },
      {
        id: "payment-terms",
        name: "Payment Terms",
        href: "/payment-terms",
        icon: <ClipboardList size={16} />,
        module: "payment_terms",
      },
      {
        id: "payment-methods",
        name: "Payment Methods",
        href: "/payment-methods",
        icon: <CreditCard size={16} />,
        module: "payment_methods",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 3. PRODUK & SUPPLIER
  // ─────────────────────────────────────────────
  {
    id: "products",
    name: "Products & Suppliers",
    icon: <ShoppingCart size={18} />,
    submenu: [
      {
        id: "products",
        name: "Products",
        href: "/products",
        icon: <Package size={16} />,
        module: "products",
      },
      {
        id: "suppliers",
        name: "Suppliers",
        href: "/suppliers",
        icon: <Building2 size={16} />,
        module: "suppliers",
      },
      {
        id: "supplier-products",
        name: "Supplier Products",
        href: "/supplier-products",
        icon: <Layers size={16} />,
        module: "supplier_products",
      },
      {
        id: "pricelists",
        name: "Pricelists",
        href: "/pricelists",
        icon: <Receipt size={16} />,
        module: "pricelists",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 4. POS MANAGEMENT — input data harian
  //    Flow: Import → Staging → Transactions → Aggregates
  // ─────────────────────────────────────────────
  {
    id: "pos",
    name: "POS Management",
    icon: <ScanLine size={18} />,
    submenu: [
      {
        id: "pos-imports",
        name: "POS Imports",
        href: "/pos-imports",
        icon: <FileSpreadsheet size={16} />,
        module: "pos_imports",
      },
      {
        id: "pos-staging",
        name: "POS Staging",
        href: "/pos-staging",
        icon: <Database size={16} />,
        module: "pos_imports",
      },
      {
        id: "pos-transactions",
        name: "POS Transactions",
        href: "/pos-transactions",
        icon: <ClipboardList size={16} />,
        module: "pos_imports",
      },
      {
        id: "pos-sync-aggregates",
        name: "POS Sync Aggregates",
        href: "/pos-sync-aggregates",
        icon: <RefreshCcw size={16} />,
        module: "pos_imports",
      },
      {
        id: "pos-aggregates",
        name: "POS Aggregates",
        href: "/pos-aggregates",
        icon: <GitMerge size={16} />,
        module: "pos_aggregates",
      },
      {
        id: "failed-transactions",
        name: "Failed Transactions",
        href: "/pos-aggregates/failed-transactions",
        icon: <AlertTriangle size={16} />,
        module: "pos_aggregates",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 5. BANKING & REKONSILIASI — proses matching
  //    Flow: Import Bank → Rekonsiliasi → Settlement → Voucher → Cash
  // ─────────────────────────────────────────────
  {
    id: "banking",
    name: "Banking & Reconciliation",
    icon: <Banknote size={18} />,
    submenu: [
      {
        id: "bank-statement-imports",
        name: "Bank Statement Imports",
        href: "/bank-statement-import",
        icon: <FileSpreadsheet size={16} />,
        module: "bank_statement_imports",
      },
      {
        id: "bank-reconciliation",
        name: "Bank Reconciliation",
        href: "/bank-reconciliation",
        icon: <ArrowLeftRight size={16} />,
        module: "bank_reconciliation",
      },
      {
        id: "settlement-groups",
        name: "Settlement Groups",
        href: "/bank-reconciliation/settlement-groups",
        icon: <FileCheck size={16} />,
        module: "bank_reconciliation",
      },
      {
        id: "cash-flow",
        name: "Cash Flow",
        href: "/cash-flow",
        icon: <Activity size={16} />,
        module: "cash_flow",
      },
      {
        id: "cash-counts",
        name: "Cash Count",
        href: "/cash-counts",
        icon: <Coins size={16} />,
        module: "cash_counts",
      },
      {
        id: "fee_discrepancy-review",
        name: "Fee Discrepancy Review",
        href: "bank-reconciliation/fee-discrepancy-review",
        icon: <ShieldCheck size={16} />,
        module: "fee_discrepancy_review",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 6. ACCOUNTING & LAPORAN — output/hasil akhir
  //    Flow: Setup CoA → Jurnal → Laporan
  // ─────────────────────────────────────────────
  {
    id: "accounting",
    name: "Accounting",
    icon: <BookOpen size={18} />,
    submenu: [
      // Chart of Accounts & Setup
      {
        id: "accounting-core",
        name: "Chart of Accounts",
        icon: <Calculator size={16} />,
        submenu: [
          {
            id: "chart-of-accounts",
            name: "Chart of Accounts",
            href: "/chart-of-accounts",
            icon: <Calculator size={16} />,
            module: "chart_of_accounts",
          },
          {
            id: "accounting-purposes",
            name: "Accounting Purposes",
            href: "/accounting-purposes",
            icon: <ClipboardList size={16} />,
            module: "accounting_purposes",
          },
          {
            id: "accounting-purpose-accounts",
            name: "Purpose Accounts",
            href: "/accounting-purpose-accounts",
            icon: <Layers size={16} />,
            module: "accounting_purpose_accounts",
          },
        ],
      },
      // Period & Jurnal
      {
        id: "accounting-periods",
        name: "Period & Journals",
        icon: <BookOpen size={16} />,
        submenu: [
          {
            id: "fiscal-periods",
            name: "Fiscal Periods",
            href: "/accounting/fiscal-periods",
            icon: <DollarSign size={16} />,
            module: "fiscal_periods",
          },
          {
            id: "journal-entries",
            name: "Journal Entries",
            href: "/accounting/journals",
            icon: <FileSpreadsheet size={16} />,
            module: "journals",
          },
        ],
      },
      // Laporan Keuangan
      {
        id: "accounting-reports",
        name: "Financial Reports",
        icon: <BarChart3 size={16} />,
        submenu: [
          {
            id: "trial-balance",
            name: "Neraca Saldo",
            href: "/accounting/trial-balance",
            icon: <Scale size={16} />,
            module: "trial_balance",
          },
          {
            id: "income-statement",
            name: "Laba Rugi",
            href: "/accounting/income-statement",
            icon: <TrendingUp size={16} />,
            module: "income_statement",
          },
          {
            id: "balance-sheet",
            name: "Neraca",
            href: "/accounting/balance-sheet",
            icon: <Scale size={16} />,
            module: "balance_sheet",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 7. HUMAN RESOURCES
  // ─────────────────────────────────────────────
  {
    id: "hr",
    name: "Human Resources",
    icon: <Users size={18} />,
    submenu: [
      {
        id: "employees",
        name: "Employees",
        href: "/employees",
        icon: <Users size={16} />,
        module: "employees",
      },
      {
        id: "employee_branches",
        name: "Employee Branches",
        href: "/employee-branches",
        icon: <Building2 size={16} />,
        module: "employee_branches",
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 8. SETTINGS & SYSTEM
  // ─────────────────────────────────────────────
  {
    id: "settings",
    name: "Settings",
    icon: <Settings size={18} />,
    submenu: [
      {
        id: "users",
        name: "Users",
        href: "/users",
        icon: <UserCog size={16} />,
        module: "users",
      },
      {
        id: "permissions",
        name: "Permissions",
        href: "/permissions",
        icon: <Shield size={16} />,
        module: "permissions",
      },
      {
        id: "monitoring",
        name: "System Monitoring",
        href: "/monitoring",
        icon: <Activity size={16} />,
        module: "monitoring",
      },
    ],
  },
];