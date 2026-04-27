import { Request, Response } from "express";
import { posSyncAggregatesRepository } from "./pos-sync-aggregates.repository";
import {
  ListAggregatesParams,
} from "./pos-sync-aggregates.types";

export const posSyncAggregatesController = {
  list: async (req: Request, res: Response): Promise<void> => {
    try {
      const params: ListAggregatesParams = {
        date_from: req.query.date_from as string,
        date_to: req.query.date_to as string,
        branch_id: req.query.branch_id as string,
        branch_ids: req.query.branch_ids as string,
        payment_method_id: req.query.payment_method_id as string,
        payment_method_ids: req.query.payment_method_ids as string,
        status: req.query.status as string,
        is_reconciled: req.query.is_reconciled as string,
        search: req.query.search as string,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 50,
        fields: req.query.fields as 'slim' | 'full' | undefined,
      };
      const result = await posSyncAggregatesRepository.list(params);
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message });
    }
  },

  getById: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await posSyncAggregatesRepository.getById(
        req.params.id as string,
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message });
    }
  },

  getLines: async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await posSyncAggregatesRepository.getLines(
        req.params.id as string,
      );
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message });
    }
  },

  getVoidDetails: async (req: Request, res: Response): Promise<void> => {
    try {
      const { sales_nums } = req.body;
      if (!Array.isArray(sales_nums) || sales_nums.length === 0) {
        res.status(400).json({ success: false, message: 'sales_nums array is required' });
        return;
      }
      const data = await posSyncAggregatesRepository.findVoidSalesDetails(sales_nums.slice(0, 200));
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message });
    }
  },
};
