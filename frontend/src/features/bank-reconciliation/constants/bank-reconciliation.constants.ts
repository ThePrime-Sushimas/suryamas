import type { MatchingCriteria } from "../types/bank-reconciliation.types";

export const DEFAULT_MATCHING_CRITERIA: MatchingCriteria = {
  amountTolerance: 0.01,
  dateBufferDays: 3,
  differenceThreshold: 1000, // Example default
};

export const RECONCILIATION_STATUS_COLORS: Record<string, string> = {
  PENDING: "gray",
  AUTO_MATCHED: "green",
  MANUALLY_MATCHED: "blue",
  DISCREPANCY: "red",
  UNRECONCILED: "orange",
};

export const DISCREPANCY_REASON_LABELS: Record<string, string> = {
  NO_MATCH: "No Matching Aggregate Found",
  AMOUNT_MISMATCH: "Amount Mismatch",
  DATE_ANOMALY: "Date Anomaly",
};

export const DISCREPANCY_SEVERITY_COLORS: Record<string, string> = {
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "info",
};
