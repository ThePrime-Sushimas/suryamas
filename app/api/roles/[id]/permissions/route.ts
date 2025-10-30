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

    // Get role with assigned permissions in single query (avoid N+1)
    let permissionsQuery = supabase
      .from('permissions')
      .select(`
        *,
        role_permissions!left(
          id,
          role_id
        )
      `)
      .order('module')
      .order('permission_name');

    if (module) {
      permissionsQuery = permissionsQuery.eq('module', module);
    }

    const { data: permissions, error: permError } = await permissionsQuery;

    if (permError) throw permError;

    // Transform data to include assignment status
    const permissionsWithStatus = permissions?.map(permission => ({
      ...permission,
      is_assigned: permission.role_permissions?.some(rp => rp.role_id === parseInt(id)) || false,
      role_permissions: undefined // Remove the join data
    })) || [];

    // Get role info
    const { data: role, error: roleError } = await supabase
      .from('roles')
      .select('id, role_name')
      .eq('id', id)
      .single();

    if (roleError) throw roleError;

    if (!role) {
      return NextResponse.json(
        { error: 'Role tidak ditemukan' },
        { status: 404 }
      );
    }

    // Get unique modules for filter
    const { data: modules } = await supabase
      .from('permissions')
      .select('module')
      .order('module');

    const uniqueModules = [...new Set(modules?.map(m => m.module) || [])];

    return NextResponse.json({
      role,
      permissions: permissionsWithStatus,
      modules: uniqueModules
    });

  } catch (error) {
    console.error('Error fetching role permissions:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data permissions role' },
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
    const { permission_ids } = body;

    if (!Array.isArray(permission_ids)) {
      return NextResponse.json(
        { error: 'Permission IDs harus berupa array' },
        { status: 400 }
      );
    }

    // Verify role exists
    const { data: role } = await supabase
      .from('roles')
      .select('id')
      .eq('id', id)
      .single();

    if (!role) {
      return NextResponse.json(
        { error: 'Role tidak ditemukan' },
        { status: 404 }
      );
    }

    // Delete existing role permissions
    const { error: deleteError } = await supabase
      .from('role_permissions')
      .delete()
      .eq('role_id', id);

    if (deleteError) throw deleteError;

    // Insert new role permissions if any
    if (permission_ids.length > 0) {
      const rolePermissions = permission_ids.map(permission_id => ({
        role_id: parseInt(id),
        permission_id
      }));

      const { error: insertError } = await supabase
        .from('role_permissions')
        .insert(rolePermissions);

      if (insertError) throw insertError;
    }

    return NextResponse.json({ 
      message: 'Permissions role berhasil diupdate',
      assigned_count: permission_ids.length
    });

  } catch (error) {
    console.error('Error updating role permissions:', error);
    return NextResponse.json(
      { error: 'Gagal mengupdate permissions role' },
      { status: 500 }
    );
  }
}