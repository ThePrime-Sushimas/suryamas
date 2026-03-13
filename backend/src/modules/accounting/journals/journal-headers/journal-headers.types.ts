import {
  JournalType,
  JournalStatus,
  JournalLine,
} from "../shared/journal.types";

export interface JournalHeader {
  id: string;
  company_id: string;
  branch_id?: string;
  journal_number: string;
  sequence_number: number;
  journal_date: string;
  period: string;
  journal_type: JournalType;
  source_module?: string;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  description: string;
  total_debit: number;
  total_credit: number;
  currency: string;
  exchange_rate: number;
  status: JournalStatus;
  is_reversed: boolean;
  reversal_of_journal_id?: string; // journal ini membalik journal apa
  reversed_by_journal_id?: string; // journal ini dibalik oleh journal apa
  is_auto?: boolean;
  reversed_by?: string;
  reversal_date?: string;
  reversal_reason?: string;
  submitted_at?: string;
  submitted_by?: string;
  approved_at?: string;
  approved_by?: string;
  rejected_at?: string;
  rejected_by?: string;
  rejection_reason?: string;
  posted_at?: string;
  posted_by?: string;
  created_at: string;
  created_by?: string;
  updated_at: string;
  updated_by?: string;
  deleted_at?: string;
  deleted_by?: string;
  tags?: Record<string, any>;
  approval_flow_id?: string;
  created_by_name?: string;
  updated_by_name?: string;
  submitted_by_name?: string;
  approved_by_name?: string;
  posted_by_name?: string;
  rejected_by_name?: string;
  reversed_by_name?: string;
  deleted_by_name?: string;
}

export interface JournalHeaderWithLines extends JournalHeader {
  branch_name?: string;
  lines: JournalLine[];
}

export interface CreateJournalDto {
  // company_id comes from auth context, not client
  branch_id?: string;
  reversal_of_journal_id?: string;
  journal_date: string;
  journal_type: JournalType;
  description: string;
  currency?: string;
  exchange_rate?: number;
  reference_type?: string;
  reference_id?: string;
  reference_number?: string;
  source_module?: string;
  tags?: Record<string, any>;
  lines: CreateJournalLineDto[];
}

export interface CreateJournalLineDto {
  line_number: number;
  account_id: string;
  description?: string;
  debit_amount: number;
  credit_amount: number;
}

export interface UpdateJournalDto {
  journal_date?: string;
  description?: string;
  lines?: CreateJournalLineDto[];
}

export interface JournalFilter {
  company_id: string;
  branch_id?: string;
  journal_type?: JournalType;
  status?: JournalStatus;
  date_from?: string;
  date_to?: string;
  period?: string;
  search?: string;
  show_deleted?: boolean;
}

export interface SortParams {
  field:
    | "journal_number"
    | "journal_date"
    | "journal_type"
    | "status"
    | "total_debit"
    | "created_at"
    | "updated_at";
  order: "asc" | "desc";
}
