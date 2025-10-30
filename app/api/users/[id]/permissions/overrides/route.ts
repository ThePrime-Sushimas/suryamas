import { supabase } from "@/lib/supabaseClient";
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const module = searchParams.get('module') || '';

    // Get user with role permissions and overrides in single query
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        id,
        username,
        full_name,
        role_id,
        roles!inner(
          role_name,
          role_permissions(
            permission_id,
            permissions(
              id,
              permission_code,
              permission_name,
              module,
              description
            )
          )
        )
      `)
      .eq('id', id)
      .single();

    if (userError) throw userError;

    if (!userData) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      );
    }

    // Get all permissions with override status
    let permissionsQuery = supabase
      .from('permissions')
      .select(`
        *,
        user_permission_overrides!left(
          id,
          is_granted,
          user_id
        )
      `)
      .order('module')
      .order('permission_name');

    if (module) {
      permissionsQuery = permissionsQuery.eq('module', module);
    }

    const { data: allPermissions, error: permError } = await permissionsQuery;

    if (permError) throw permError;

    // Get role permission IDs
    const rolePermissionIds = userData.roles?.role_permissions?.map(
      rp => rp.permission_id
    ) || [];

    // Transform permissions with status
    const permissionsWithStatus = allPermissions?.map(permission => {
      const override = permission.user_permission_overrides?.find(
        upo => upo.user_id === parseInt(id)
      );
      
      const hasRolePermission = rolePermissionIds.includes(permission.id);
      
      return {
        ...permission,
        has_role_permission: hasRolePermission,
        override_status: override ? (override.is_granted ? 'granted' : 'revoked') : null,
        override_id: override?.id || null,
        user_permission_overrides: undefined
      };
    }) || [];

    // Get unique modules
    const { data: modules } = await supabase
      .from('permissions')
      .select('module')
      .order('module');

    const uniqueModules = [...new Set(modules?.map(m => m.module) || [])];

    return NextResponse.json({
      user: {
        id: userData.id,
        username: userData.username,
        full_name: userData.full_name,
        role_name: userData.roles?.role_name
      },
      permissions: permissionsWithStatus,
      modules: uniqueModules
    });

  } catch (error) {
    console.error('Error fetching user permission overrides:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data permission overrides' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { overrides } = body;

    if (!Array.isArray(overrides)) {
      return NextResponse.json(
        { error: 'Overrides harus berupa array' },
        { status: 400 }
      );
    }

    // Verify user exists
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('id', id)
      .single();

    if (!user) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      );
    }

    // Delete existing overrides for this user
    const { error: deleteError } = await supabase
      .from('user_permission_overrides')
      .delete()
      .eq('user_id', id);

    if (deleteError) throw deleteError;

    // Insert new overrides if any
    if (overrides.length > 0) {
      const overrideData = overrides.map(override => ({
        user_id: parseInt(id),
        permission_id: override.permission_id,
        is_granted: override.is_granted
      }));

      const { error: insertError } = await supabase
        .from('user_permission_overrides')
        .insert(overrideData);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ 
      message: 'Permission overrides berhasil diupdate',
      overrides_count: overrides.length
    });

  } catch (error) {
    console.error('Error updating user permission overrides:', error);
    return NextResponse.json(
      { error: 'Gagal mengupdate permission overrides' },
      { status: 500 }
    );
  }
}