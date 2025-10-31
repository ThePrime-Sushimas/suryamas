import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('roles')
      .select(`
        *,
        users!role_id(count)
      `, { count: 'exact' });

    // Add search filter
    if (search) {
      query = query.or(`role_name.ilike.%${search}%,role_code.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Add pagination and ordering
    query = query
      .order('hierarchy_level', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    // Transform data to include user_count
    const rolesWithCounts = (data || []).map(role => ({
      ...role,
      user_count: role.users?.[0]?.count || 0
    }));

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      roles: rolesWithCounts,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount: count || 0,
        limit
      }
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    return NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('roles')
      .insert([{
        role_code: body.role_code,
        role_name: body.role_name,
        description: body.description,
        hierarchy_level: body.hierarchy_level,
        is_active: body.is_active ?? true,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create role' },
        { status: 400 }
      );
    }

    return NextResponse.json({ role: data[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating role:', error);
    return NextResponse.json(
      { error: 'Failed to create role' },
      { status: 500 }
    );
  }
}