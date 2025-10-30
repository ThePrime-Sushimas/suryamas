import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    // Single query with LEFT JOIN to get user count - fixes N+1 problem
    const { data, error } = await supabase
      .from('roles')
      .select(`
        *,
        users!role_id(count)
      `)
      .order('hierarchy_level', { ascending: false });

    if (error) throw error;

    // Transform data to include user_count
    const rolesWithCounts = (data || []).map(role => ({
      ...role,
      user_count: role.users?.[0]?.count || 0
    }));

    return NextResponse.json({ roles: rolesWithCounts });
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