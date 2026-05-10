/**
 * PosAggregatesDetail.tsx — Clean, compact version
 * All information preserved, styling simplified.
 */

import React from "react";
import type { AggregatedTransactionWithDetails } from "../types";
import { getAlerts, getReconciliationType } from "./detail/shared";
import { DetailHeader } from "./detail/DetailHeader";
import { DetailAlerts } from "./detail/DetailAlerts";
import { DetailMetrics } from "./detail/DetailMetrics";
import { DetailEstVsActual } from "./detail/DetailEstVsActual";
import { DetailMetadata } from "./detail/DetailMetadata";
import { DetailBankRecon } from "./detail/DetailBankRecon";
import { DetailJournal } from "./detail/DetailJournal";
import { DetailAudit } from "./detail/DetailAudit";

interface PosAggregatesDetailProps {
  transaction: AggregatedTransactionWithDetails;
}

export const PosAggregatesDetail: React.FC<PosAggregatesDetailProps> = ({ transaction }) => {
  const alerts = getAlerts(transaction);
  const reconciliationType = getReconciliationType(transaction);
  const hasBankMutation = !!(
    transaction.bank_mutation_id || transaction.settlement_group_id || transaction.multi_match_group_id
  );

  return (
    <div className="space-y-3 max-w-6xl mx-auto">
      <DetailHeader transaction={transaction} hasBankMutation={hasBankMutation} />
      <DetailAlerts alerts={alerts} />
      <DetailMetrics transaction={transaction} reconciliationType={reconciliationType} />
      <DetailEstVsActual transaction={transaction} reconciliationType={reconciliationType} />
      <DetailMetadata transaction={transaction} />
      <DetailBankRecon transaction={transaction} reconciliationType={reconciliationType} />
      <DetailJournal transaction={transaction} />
      <DetailAudit transaction={transaction} />
    </div>
  );
};

export default PosAggregatesDetail;
