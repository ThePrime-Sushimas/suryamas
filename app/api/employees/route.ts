// app/api/employees/route.ts
import { supabase } from "@/src/lib/supabaseClient";
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Pagination
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Filters
  const search = searchParams.get('search');
  const branch = searchParams.get('branch');
  const status = searchParams.get('status');
  
  // Sort
  const sortBy = searchParams.get('sort_by') || 'join_date';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  try {
    // Build query
    let query = supabase
      .from('employees')
      .select('*', { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`full_name.ilike.%${search}%,employee_id.ilike.%${search}%,job_position.ilike.%${search}%`);
    }

    // Apply branch filter
    if (branch) {
      query = query.eq('branch_name', branch);
    }

    // Apply status filter
    if (status) {
      query = query.eq('status_employee', status);
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Execute query dengan pagination
    const { data: employees, error, count } = await query.range(from, to);

    if (error) throw error;

    // Get statistics - TOTAL semua data (tanpa filter)
    const { count: totalCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true });

    const { count: contractCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status_employee', 'Contract');

    const { count: permanentCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status_employee', 'Permanent');

    const { count: partTimeCount } = await supabase
      .from('employees')
      .select('*', { count: 'exact', head: true })
      .eq('status_employee', 'Part Time');

    return NextResponse.json({
      employees: employees || [],
      pagination: {
        current_page: page,
        total_pages: Math.ceil((count || 0) / limit),
        total_count: count || 0
      },
      stats: {
        total_count: totalCount || 0,
        contract_count: contractCount || 0,
        permanent_count: permanentCount || 0,
        part_time_count: partTimeCount || 0
      }
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json(
      { error: 'Error fetching employees' },
      { status: 500 }
    );
  }
}