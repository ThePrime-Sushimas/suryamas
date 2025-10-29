import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('module', { ascending: true });

    if (error) throw error;

    // Get role count for each permission
    const permissionsWithCounts = await Promise.all(
      (data || []).map(async (permission) => {
        const { count: roleCount } = await supabase
          .from('role_permissions')
          .select('*', { count: 'exact', head: true })
          .eq('permission_id', permission.id);

        return {
          ...permission,
          role_count: roleCount || 0
        };
      })
    );

    return NextResponse.json({ permissions: permissionsWithCounts });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
}