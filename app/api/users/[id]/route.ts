import { supabase } from "@/lib/supabaseClient";
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        email,
        employee_id,
        role_id,
        is_active,
        last_login,
        created_at,
        employees!inner(
          full_name
        ),
        roles!inner(
          role_name
        ),
        user_branches!inner(
          is_primary,
          branch_id,
          branches!inner(
            nama_branch
          )
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!user) {
      return NextResponse.json(
        { error: 'User tidak ditemukan' },
        { status: 404 }
      );
    }

    // Format response
    const primaryBranch = user.user_branches?.find(ub => ub.is_primary);
    const additionalBranches = user.user_branches?.filter(ub => !ub.is_primary) || [];
    
    const formattedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      employee_id: user.employee_id,
      employee_name: user.employees?.full_name,
      role_id: user.role_id,
      role_name: user.roles?.role_name,
      primary_branch_id: primaryBranch?.branch_id,
      primary_branch_name: primaryBranch?.branches?.nama_branch,
      additional_branches: additionalBranches.map(ab => ({
        id: ab.branch_id,
        name: ab.branches?.nama_branch
      })),
      is_active: user.is_active,
      last_login: user.last_login,
      created_at: user.created_at
    };

    return NextResponse.json(formattedUser);

  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil data user' },
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
    const { username, email, role_id, primary_branch_id, additional_branch_ids = [], is_active } = body;

    // Update user
    const { error: userError } = await supabase
      .from('users')
      .update({
        username,
        email,
        role_id,
        branch_id: primary_branch_id,
        is_active,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (userError) throw userError;

    // Update branch assignments
    if (primary_branch_id) {
      // Delete all existing branch assignments
      await supabase
        .from('user_branches')
        .delete()
        .eq('user_id', id);

      // Create new branch assignments
      const branchesToInsert = [];
      
      // Add primary branch
      branchesToInsert.push({
        user_id: parseInt(id),
        branch_id: primary_branch_id,
        is_primary: true
      });

      // Add additional branches
      additional_branch_ids.forEach((branchId: number) => {
        if (branchId !== primary_branch_id) {
          branchesToInsert.push({
            user_id: parseInt(id),
            branch_id: branchId,
            is_primary: false
          });
        }
      });

      const { error: branchError } = await supabase
        .from('user_branches')
        .insert(branchesToInsert);

      if (branchError) throw branchError;
    }

    return NextResponse.json({ message: 'User berhasil diupdate' });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Gagal mengupdate user' },
      { status: 500 }
    );
  }
}