import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    let query = supabase
      .from('users')
      .select(`
        *,
        role:roles(role_name, role_code),
        employee:employees(full_name, employee_id),
        branch:branches(nama_branch)
      `, { count: 'exact' });

    if (search) {
      query = query.or(`username.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .range((page - 1) * limit, page * limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const users = data?.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      employee_id: user.employee_id,
      employee_name: user.employee?.full_name || '',
      role_name: user.role?.role_name || '',
      branch_name: user.branch?.nama_branch || '',
      is_active: user.is_active,
      last_login: user.last_login,
      created_at: user.created_at
    })) || [];

    return NextResponse.json({
      users,
      pagination: {
        current_page: page,
        total_pages: Math.ceil((count || 0) / limit),
        total_count: count || 0
      }
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Simple password hashing (in production, use bcrypt)
    const passwordHash = Buffer.from(body.password).toString('base64');
    
    const { data, error } = await supabase
      .from('users')
      .insert([{
        employee_id: body.employee_id,
        username: body.username,
        email: body.email,
        password_hash: passwordHash,
        role_id: body.role_id,
        branch_id: body.branch_id,
        is_active: body.is_active ?? true,
        must_change_password: body.must_change_password ?? true,
        created_at: new Date().toISOString()
      }])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    return NextResponse.json({ user: data[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}