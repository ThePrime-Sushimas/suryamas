import { Router } from "express";
import { requireApiKey } from "../../../middleware/api-key.middleware";
import { authenticate } from "../../../middleware/auth.middleware";
import {
  salesController,
  masterController,
  stagingController,
} from "./pos-sync.controller";
import { processPosSyncAggregates } from "@/modules/jobs/processors/pos-sync-aggregates.processor";
import { logError } from "../../../config/logger";

const router = Router();

router.post("/import", requireApiKey, salesController.import);
router.post("/master", requireApiKey, masterController.sync);
router.get("/staging/:table", authenticate, stagingController.list);
router.patch("/staging/:table/:id", authenticate, stagingController.update);

// Manual reprocess — proses semua data di tr_saleshead
router.post("/reprocess-aggregates", authenticate, async (req, res) => {
  try {
    console.log("🔄 Manual reprocess aggregates triggered");
    // Fire and forget — tidak block response
    processPosSyncAggregates()
      .then((result: any) => {
        console.log("✅ Reprocess complete:", result);
      })
      .catch((err: any) => {
        logError("Reprocess failed", { err });
      });
    res.json({
      success: true,
      message: "Reprocess started in background — cek log untuk hasilnya",
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err?.message });
  }
});

export default router;
