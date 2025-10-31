import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }    
    
    // Get user with related data
    const { data: user, error } = await supabase
      .from('users')
      .select(`
        *,
        employees!inner(full_name),
        roles!inner(role_name, role_code),
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

    // Check account lock
    if (user.failed_login_attempts >= 5) {
      return NextResponse.json(
        { error: 'Account is locked due to too many failed attempts' },
        { status: 401 }
      );
    }

    // Verify password
    let isValidPassword = false;
    
    if (user.password_hash.startsWith('$2b$')) {
      isValidPassword = await bcrypt.compare(password, user.password_hash);
    } else {
      const inputBase64 = Buffer.from(password).toString('base64');
      isValidPassword = inputBase64 === user.password_hash;
    }

    if (!isValidPassword) {
      await supabase
        .from('users')
        .update({ 
          failed_login_attempts: (user.failed_login_attempts || 0) + 1 
        })
        .eq('id', user.id);

      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Reset failed attempts
    await supabase
      .from('users')
      .update({ 
        failed_login_attempts: 0,
        last_login: new Date().toISOString()
      })
      .eq('id', user.id);

    // GET PERMISSIONS - QUERY YANG LEBIH SEDERHANA
    const { data: permissions } = await supabase
      .from('role_permissions')
      .select(`
        permission_code
      `)
      .eq('role_id', user.role_id);

    // Extract permission codes
    const userPermissions = permissions?.map(p => p.permission_code).filter(Boolean) || [];
    
    // Prepare user data
    const userData = {
      id: user.id.toString(),
      username: user.username,
      full_name: user.employees?.full_name,
      role: user.roles?.role_code,
      branch_id: user.branch_id?.toString(),
      branch_name: user.branches?.nama_branch,
      email: user.email,
      permissions: userPermissions
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