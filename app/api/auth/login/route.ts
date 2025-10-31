import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';
import { RolePermission } from '@/types/permissions';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Get user with role and employee info
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        id,
        username,
        email,
        password_hash,
        is_active,
        failed_login_attempts,
        role_id,
        branch_id,
        employee_id,
        employees!inner(full_name),
        roles!inner(id, role_name, role_code),
        branches!inner(nama_branch)
      `)
      .eq('username', username)
      .eq('is_active', true)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Check if account is locked
    if (user.failed_login_attempts >= 5) {
      return NextResponse.json(
        { error: 'Account is locked due to too many failed attempts' },
        { status: 401 }
      );
    }

    // Verify password - support both bcrypt and base64 formats
    let isValidPassword = false;
    
    if (user.password_hash.startsWith('$2b$')) {
      // Bcrypt format
      isValidPassword = await bcrypt.compare(password, user.password_hash);
    } else {
      // Base64 format (legacy)
      isValidPassword = Buffer.from(password).toString('base64') === user.password_hash;
    }

    if (!isValidPassword) {
      // Increment failed attempts
      await supabase
        .from('users')
        .update({ 
          failed_login_attempts: user.failed_login_attempts + 1 
        })
        .eq('id', user.id);

      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Reset failed attempts and update last login
    await supabase
      .from('users')
      .update({ 
        failed_login_attempts: 0,
        last_login: new Date().toISOString()
      })
      .eq('id', user.id);

    // Get user permissions from role
    const { data: rolePermissions, error: permError } = await supabase
      .from('role_permissions')
      .select(`
        permissions(
          permission_code
        )
      `)
      .eq('role_id', user.roles[0]?.id);
        
    const userPermissions = rolePermissions?.map(rp => rp.permissions[0]?.permission_code).filter(Boolean) || [];
    console.log('Mapped permissions:', userPermissions);
    console.log('==================');
    
    // Fallback: If super admin has no permissions, give all access
    const finalPermissions = userPermissions.length === 0 && user.roles[0]?.role_code === 'super_admin' 
      ? ['*'] // Wildcard permission for super admin
      : userPermissions;

    const userData = {
      id: user.id.toString(),
      username: user.username,
      full_name: user.employees[0]?.full_name,
      role: user.roles[0]?.role_code,
      branch_name: user.branches[0]?.nama_branch,
      email: user.email,
      permissions: finalPermissions
    };

    const token = `jwt-${user.id}-${Date.now()}`;

    return NextResponse.json({
      user: userData,
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}