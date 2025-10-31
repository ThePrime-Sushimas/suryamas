import { supabase } from "@/lib/supabaseClient";
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const module = searchParams.get('module') || '';
    
    const offset = (page - 1) * limit;

    // Build query with filters
    let query = supabase
      .from('permissions')
      .select('*', { count: 'exact' });

    if (search) {
      query = query.or(`permission_name.ilike.%${search}%,permission_code.ilike.%${search}%`);
    }

    if (module) {
      query = query.eq('module', module);
    }

    // Get paginated results
    const { data: permissions, error, count } = await query
      .order('module', { ascending: true })
      .order('permission_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Get unique modules for filter
    const { data: modules, error: moduleError } = await supabase
      .from('permissions')
      .select('module')
      .order('module');

    if (moduleError) {
      console.error('Module query error:', moduleError);
    }

    const uniqueModules = [...new Set(modules?.map(m => m.module) || [])];

    return NextResponse.json({
      permissions: permissions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      modules: uniqueModules
    });

  } catch (error) {
    console.error('Error fetching permissions:', error);
    
    // Return empty data instead of error to prevent frontend crash
    return NextResponse.json({
      permissions: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
      },
      modules: []
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { permission_code, permission_name, module, table_name, description } = body;

    // Validate required fields
    if (!permission_code || !permission_name || !module) {
      return NextResponse.json(
        { error: 'Kode permission, nama, dan modul wajib diisi' },
        { status: 400 }
      );
    }

    // Check if permission_code already exists
    const { data: existing } = await supabase
      .from('permissions')
      .select('id')
      .eq('permission_code', permission_code)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Kode permission sudah ada' },
        { status: 400 }
      );
    }

    const { data: permission, error } = await supabase
      .from('permissions')
      .insert({
        permission_code,
        permission_name,
        module,
        table_name,
        description
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(permission, { status: 201 });

  } catch (error) {
    console.error('Error creating permission:', error);
    return NextResponse.json(
      { error: 'Gagal membuat permission' },
      { status: 500 }
    );
  }
}