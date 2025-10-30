import { supabase } from "@/lib/supabaseClient";
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get user permissions from role and overrides in single query
    const { data: userWithPermissions, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        role_id,
        roles!inner(
          role_name,
          role_permissions(
            permissions(
              permission_code,
              permission_name,
              module
            )
          )
        ),
        user_permission_overrides(
          permission_id,
          is_granted,
          permissions(
            permission_code,
            permission_name,
            module
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!userWithPermissions) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      );
    }

    // Process permissions
    const rolePermissions = userWithPermissions.roles?.role_permissions?.map(
      rp => rp.permissions.permission_code
    ) || [];

    const overrides = userWithPermissions.user_permission_overrides || [];
    const grantedOverrides = overrides
      .filter(o => o.is_granted)
      .map(o => o.permissions.permission_code);
    
    const revokedOverrides = overrides
      .filter(o => !o.is_granted)
      .map(o => o.permissions.permission_code);

    // Final permissions = role permissions + granted overrides - revoked overrides
    const finalPermissions = [
      ...rolePermissions.filter(p => !revokedOverrides.includes(p)),
      ...grantedOverrides
    ];

    return NextResponse.json({
      user: {
        id: userWithPermissions.id,
        username: userWithPermissions.username,
        full_name: userWithPermissions.full_name,
        role_name: userWithPermissions.roles?.role_name
      },
      permissions: [...new Set(finalPermissions)]
    });

  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil permissions user' },
      { status: 500 }
    );
  }
}