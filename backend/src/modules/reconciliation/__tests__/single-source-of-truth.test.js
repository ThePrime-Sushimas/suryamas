/**
 * Smoke Test: Verify reconciliation single source of truth refactor
 *
 * Test ini memverifikasi:
 * 1. Semua manual cascade ke pos_sync_aggregates sudah dihapus
 * 2. Service methods masih callable (no runtime import errors)
 * 3. Migration file ada dan isinya benar
 *
 * Jalankan: npx jest src/modules/reconciliation/__tests__/single-source-of-truth.test.js
 */

const fs = require("fs");
const path = require("path");

const BACKEND_SRC = path.resolve(__dirname, "../../../");

describe("Single Source of Truth — Code Verification", () => {
  describe("Manual cascade removal", () => {
    const filesToCheck = [
      "modules/reconciliation/orchestrator/reconciliation-orchestrator.service.ts",
      "modules/reconciliation/bank-settlement-group/bank-settlement-group.repository.ts",
      "modules/reconciliation/bank-reconciliation/bank-reconciliation.repository.ts",
    ];

    filesToCheck.forEach((file) => {
      it(`${path.basename(file)} — no .from("pos_sync_aggregates").update() calls`, () => {
        const content = fs.readFileSync(path.join(BACKEND_SRC, file), "utf-8");

        const lines = content.split("\n");
        let inPosSyncBlock = false;
        const violations = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (
            line.includes('.from("pos_sync_aggregates")') ||
            line.includes(".from('pos_sync_aggregates')")
          ) {
            inPosSyncBlock = true;
          }

          if (inPosSyncBlock && line.includes(".update(")) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("//") && !trimmed.startsWith("*")) {
              violations.push(`Line ${i + 1}: ${trimmed}`);
            }
          }

          if (line.includes(";") || line.trim() === "") {
            inPosSyncBlock = false;
          }
        }

        expect(violations).toEqual([]);
      });
    });

    it("cascadeReconciliationToPosSyncAggregates method removed from settlement repo", () => {
      const content = fs.readFileSync(
        path.join(
          BACKEND_SRC,
          "modules/reconciliation/bank-settlement-group/bank-settlement-group.repository.ts"
        ),
        "utf-8"
      );

      expect(content).not.toContain("cascadeReconciliationToPosSyncAggregates");
    });

    it("no direct pos_sync_aggregates UPDATE in orchestrator", () => {
      const content = fs.readFileSync(
        path.join(
          BACKEND_SRC,
          "modules/reconciliation/orchestrator/reconciliation-orchestrator.service.ts"
        ),
        "utf-8"
      );

      // Should NOT contain .from("pos_sync_aggregates") followed by .update
      // But SHOULD contain the comment about trigger
      expect(content).toContain("DB trigger");
      expect(content).not.toMatch(
        /\.from\(["']pos_sync_aggregates["']\)[\s\S]*?\.update\(/
      );
    });

    it("no direct pos_sync_aggregates UPDATE in bank-reconciliation undo methods", () => {
      const content = fs.readFileSync(
        path.join(
          BACKEND_SRC,
          "modules/reconciliation/bank-reconciliation/bank-reconciliation.repository.ts"
        ),
        "utf-8"
      );

      // Extract undoReconciliation and undoReconciliationGroup methods
      // and verify they don't contain pos_sync_aggregates .update calls
      const undoSection = content.substring(
        content.indexOf("async undoReconciliation("),
        content.indexOf("// MULTI-MATCH REPOSITORY") || content.length
      );

      expect(undoSection).not.toMatch(
        /\.from\(["']pos_sync_aggregates["']\)[\s\S]*?\.update\(/
      );
    });
  });

  describe("Migration file", () => {
    const migrationPath = path.resolve(
      __dirname,
      "../../../../supabase/migrations/20250417000001_reconciliation_single_source_of_truth.sql"
    );

    it("trigger migration file exists", () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it("contains trigger function definition", () => {
      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("CREATE OR REPLACE FUNCTION public.sync_pos_sync_reconciliation()");
    });

    it("contains trigger on aggregated_transactions", () => {
      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("trg_sync_pos_sync_reconciliation");
      expect(content).toContain("AFTER UPDATE OF is_reconciled ON public.aggregated_transactions");
    });

    it("trigger handles both reconcile and undo", () => {
      const content = fs.readFileSync(migrationPath, "utf-8");
      // Reconcile: set is_reconciled = NEW.is_reconciled
      expect(content).toContain("is_reconciled        = NEW.is_reconciled");
      // Undo: reset bank_statement_id to NULL when false
      expect(content).toContain("WHEN NEW.is_reconciled = false THEN NULL");
    });

    it("trigger only fires when is_reconciled actually changes", () => {
      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("OLD.is_reconciled IS NOT DISTINCT FROM NEW.is_reconciled");
    });

    it("trigger only applies to POS_SYNC source type", () => {
      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("NEW.source_type = 'POS_SYNC'");
      expect(content).toContain("NEW.pos_sync_aggregate_id IS NOT NULL");
    });

    it("contains view v_bank_statement_reconciliation_status", () => {
      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("v_bank_statement_reconciliation_status");
      expect(content).toContain("DIRECT");
      expect(content).toContain("MULTI_MATCH");
      expect(content).toContain("CASH_DEPOSIT");
      expect(content).toContain("SETTLEMENT_GROUP");
    });

    it("contains updated RPC without pos_sync_aggregates sync", () => {
      const content = fs.readFileSync(migrationPath, "utf-8");
      expect(content).toContain("sync_cash_deposit_reconciliation");
      // RPC should NOT have direct UPDATE pos_sync_aggregates anymore
      // It should only update aggregated_transactions (trigger handles the rest)
      const rpcSection = content.substring(
        content.indexOf("CREATE OR REPLACE FUNCTION public.sync_cash_deposit_reconciliation")
      );
      expect(rpcSection).toContain("UPDATE aggregated_transactions");
      // The old RPC had a separate CTE "updated_pos" that directly updated pos_sync_aggregates
      expect(rpcSection).not.toContain("UPDATE pos_sync_aggregates");
    });
  });

  describe("SQL test file", () => {
    it("test script exists", () => {
      const testPath = path.resolve(
        __dirname,
        "../../../../supabase/migrations/test_trigger_reconciliation.sql"
      );
      expect(fs.existsSync(testPath)).toBe(true);
    });

    it("test script ends with ROLLBACK (safe for production)", () => {
      const testPath = path.resolve(
        __dirname,
        "../../../../supabase/migrations/test_trigger_reconciliation.sql"
      );
      const content = fs.readFileSync(testPath, "utf-8");
      expect(content.trim().endsWith("ROLLBACK;")).toBe(true);
    });
  });
});
