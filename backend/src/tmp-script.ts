import { supabase } from "./config/supabase";

async function main() {
  const { data, error } = await supabase.rpc('execute_sql_query', { query: "SELECT conname, pg_get_constraintdef(c.oid) as constraint_def FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'pos_sync_aggregate_lines'" });
  console.log("Result:", { data, error });
}
main();
