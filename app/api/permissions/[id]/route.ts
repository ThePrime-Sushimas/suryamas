import { supabase } from "@/lib/supabaseClient";
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: permission, error } = await supabase
      .from('permissions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!permission) {
      return NextResponse.json(
        { error: 'Permission tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json(permission);

  } catch (error) {
    console.error('Error fetching permission:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data permission' },
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
    const { permission_code, permission_name, module, description } = body;

    // Validate required fields
    if (!permission_code || !permission_name || !module) {
      return NextResponse.json(
        { error: 'Kode permission, nama, dan modul wajib diisi' },
        { status: 400 }
      );
    }

    // Check if permission_code already exists (excluding current record)
    const { data: existing } = await supabase
      .from('permissions')
      .select('id')
      .eq('permission_code', permission_code)
      .neq('id', id)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Kode permission sudah ada' },
        { status: 400 }
      );
    }

    const { data: permission, error } = await supabase
      .from('permissions')
      .update({
        permission_code,
        permission_name,
        module,
        description,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!permission) {
      return NextResponse.json(
        { error: 'Permission tidak ditemukan' },
        { status: 404 }
      );
    }

    return NextResponse.json(permission);

  } catch (error) {
    console.error('Error updating permission:', error);
    return NextResponse.json(
      { error: 'Gagal mengupdate permission' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check if permission is used in role_permissions
    const { data: rolePermissions } = await supabase
      .from('role_permissions')
      .select('id')
      .eq('permission_id', id)
      .limit(1);

    if (rolePermissions && rolePermissions.length > 0) {
      return NextResponse.json(
        { error: 'Permission tidak dapat dihapus karena masih digunakan oleh role' },
        { status: 400 }
      );
    }

    // Check if permission is used in user_permission_overrides
    const { data: userOverrides } = await supabase
      .from('user_permission_overrides')
      .select('id')
      .eq('permission_id', id)
      .limit(1);

    if (userOverrides && userOverrides.length > 0) {
      return NextResponse.json(
        { error: 'Permission tidak dapat dihapus karena masih digunakan oleh user' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('permissions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Permission berhasil dihapus' });

  } catch (error) {
    console.error('Error deleting permission:', error);
    return NextResponse.json(
      { error: 'Gagal menghapus permission' },
      { status: 500 }
    );
  }
}