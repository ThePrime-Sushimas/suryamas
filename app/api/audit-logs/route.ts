import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('audit_logs')
      .select(`
        *,
        user:users(username),
        employee:employees(full_name)
      `, { count: 'exact' });

    if (search) {
      query = query.or(`action.ilike.%${search}%,table_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .range((page - 1) * limit, page * limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const logs = data?.map(log => ({
      id: log.id,
      user_name: log.user?.username || '',
      employee_name: log.employee?.full_name || '',
      action: log.action,
      table_name: log.table_name,
      record_id: log.record_id,
      old_values: log.old_values,
      new_values: log.new_values,
      ip_address: log.ip_address,
      user_agent: log.user_agent,
      created_at: log.created_at
    })) || [];

    return NextResponse.json({
      logs,
      pagination: {
        current_page: page,
        total_pages: Math.ceil((count || 0) / limit),
        total_count: count || 0
      }
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}