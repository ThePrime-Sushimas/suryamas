// app/api/employees/route.ts
import { supabase } from "@/src/lib/supabaseClient";
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const search = searchParams.get('search');
  const branch = searchParams.get('branch');
  const status = searchParams.get('status');
  const sortBy = searchParams.get('sort_by') || 'join_date';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  try {
    let query = supabase
      .from('employees')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,employee_id.ilike.%${search}%,job_position.ilike.%${search}%`);
    }
    if (branch) {
      query = query.eq('branch_name', branch);
    }
    if (status) {
      query = query.eq('status_employee', status);
    }

    query = query.order(sortBy, { ascending: sortOrder === 'asc' }).range(from, to);

    const { data: employees, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      employees: employees || [],
      pagination: {
        current_page: page,
        total_pages: Math.ceil((count || 0) / limit),
        total_count: count || 0
      }
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return NextResponse.json({ error: 'Error fetching employees' }, { status: 500 });
  }
}
