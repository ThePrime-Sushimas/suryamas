// app/api/employees/route.ts
import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { data: employee, error } = await supabase
      .from('employees')
      .insert([body])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error('Error creating employee:', error);
    return NextResponse.json({ error: 'Error creating employee' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hasUserAccount = searchParams.get('has_user_account');
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
    let query;
    
    if (hasUserAccount === 'false') {
      // Get employees without user accounts
      const { data: users } = await supabase
        .from('users')
        .select('employee_id');

      const existingEmployeeIds = users?.map(user => user.employee_id) || [];
      
      query = supabase
        .from('employees')
        .select(`
          employee_id,
          full_name,
          email,
          branch_name,
          job_position
        `, { count: 'exact' })
        .eq('is_deleted', false);
        
      if (existingEmployeeIds.length > 0) {
        query = query.not('employee_id', 'in', `(${existingEmployeeIds.join(',')})`);
      }
    } else {
      query = supabase
        .from('employees')
        .select('*', { count: 'exact' })
        .eq('is_deleted', false);
    }

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
