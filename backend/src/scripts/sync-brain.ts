/**
 * Sync-Brain: Auto-generate & update Obsidian vault from backend code.
 *
 * Usage: cd backend && npm run docs:sync
 *
 * Vault improvements:
 * - Domain-aware module content (business rules, depends_on, related_tables)
 * - Scans actual module files to detect layer completeness
 * - Generates richer skeletons with meaningful defaults
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

// --- Config ---
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const BACKEND_ROOT = path.join(PROJECT_ROOT, 'backend', 'src');
const VAULT_ROOT = path.resolve(PROJECT_ROOT, 'docs', 'brain');

const MODULES_DIR = path.join(BACKEND_ROOT, 'modules');
const VAULT_MODULES = path.join(VAULT_ROOT, '30-MODULES');
const VAULT_TABLES = path.join(VAULT_ROOT, '40-DATABASE', 'Tables');
const VAULT_INDEX = path.join(VAULT_ROOT, '00-INDEX');
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, 'backend', 'database', 'migrations');

const TODAY = new Date().toISOString().slice(0, 10);

// --- Types ---
interface ModuleInfo {
  slug: string;
  backendPath: string;
  apiBase: string;
  files: string[];
  hasLayers: { routes: boolean; controller: boolean; service: boolean; repository: boolean; schema: boolean; types: boolean; errors: boolean };
  domain: string | null;
  domainTag: string;
}

interface TableInfo {
  name: string;
  migrations: string[];
}

// --- Helpers ---
function slugify(name: string): string {
  return name.replace(/_/g, '-').replace(/\./g, '-').toLowerCase();
}

function kebabToTitle(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// Domain mapping with expanded coverage
const DOMAIN_MAP: Record<string, string> = {
  // Purchasing
  'purchase-orders': 'Purchasing', 'purchase-requests': 'Purchasing', 'purchase-invoices': 'Purchasing',
  'goods-receipts': 'Purchasing', 'ap-payments': 'Purchasing', 'suppliers': 'Purchasing',
  'supplier-products': 'Purchasing', 'goods-processing': 'Purchasing', 'marketplace-po': 'Purchasing',
  // Inventory
  'products': 'Inventory', 'product-uoms': 'Inventory', 'stock': 'Inventory',
  'stock-adjustments': 'Inventory', 'stock-transfers': 'Inventory', 'daily-stock-opname': 'Inventory',
  'warehouses': 'Inventory', 'categories': 'Inventory', 'sub-categories': 'Inventory',
  'metric-units': 'Inventory', 'product-output-template': 'Inventory',
  // Production
  'production-requests': 'Production', 'food-production': 'Production',
  'daily-prep-orders': 'Production',
  // Accounting
  'accounting': 'Accounting', 'chart-of-accounts': 'Accounting', 'journals': 'Accounting',
  'fiscal-periods': 'Accounting', 'trial-balance': 'Accounting', 'balance-sheet': 'Accounting',
  'income-statement': 'Accounting', 'general-ledger': 'Accounting', 'daily-ledger': 'Accounting',
  'cash-flow': 'Accounting', 'expense-categorization': 'Accounting', 'general-invoices': 'Accounting',
  // HR
  'employees': 'HR', 'employee-positions': 'HR', 'employee-branches': 'HR',
  'departments': 'HR', 'positions': 'HR', 'jobs': 'HR', 'dashboard': 'HR',
  // Treasury
  'bank-accounts': 'Treasury', 'banks': 'Treasury', 'cash-counts': 'Treasury',
  'reconciliation': 'Treasury',
  // Sales-POS
  'pos-sync': 'Sales-POS', 'pos-sync-aggregates': 'Sales-POS', 'pos-imports': 'Sales-POS',
  'pricelists': 'Sales-POS', 'branches': 'Sales-POS', 'payment-methods': 'Sales-POS',
  'payment-terms': 'Sales-POS', 'payment-method-alerts': 'Sales-POS', 'printers': 'Sales-POS',
  // Auth
  'auth': 'Auth', 'users': 'Auth', 'permissions': 'Auth', 'notifications': 'Auth',
  'monitoring': 'Auth', 'companies': 'Auth',
};

function inferDomain(slug: string): string {
  return DOMAIN_MAP[slug] || 'Undefined';
}

function inferBusinessRules(slug: string, domain: string): string[] {
  const common = [
    'Multi-tenant: all queries filter by `company_id`',
    'Soft delete: `deleted_at IS NULL` on all read queries',
    'Audit trail: `AuditService.log` on CREATE/UPDATE/DELETE/RESTORE',
  ];

  const domainRules: Record<string, string[]> = {
    Purchasing: [
      'Fiscal period check via `requireWriteAccess` before confirm/post',
      'Duplicate check: `UNIQUE(company_id, code)` constraint',
      'Status state machine: draft → confirmed → closed',
      'Children guard: `hasChildren()` before soft delete',
    ],
    Inventory: [
      'Stock balance updates trigger on confirm/finalize',
      'Quantity precision: DECIMAL with 2 decimal places',
      'Warehouse access: filtered by user branch context',
      'Cost calculation: `average_cost × conversion_factor`',
    ],
    Production: [
      'WIP tracking: status per production request line',
      'Material BOM: sourced from product-output-template',
      'COGS calculation on output confirmation',
    ],
    Accounting: [
      'Double-entry: debit/credit must balance per journal',
      'Fiscal period must be open before posting',
      'COA hierarchy: account parent-child validation',
    ],
    HR: [
      'Employee data: branch-scoped access via `employee_branches`',
      'Position hierarki: `position_id` references parent',
    ],
    Treasury: [
      'Bank account: belongs to company, not branch',
      'Cash count: must be finalized before fiscal period close',
      'Reconciliation: single source of truth pattern',
    ],
    'Sales-POS': [
      'POS sync: aggregated transactions pattern',
      'Pricelist: branch-level price override via `menu_branch_prices`',
    ],
    Auth: [
      'JWT authentication: `authenticate` middleware',
      'Permission check: `canView/canInsert/canUpdate/canDelete`',
    ],
  };

  return [...common, ...(domainRules[domain] || ['Standard CRUD operations'])];
}

function inferDependsOn(slug: string, domain: string): string[] {
  const deps: Record<string, string[]> = {
    'purchase-orders': ['suppliers', 'products', 'branches', 'purchase-requests'],
    'goods-receipts': ['purchase-orders', 'products', 'branches', 'warehouses'],
    'purchase-invoices': ['goods-receipts', 'purchase-orders', 'suppliers', 'products', 'branches'],
    'ap-payments': ['purchase-invoices', 'suppliers', 'bank-accounts', 'branches'],
    'products': ['categories', 'metric-units', 'companies'],
    'stock': ['products', 'warehouses', 'branches'],
    'stock-adjustments': ['stock', 'products', 'warehouses'],
    'stock-transfers': ['stock', 'products', 'warehouses'],
    'daily-stock-opname': ['stock', 'products', 'warehouses', 'branches'],
    'production-requests': ['products', 'branches', 'product-output-template'],
    'goods-processing': ['production-requests', 'products', 'stock', 'product-output-template'],
    'journal': ['chart-of-accounts', 'fiscal-periods'],
    'chart-of-accounts': ['accounting'],
  };
  return deps[slug] || [];
}

function inferUsedBy(slug: string): string[] {
  const usedBy: Record<string, string[]> = {
    'suppliers': ['purchase-orders', 'purchase-invoices', 'ap-payments'],
    'products': ['purchase-orders', 'goods-receipts', 'purchase-invoices', 'stock', 'stock-adjustments', 'production-requests'],
    'purchase-orders': ['goods-receipts', 'purchase-invoices'],
    'goods-receipts': ['purchase-invoices'],
    'purchase-invoices': ['ap-payments'],
    'branches': ['purchase-orders', 'goods-receipts', 'purchase-invoices', 'stock'],
    'warehouses': ['stock', 'stock-adjustments', 'stock-transfers', 'goods-receipts'],
    'categories': ['products', 'sub-categories'],
    'chart-of-accounts': ['journal', 'purchase-invoices', 'ap-payments'],
    'fiscal-periods': ['journal', 'purchase-invoices', 'ap-payments'],
    'bank-accounts': ['ap-payments', 'reconciliation'],
    'employees': ['employee-branches', 'employee-positions'],
  };
  return usedBy[slug] || [];
}

function inferRelatedTables(slug: string): string[] {
  const tables: Record<string, string[]> = {
    'purchase-orders': ['purchase_orders', 'purchase_order_lines', 'purchase_order_attachments'],
    'goods-receipts': ['goods_receipts', 'goods_receipt_lines'],
    'purchase-invoices': ['purchase_invoices', 'purchase_invoice_lines', 'purchase_invoice_charges', 'purchase_invoice_attachments', 'purchase_invoice_gr_links'],
    'ap-payments': ['ap_payments', 'ap_payment_invoice_lines', 'ap_payment_batches'],
    'products': ['products', 'product_uoms', 'product_stock_configs'],
    'categories': ['categories', 'sub_categories'],
    'employees': ['employees', 'employee_branches', 'employee_positions'],
    'branches': ['branches', 'branch_opname_config'],
  };
  return tables[slug] || [slug.replace(/-/g, '_')];
}

function generateModuleOverview(slug: string, info: ModuleInfo): string {
  const title = kebabToTitle(slug);
  const domainTag = info.domainTag;
  const businessRules = inferBusinessRules(slug, domainTag);
  const dependsOn = inferDependsOn(slug, domainTag);
  const usedBy = inferUsedBy(slug);
  const relatedTables = inferRelatedTables(slug);

  const dependsOnYaml = dependsOn.length > 0
    ? dependsOn.map(d => `  - "[[30-MODULES/M-${d}]]"`).join('\n')
    : '  # TODO: infer from import statements';
  const usedByYaml = usedBy.length > 0
    ? usedBy.map(d => `  - "[[30-MODULES/M-${d}]]"`).join('\n')
    : '  # TODO: infer from reverse dependency scan';
  const tablesYaml = relatedTables.map(t => `  - ${t}`).join('\n');

  const layers = [];
  if (info.hasLayers.routes) layers.push('Routes');
  if (info.hasLayers.controller) layers.push('Controller');
  if (info.hasLayers.service) layers.push('Service');
  if (info.hasLayers.repository) layers.push('Repository');
  const layerStr = layers.length > 0 ? layers.join(' → ') : 'Routes → Controller → Service → Repository';

  return `---
type: module
slug: ${slug}
status: active
domain: "[[20-DOMAINS/${domainTag}/_Index|${domainTag}]]"
backend_path: ${info.backendPath}
api_base: ${info.apiBase}
permission_module: ${slug}
depends_on:
${dependsOnYaml}
used_by:
${usedByYaml}
related_tables:
${tablesYaml}
last_updated: ${TODAY}
---

# M-${title}

## Purpose

<!-- TODO: Describe the business purpose -->

## Layer Map

\`\`\`
${layerStr}
${info.hasLayers.schema ? '  Schema' : ''}${info.hasLayers.controller ? '    handleError' : ''}${info.hasLayers.service ? '      Audit' : ''}${info.hasLayers.repository ? '        SQL queries' : ''}
\`\`\`

## Key Business Rules

${businessRules.map(r => `- ${r}`).join('\n')}

## Known Gotchas / Pitfalls

- <!-- TODO: Add domain-specific gotchas -->

## Related
- **API:** [[_API-Reference]]
- **Data:** [[_Data-Model]]
- **Relations:** [[_Relations]]
`;
}

function generateTableSkeleton(tableName: string, migrations: string[]): string {
  return `---
type: table
table: ${tableName}
module: ""
columns_count: 0
soft_delete: true
multi_tenant: true
audit: true
indexes: []
unique_constraints: []
fk_to: []
fk_from: []
migrations:
${migrations.map(m => `  - "${m}"`).join('\n')}
last_updated: ${TODAY}
---

# ${tableName}

## Schema (Mermaid)

\`\`\`mermaid
erDiagram
  ${tableName} {} ||--o{ CHILD_TABLE : ""
\`\`\`

## Key Columns

| Column | Type | Purpose |
|--------|------|---------|
| id | UUID | Primary key |
| company_id | UUID | Multi-tenant partition key |
| created_at | TIMESTAMPTZ | Audit timestamp |
| updated_at | TIMESTAMPTZ | Audit timestamp |
| created_by | UUID | References auth_users |
| updated_by | UUID | References auth_users |
| is_deleted | BOOLEAN | Soft delete flag |
| deleted_at | TIMESTAMPTZ | Soft delete timestamp |
| ... | | <!-- TODO: add columns --> |

## Migration History

${migrations.map(m => `- ${m}`).join('\n')}
`;
}

// --- Extract tables from SQL ---
const TABLE_RE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?(\w+)/gi;

async function extractTablesFromMigrations(): Promise<Map<string, TableInfo>> {
  const tables = new Map<string, TableInfo>();

  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    for (const file of sqlFiles) {
      const content = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf-8');
      const match = content.match(TABLE_RE);
      if (match) {
        for (const m of match) {
          const name = m.replace(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?/i, '').trim();
          if (!tables.has(name)) {
            tables.set(name, { name, migrations: [] });
          }
          const entry = tables.get(name)!;
          if (!entry.migrations.includes(file)) {
            entry.migrations.push(file);
          }
        }
      }
    }
  } catch (err) {
    console.warn('⚠️  Migrations directory not found, skipping table extraction');
  }

  return tables;
}

// --- Scan modules ---
function detectLayers(files: string[]) {
  return {
    routes: files.some(f => f.endsWith('.routes.ts')),
    controller: files.some(f => f.endsWith('.controller.ts')),
    service: files.some(f => f.endsWith('.service.ts')),
    repository: files.some(f => f.endsWith('.repository.ts')),
    schema: files.some(f => f.endsWith('.schema.ts')),
    types: files.some(f => f.endsWith('.types.ts')),
    errors: files.some(f => f.endsWith('.errors.ts')),
  };
}

async function scanModules(): Promise<ModuleInfo[]> {
  const modules: ModuleInfo[] = [];

  try {
    const entries = await fs.readdir(MODULES_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;

      const modulePath = path.join(MODULES_DIR, entry.name);
      let files: string[] = [];

      try {
        files = await fs.readdir(modulePath);
        // Also check subdirectories (e.g. accounting/ has sub-modules)
        const subDirs: string[] = [];
        for (const f of files) {
          const subPath = path.join(modulePath, f);
          const stat = await fs.stat(subPath);
          if (stat.isDirectory()) {
            const subFiles = await fs.readdir(subPath);
            subFiles.forEach(sf => subDirs.push(`${f}/${sf}`));
          }
        }
        files = [...files, ...subDirs];
      } catch {
        // skip
      }

      const slug = slugify(entry.name);
      const routesFile = files.find(f => f.endsWith('.routes.ts'));
      const hasLayers = detectLayers(files);

      // For accounting sub-modules, try to find route by checking subdirs
      let apiBase = `/api/v1/${slug}`;
      if (routesFile) {
        apiBase = `/api/v1/${slug}`;
      } else if (hasLayers.controller) {
        apiBase = `/api/v1/${slug}`;
      } else {
        apiBase = '/api/v1/TODO';
      }

      modules.push({
        slug,
        backendPath: `backend/src/modules/${entry.name}`,
        apiBase,
        files,
        hasLayers,
        domain: inferDomain(slug),
        domainTag: inferDomain(slug),
      });
    }
  } catch (err) {
    console.error('❌ Failed to scan modules:', err);
  }

  return modules;
}

// --- Generate module vault files ---
async function syncModules(modules: ModuleInfo[]): Promise<void> {
  for (const mod of modules) {
    const modDir = path.join(VAULT_MODULES, `M-${mod.slug}`);

    try {
      await fs.mkdir(modDir, { recursive: true });

      const overviewPath = path.join(modDir, '_Overview.md');
      let needsWrite = false;

      try {
        const existing = await fs.readFile(overviewPath, 'utf-8');
        // Update last_updated + regenerate domain content but keep manual sections
        const updated = existing
          .replace(/last_updated: \d{4}-\d{2}-\d{2}/, `last_updated: ${TODAY}`)
          .replace(/domain: "\[\[20-DOMAINS\/.*?_Index\|.*?\]\]"/, `domain: "[[20-DOMAINS/${mod.domainTag}/_Index|${mod.domainTag}]]"`)
          .replace(/api_base: .*/, `api_base: ${mod.apiBase}`);
        if (updated !== existing) {
          await fs.writeFile(overviewPath, updated, 'utf-8');
          needsWrite = true;
        }
      } catch {
        // File doesn't exist → create with rich content
        await fs.writeFile(overviewPath, generateModuleOverview(mod.slug, mod), 'utf-8');
        needsWrite = true;
      }

      if (needsWrite) {
        const label = mod.domainTag === 'Undefined' ? '⚠️' : '✅';
        console.log(`  ${label} ${mod.slug} → ${mod.domainTag}`);
      }
    } catch (err) {
      console.error(`  ❌ ${mod.slug}: ${err}`);
    }
  }
}

// --- Generate table vault files ---
async function syncTables(tables: Map<string, TableInfo>): Promise<void> {
  await fs.mkdir(VAULT_TABLES, { recursive: true });

  for (const [name, info] of tables) {
    const tablePath = path.join(VAULT_TABLES, `T-${name}.md`);

    try {
      const exists = await fs.access(tablePath).then(() => true).catch(() => false);

      if (!exists) {
        await fs.writeFile(tablePath, generateTableSkeleton(name, info.migrations), 'utf-8');
        console.log(`  ✅ T-${name}`);
      } else {
        // Update last_updated + migrations
        const content = await fs.readFile(tablePath, 'utf-8');
        const updated = content
          .replace(/last_updated: \d{4}-\d{2}-\d{2}/, `last_updated: ${TODAY}`)
          .replace(/migrations:\n([\s\S]*?)(?=\n---|\n# )/, () => {
            const migs = info.migrations.map(m => `  - "${m}"`).join('\n');
            return `migrations:\n${migs}`;
          });
        if (updated !== content) {
          await fs.writeFile(tablePath, updated, 'utf-8');
        }
      }
    } catch (err) {
      console.error(`  ❌ T-${name}: ${err}`);
    }
  }
}

// --- Generate Module Catalog ---
async function generateModuleCatalog(modules: ModuleInfo[]): Promise<void> {
  await fs.mkdir(VAULT_INDEX, { recursive: true });
  const catalogPath = path.join(VAULT_INDEX, 'Module-Catalog.md');

  const domainOrder = ['Purchasing', 'Inventory', 'Production', 'Accounting', 'HR', 'Treasury', 'Sales-POS', 'Auth', 'Undefined'];
  const grouped = new Map<string, ModuleInfo[]>();
  for (const m of modules) {
    const d = m.domainTag || 'Undefined';
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(m);
  }

  let catalog = `# Module Catalog

> Auto-generated on ${TODAY}. Total modules: ${modules.length}

---

## Summary

| Domain | Count | Status |
|--------|-------|--------|
${domainOrder.map(d => {
  const ms = grouped.get(d) || [];
  if (ms.length === 0) return '';
  const completed = ms.filter(m => {
    const p = path.join(VAULT_MODULES, `M-${m.slug}`, '_Overview.md');
    try { const c = fsSync.readFileSync(p, 'utf-8'); return !c.includes('TODO'); }
    catch { return false; }
  }).length;
  return `| ${d} | ${ms.length} | ${completed}/${ms.length} enriched |`;
}).filter(Boolean).join('\n')}

---

${domainOrder.map(domain => {
  const domainModules = grouped.get(domain) || [];
  if (domainModules.length === 0) return '';
  return `## 🏷️ ${domain}

| Slug | Module | API | Layers |
|------|--------|-----|--------|
${domainModules.map(m => {
  const layers = [];
  if (m.hasLayers.routes) layers.push('R');
  if (m.hasLayers.controller) layers.push('C');
  if (m.hasLayers.service) layers.push('S');
  if (m.hasLayers.repository) layers.push('Repo');
  if (m.hasLayers.schema) layers.push('Z');
  return `| \`${m.slug}\` | [[30-MODULES/M-${m.slug}/_Overview\\|M-${kebabToTitle(m.slug)}]] | \`${m.apiBase}\` | ${layers.join('·')} |`;
}).join('\n')}
`;
}).filter(Boolean).join('\n')}
`;

  try {
    await fs.writeFile(catalogPath, catalog, 'utf-8');
    console.log(`📋 Module-Catalog.md regenerated (${modules.length} modules)`);
  } catch (err) {
    console.error('❌ Failed to generate catalog:', err);
  }
}

// --- Validate cross-references ---
async function validateCrossReferences(modules: ModuleInfo[]): Promise<void> {
  console.log('\n🔍 Validasi cross-reference:');

  let issues = 0;

  // Check all module folders exist
  for (const mod of modules) {
    const modDir = path.join(VAULT_MODULES, `M-${mod.slug}`);
    try {
      await fs.access(modDir);
    } catch {
      console.warn(`  ⚠️  Folder M-${mod.slug} belum ada`);
      issues++;
    }
  }

  // Check domain indexes exist
  const domainDirs = ['Purchasing', 'Accounting', 'Inventory', 'Production', 'HR', 'Treasury', 'Sales-POS', 'Auth'];
  for (const d of domainDirs) {
    const indexPath = path.join(VAULT_ROOT, '20-DOMAINS', d, '_Index.md');
    try {
      await fs.access(indexPath);
    } catch {
      console.warn(`  ⚠️  20-DOMAINS/${d}/_Index.md belum ada`);
      issues++;
    }
  }

  if (issues === 0) {
    console.log('  ✅ Semua folder module dan domain index tersedia');
  } else {
    console.log(`  ⚠️  ${issues} issue ditemukan`);
  }
}

// --- Main ---
async function main() {
  console.log('🧠 Suryamas Brain — Auto Sync\n');
  console.log(`Project root: ${PROJECT_ROOT}`);
  console.log(`Vault: ${VAULT_ROOT}\n`);

  // 1. Scan modules
  console.log('📂 Scan modules...');
  const modules = await scanModules();
  console.log(`  ${modules.length} module ditemukan\n`);

  // Warning for Undefined domain
  const undefinedDomain = modules.filter(m => m.domainTag === 'Undefined');
  if (undefinedDomain.length > 0) {
    console.warn(`⚠️  ${undefinedDomain.length} module dengan domain Undefined:`);
    for (const m of undefinedDomain) console.warn(`     - ${m.slug}`);
    console.log('');
  }

  // 2. Extract tables from migrations
  console.log('📂 Extract table dari migrations...');
  const tables = await extractTablesFromMigrations();
  console.log(`  ${tables.size} tabel ditemukan\n`);

  // 3. Sync module vault files
  console.log('🔄 Generate/sync module vault files...');
  await syncModules(modules);

  // 4. Sync table vault files
  console.log('\n🔄 Generate/sync table vault files...');
  await syncTables(tables);

  // 5. Generate module catalog
  console.log('\n📋 Regenerate Module-Catalog.md...');
  await generateModuleCatalog(modules);

  // 6. Validate
  console.log('\n✅ Validasi vault...');
  await validateCrossReferences(modules);

  console.log('\n✨ Selesai!');
  console.log(`  Module: ${modules.length}`);
  console.log(`  Tabel: ${tables.size}`);
  console.log(`  Vault: ${VAULT_ROOT}`);
  console.log(`\n📌 Untuk isi manual (gotchas, flows, ADRs) tetap perlu ditulis manual.`);
  console.log(`   Auto-gen handle: metadata, domain mapping, business rules template, catalog.`);
}

main().catch(console.error);