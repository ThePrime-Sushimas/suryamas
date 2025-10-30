import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('hierarchy_level', { ascending: false });

    if (error) throw error;

    // Get user count for each role
    const rolesWithCounts = await Promise.all(
      (data || []).map(async (role) => {
        const { count: userCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('role_id', role.id);

        return {
          ...role,
          user_count: userCount || 0
        };
      })
    );

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