import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  BarChart3,
  Beaker,
  Bell,
  BookOpen,
  Building2,
  Calculator,
  CalendarDays,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  Coins,
  CreditCard,
  Database,

  Factory,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  FolderKanban,
  GitMerge,
  Layers,
  LayoutDashboard,
  Package,
  PackageCheck,
  PieChart,
  Printer,
  Receipt,
  RefreshCcw,
  Ruler,
  Scale,
  ScanLine,
  Settings,
  Shield,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Tag,
  TrendingUp,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  Warehouse,
  ArrowUpCircle,
  ArrowDownCircle,
} from "lucide-react";
import type { MenuItem } from "./types";

// color: "green"  → uang masuk  (hijau)
// color: "red"    → uang keluar (merah)
// color tidak ada → netral / setup / analisa

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
  // 2. SETUP
  // ─────────────────────────────────────────────
  {
    id: "setup",
    name: "Setup",
    icon: <Database size={18} />,
    submenu: [

      // ── 2a. Master Data ──────────────────────
      {
        id: "master-data",
        name: "Master Data",
        icon: <Database size={16} />,
        submenu: [
          {
            id: "companies",
            name: "Perusahaan",
            href: "/companies",
            icon: <Factory size={16} />,
            module: "companies",
          },
          {
            id: "branches",
            name: "Cabang",
            href: "/branches",
            icon: <Building2 size={16} />,           // fix: Warehouse → Building2 (cabang = gedung, bukan gudang)
            module: "branches",
          },
          {
            id: "inv-warehouses",
            name: "Gudang",
            href: "/inventory/warehouses",
            icon: <Warehouse size={16} />,
            module: "warehouses",
          },
        ],
      },

      // ── 2b. Pengaturan COA ───────────────────
      {
        id: "accounting-core",
        name: "Pengaturan COA",
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
          {
            id: "fiscal-periods",
            name: "Fiscal Periods",
            href: "/accounting/fiscal-periods",
            icon: <CalendarDays size={16} />,         // fix: DollarSign → CalendarDays (periode = kalender)
            module: "fiscal_periods",
          },
        ],
      },

      // ── 2c. Pengaturan POS ───────────────────
      {
        id: "setup-pos",
        name: "Pengaturan POS",
        icon: <ScanLine size={16} />,                // fix: Store → ScanLine (POS = scan kasir)
        submenu: [
          {
            id: "payment-methods",
            name: "Metode Pembayaran POS",
            href: "/payment-methods",
            icon: <CreditCard size={16} />,
            module: "payment_methods",
          },
          {
            id: "pos-staging",
            name: "POS Staging",
            href: "/pos-staging",
            icon: <Database size={16} />,
            module: "pos_imports",
          },
          {
            id: "owner-credit-cards",
            name: "Pengaturan Kartu Kredit",
            href: "/settings/owner-credit-cards",
            icon: <CreditCard size={16} />,
            module: "owner_credit_cards",
          },
          {
            id: "alert-threshold",
            name: "Alert Payment",
            href: "/settings/alerts",
            icon: <Bell size={16} />,
            module: "payment_method_alerts",
          },
        ],
      },

      // ── 2d. Pengaturan Products ──────────────
      {
        id: "setup-products",
        name: "Pengaturan Products",
        icon: <Package size={16} />,                 // fix: Store → Package (produk = kotak)
        submenu: [
          {
            id: "categories",
            name: "Kategori",
            href: "/categories",
            icon: <FolderKanban size={16} />,
            module: "categories",
          },
          {
            id: "sub-categories",
            name: "Sub Kategori",
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
            id: "products",
            name: "Produk",
            href: "/products",
            icon: <Package size={16} />,
            module: "products",
          },
        ],
      },

      // ── 2e. Pengaturan Suppliers ─────────────
      {
        id: "setup-suppliers",
        name: "Pengaturan Suppliers",
        icon: <Building2 size={16} />,               // fix: Store → Building2 (supplier = perusahaan luar)
        submenu: [
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
            name: "List Harga",
            href: "/pricelists",
            icon: <Receipt size={16} />,
            module: "pricelists",
          },
          {
            id: "payment-terms",
            name: "Pengaturan Tempo",
            href: "/payment-terms",
            icon: <CalendarDays size={16} />,        // fix: ClipboardList → CalendarDays (tempo = jatuh tempo/tanggal)
            module: "payment_terms",
          },
          {
            id: "vendors",
            name: "Vendors",
            href: "/finance/general-invoices/vendors",
            icon: <Store size={16} />,               // fix: Building2 (sama dg supplier) → Store (vendor = toko/warung)
            module: "general_invoices",
          },
        ],
      },

      // ── 2f. Pengaturan Gudang ────────────────
      {
        id: "setup-warehouse",
        name: "Pengaturan Gudang",
        icon: <Warehouse size={16} />,               // fix: Factory → Warehouse
        submenu: [
          {
            id: "inv-stock-config",
            name: "Setting Safety Stock",
            href: "/inventory/stock-config",
            icon: <Settings size={16} />,
            module: "stock",
          },
          {
            id: "inv-opname-config",
            name: "Setting Opname",
            href: "/inventory/daily-stock-opname/config",
            icon: <Settings size={16} />,
            module: "daily_stock_opname",
          },
          {
            id: "inv-dpo-config",
            name: "Setting Forecast",
            href: "/inventory/daily-prep-orders/config",
            icon: <Settings size={16} />,
            module: "daily_prep_orders",
          },
          {
            id: "inv-dpo-holidays",
            name: "Setting Tanggal Merah",
            href: "/inventory/daily-prep-orders/holidays",
            icon: <CalendarDays size={16} />,
            module: "daily_prep_orders",
          },
          {
            id: "inv-reorder-suggestions",
            name: "Reorder Suggestions",
            href: "/inventory/reorder-suggestions",
            icon: <AlertTriangle size={16} />,
            module: "stock",
          },
        ],
      },

      // ── 2g. Pengaturan Menu (F&B) ────────────
      {
        id: "setup-menu",
        name: "Pengaturan Menu",
        icon: <ChefHat size={16} />,
        submenu: [
          {
            id: "fp-menus",
            name: "Master Menu",
            href: "/food-production/menus",
            icon: <UtensilsCrossed size={16} />,
            module: "menus",
          },
          {
            id: "fp-categories",
            name: "Kategori Menu",
            href: "/food-production/categories",
            icon: <FolderKanban size={16} />,
            module: "menu_categories",
          },
          {
            id: "fp-groups",
            name: "Group Menu",
            href: "/food-production/groups",
            icon: <Layers size={16} />,
            module: "menu_groups",
          },
          {
            id: "fp-wip",
            name: "Work In Progress",
            href: "/food-production/wip",
            icon: <Beaker size={16} />,
            module: "wip_items",
          },
        ],
      },

      // ── 2h. HR Management ────────────────────
      {
        id: "hr-management",
        name: "HR Management",
        icon: <Users size={16} />,
        submenu: [
          {
            id: "employees",
            name: "Data Karyawan",
            href: "/employees",
            icon: <Users size={16} />,
            module: "employees",
          },
          {
            id: "employee_branches",
            name: "Penempatan Cabang",
            href: "/employee-branches",
            icon: <Building2 size={16} />,
            module: "employee_branches",
          },
          {
            id: "users",
            name: "Pengaturan Akun",
            href: "/users",
            icon: <UserCog size={16} />,
            module: "users",
          },
          {
            id: "departments",
            name: "Departemen",
            href: "/settings/departments",
            icon: <Layers size={16} />,
            module: "departments",
          },
          {
            id: "positions",
            name: "Posisi",
            href: "/settings/positions",
            icon: <Shield size={16} />,
            module: "positions",
          },
        ],
      },

      // ── 2i. System Settings ──────────────────
      {
        id: "system-settings",
        name: "System Settings",
        icon: <Settings size={16} />,
        submenu: [
          {
            id: "permissions",
            name: "Permissions",
            href: "/permissions",
            icon: <Shield size={16} />,
            module: "permissions",
          },
          {
            id: "notification-routing",
            name: "Atur Notifikasi",
            href: "/settings/notification-routing",
            icon: <Bell size={16} />,
            module: "notifications",
          },
          {
            id: "printers",
            name: "Printers",
            href: "/settings/printers",
            icon: <Printer size={16} />,
            module: "printers",
          },
          {
            id: "monitoring",
            name: "System Monitoring",
            href: "/monitoring",
            icon: <Activity size={16} />,
            module: "monitoring",
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
    ],
  },

  // ─────────────────────────────────────────────
  // 3. POS & BANK RECON  ← UANG MASUK (hijau)
  // ─────────────────────────────────────────────
  {
    id: "finance-banking",
    name: "POS & Bank Recon",
    icon: <ArrowUpCircle size={18} />,               // fix: DollarSign → ArrowUpCircle (uang masuk)
    color: "green",
    submenu: [

      // ── 3a. POS Management ───────────────────
      {
        id: "pos",
        name: "POS Management",
        icon: <ScanLine size={16} />,
        color: "green",
        submenu: [
          {
            id: "pos-imports",
            name: "POS Imports",
            href: "/pos-imports",
            icon: <FileSpreadsheet size={16} />,
            module: "pos_imports",
            color: "green",
          },
          {
            id: "pos-transactions",
            name: "POS Transactions",
            href: "/pos-transactions",
            icon: <ClipboardList size={16} />,
            module: "pos_imports",
            color: "green",
          },
          {
            id: "pos-sync-aggregates",
            name: "POS Sync Aggregates",
            href: "/pos-sync-aggregates",
            icon: <RefreshCcw size={16} />,
            module: "pos_imports",
            color: "green",
          },
          {
            id: "pos-aggregates",
            name: "POS Aggregates",
            href: "/pos-aggregates",
            icon: <GitMerge size={16} />,
            module: "pos_aggregates",
            color: "green",
          },
        ],
      },

      // ── 3b. Bank Reconciliation ──────────────
      {
        id: "finance-bank-reconciliation",
        name: "Bank Reconciliation",
        icon: <ArrowLeftRight size={16} />,
        color: "green",
        submenu: [
          {
            id: "bank-statement-imports",
            name: "Import Mutasi",
            href: "/bank-statement-imports",
            icon: <FileSpreadsheet size={16} />,
            module: "bank_statement_imports",
            color: "green",
          },
          {
            id: "bank-reconciliation",
            name: "Bank Reconciliation",
            href: "/bank-reconciliation",
            icon: <ArrowLeftRight size={16} />,
            module: "bank_reconciliation",
            color: "green",
          },
          {
            id: "cash-counts",
            name: "Cash Count",
            href: "/cash-counts",
            icon: <Coins size={16} />,
            module: "cash_counts",
            color: "green",
          },
          {
            id: "settlement-groups",
            name: "Settlement Groups",
            href: "/bank-reconciliation/settlement-groups",
            icon: <FileCheck size={16} />,
            module: "bank_reconciliation",
            color: "green",
          },
          {
            id: "fee_discrepancy-review",
            name: "Analisa Selisih Biaya",
            href: "/bank-reconciliation/fee-discrepancy-review",
            icon: <Scale size={16} />,               // fix: ShieldCheck → Scale (analisa selisih = neraca/timbangan)
            module: "fee_discrepancy_review",
          },
          {
            id: "expense-categorization",
            name: "Kategori Biaya",
            href: "/expense-categorization",
            icon: <Tag size={16} />,
            module: "cash_flow",
          },
          {
            id: "cash-flow",
            name: "In-Out",
            href: "/cash-flow",
            icon: <Activity size={16} />,
            module: "cash_flow",
          },
        ],
      },
    ],
  },

  // ─────────────────────────────────────────────
  // 4. OPERATIONS
  // ─────────────────────────────────────────────
  {
    id: "operations",
    name: "Operations",
    icon: <Factory size={18} />,
    submenu: [

      // ── 4a. Request (uang keluar - pengajuan) ─
      {
        id: "purchasing-requests",
        name: "Request",
        icon: <ClipboardList size={16} />,           // fix: ShoppingCart → ClipboardList (request = form/daftar)
        color: "red",
        submenu: [
          {
            id: "inv-purchase-requests",
            name: "Request Barang",
            href: "/inventory/purchase-requests",
            icon: <ClipboardList size={16} />,
            module: "purchase_requests",
            color: "red",
          },
          {
            id: "fp-production-requests",
            name: "Request Sauce",
            href: "/food-production/production-requests",
            icon: <ChefHat size={16} />,             // fix: ClipboardList (sama) → ChefHat (sauce = dapur)
            module: "production_requests",
            color: "red",
          },
          {
            id: "general-invoices-templates",
            name: "Request Utility",
            href: "/finance/general-invoices/templates",
            icon: <FileText size={16} />,            // fix: RefreshCcw → FileText (template invoice = dokumen)
            module: "general_invoices",
            color: "red",
          },
        ],
      },

      // ── 4b. Ops Lvl 1 (operasional harian) ───
      {
        id: "ops-lvl1",
        name: "Ops Lvl 1",
        icon: <Warehouse size={16} />,
        submenu: [
          {
            id: "inv-daily-prep-orders",
            name: "Pengambilan Harian",
            href: "/inventory/daily-prep-orders",
            icon: <ClipboardList size={16} />,
            module: "daily_prep_orders",
          },
          {
            id: "inv-goods-receipts",
            name: "Penerimaan Barang",
            href: "/inventory/goods-receipts",
            icon: <PackageCheck size={16} />,
            module: "goods_receipts",
          },
          {
            id: "inv-goods-processing",
            name: "Barang Diproses",
            href: "/inventory/goods-processing",
            icon: <RefreshCcw size={16} />,          // fix: Package (sama dg lainnya) → RefreshCcw (diproses = siklus)
            module: "goods_processing",
          },
          {
            id: "inv-stock-adjustments",
            name: "Waste & Breakdown",
            href: "/inventory/stock-adjustments",
            icon: <AlertTriangle size={16} />,
            module: "stock_adjustments",
          },
          {
            id: "inv-daily-stock-opname",
            name: "Opname Harian",
            href: "/inventory/daily-stock-opname",
            icon: <ClipboardList size={16} />,
            module: "daily_stock_opname",
          },
          {
            id: "fp-production",
            name: "Produksi Harian",
            href: "/food-production/production",
            icon: <ChefHat size={16} />,             // fix: Factory → ChefHat (produksi harian = dapur/masak)
            module: "production_orders",
          },
        ],
      },

      // ── 4c. Ops Lvl 2 (approval & PO) ────────
      {
        id: "ops-lvl2",
        name: "Ops Lvl 2",
        icon: <ShieldCheck size={16} />,             // fix: Warehouse (sama) → ShieldCheck (approval = verifikasi)
        color: "red",
        submenu: [
          {
            id: "inv-pr-approval",
            name: "Request Approval",
            href: "/inventory/pr-approval",
            icon: <ShieldCheck size={16} />,
            modules: ["purchase_requests", "monthly_stock_opname"],
            permissionAction: "approve",
          },
          {
            id: "inv-stock-transfers",
            name: "Stock Transfer",
            href: "/inventory/stock-transfers",
            icon: <ArrowLeftRight size={16} />,
            module: "stock_transfers",
          },
          {
            id: "inv-purchase-orders",
            name: "Purchase Order",
            href: "/inventory/purchase-orders",
            icon: <ShoppingCart size={16} />,
            module: "purchase_orders",
            color: "red",
          },
          {
            id: "inv-marketplace-po",
            name: "Marketplace PO",
            href: "/inventory/marketplace-po",
            icon: <ShoppingBag size={16} />,
            module: "marketplace_po",
            color: "red",
          },
          {
            id: "inv-monthly-stock-opname",
            name: "SO Bulanan",
            href: "/inventory/monthly-stock-opname",
            icon: <ClipboardCheck size={16} />,
            module: "monthly_stock_opname",
          },
        ],
      },

      // ── 4d. Invoices & Payments (uang keluar) ─
      {
        id: "finance-payables",
        name: "Invoices & Payments",
        icon: <ArrowDownCircle size={16} />,         // fix: Wallet → ArrowDownCircle (bayar = uang keluar)
        color: "red",
        submenu: [
          {
            id: "inv-purchase-invoices",
            name: "Invoice Supplier",
            href: "/inventory/purchase-invoices",
            icon: <FileText size={16} />,
            module: "purchase_invoices",
            color: "red",
          },
          {
            id: "ap-payments",
            name: "Pembayaran Supplier",
            href: "/finance/ap-payments/dashboard",
            icon: <Wallet size={16} />,
            module: "ap_payments",
            color: "red",
          },
          {
            id: "general-invoices",
            name: "Invoices Umum",
            href: "/finance/general-invoices",
            icon: <Receipt size={16} />,
            module: "general_invoices",
            color: "red",
          },
          {
            id: "general-invoice-payments",
            name: "Pembayaran Inv Umum",
            href: "/finance/general-invoices/payments",
            icon: <Banknote size={16} />,
            module: "general_invoices",
            color: "red",
          },
          {
            id: "cc-settlements",
            name: "Pelunasan CC Owner",
            href: "/inventory/marketplace-po/cc-settlements",
            icon: <CreditCard size={16} />,
            module: "cc_owner_settlements",
            permissionAction: "view",
            color: "red",
          },
        ],
      },

      // ── 4e. Analisa Gudang ───────────────────
      {
        id: "analisa-gudang",
        name: "Analisa Gudang",
        icon: <BarChart3 size={16} />,               // fix: Warehouse → BarChart3 (analisa = grafik)
        submenu: [
          {
            id: "inv-stock",
            name: "Stock Gudang",
            href: "/inventory/stock",
            icon: <Package size={16} />,
            module: "stock",
          },
          {
            id: "inv-movements",
            name: "History Product",
            href: "/inventory/movements",
            icon: <ArrowLeftRight size={16} />,
            module: "stock",
          },
          {
            id: "inv-stock-analysis",
            name: "Analisa Stock",
            href: "/inventory/stock-analysis",
            icon: <BarChart3 size={16} />,
            module: "stock_analysis",
          },
        ],
      },

      // ── 4f. Analisa Menu ─────────────────────
      {
        id: "analisa-menu",
        name: "Analisa Menu",
        icon: <ChefHat size={16} />,
        submenu: [
          {
            id: "fp-cogs",
            name: "COGS Calculation",
            href: "/food-production/cogs",
            icon: <Calculator size={16} />,
            module: "cogs",
          },
          {
            id: "fp-cogs-breakdown",
            name: "COGS Breakdown",
            href: "/food-production/cogs/breakdown",
            icon: <BarChart3 size={16} />,
            module: "cogs_breakdown",
          },
          {
            id: "fp-consumption",
            name: "Analisa Konsumsi",
            href: "/food-production/consumption",
            icon: <FlaskConical size={16} />,
            module: "consumption_analysis",
          },
        ],
      },

    ],
  },

  // ─────────────────────────────────────────────
  // 5. ACCOUNTING
  // ─────────────────────────────────────────────
  {
    id: "accounting",
    name: "Accounting",
    icon: <BookOpen size={18} />,
    submenu: [
      {
        id: "accounting-reports",
        name: "Financial Reports",
        icon: <BarChart3 size={16} />,
        submenu: [
          {
            id: "journal-entries",
            name: "Journal Entries",
            href: "/accounting/journals",
            icon: <FileSpreadsheet size={16} />,
            module: "journals",
          },
          {
            id: "trial-balance",
            name: "Neraca Saldo",
            href: "/accounting/trial-balance",
            icon: <Scale size={16} />,
            module: "trial_balance",
          },
          {
            id: "daily-ledger",
            name: "Daily Ledger",
            href: "/accounting/daily-ledger",
            icon: <CalendarDays size={16} />,
            module: "trial_balance",
          },
          {
            id: "general-ledger",
            name: "Buku Besar",
            href: "/accounting/general-ledger",
            icon: <BookOpen size={16} />,
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

];