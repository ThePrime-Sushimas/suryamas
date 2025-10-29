import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Pagination
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Filters
  const search = searchParams.get('search');
  const kota = searchParams.get('kota');
  const status = searchParams.get('status');
  
  // Sort
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') || 'desc';

  try {
    // Build main query
    let query = supabase
      .from('branches')
      .select('*', { count: 'exact' });

    // Apply search filter
    if (search) {
      query = query.or(`nama_branch.ilike.%${search}%,kode_branch.ilike.%${search}%,alamat.ilike.%${search}%`);
    }

    // Apply kota filter
    if (kota) {
      query = query.eq('kota', kota);
    }

    // Apply status filter
    if (status) {
      query = query.eq('is_active', status === 'active');
    }

    // Apply sorting
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Execute query dengan pagination
    const { data: branches, error, count } = await query.range(from, to);

    if (error) throw error;

    // Get employee data for PIC in single query
    if (branches && branches.length > 0) {
      const picIds = branches.map(b => b.pic_id).filter(Boolean);
      if (picIds.length > 0) {
        const { data: employees } = await supabase
          .from('employees')
          .select('employee_id, full_name, email, job_position')
          .in('employee_id', picIds);
        
        const employeesMap = new Map(employees?.map(emp => [emp.employee_id, emp]) || []);
        branches.forEach(branch => {
          if (branch.pic_id) {
            branch.pic = employeesMap.get(branch.pic_id) || null;
          }
        });
      }
    }

    // Calculate stats from count and branches data
    const activeCount = branches?.filter(b => b.is_active).length || 0;
    const inactiveCount = (branches?.length || 0) - activeCount;

    return NextResponse.json({
      branches: branches || [],
      pagination: {
        current_page: page,
        total_pages: Math.ceil((count || 0) / limit),
        total_count: count || 0
      },
      stats: {
        total_count: count || 0,
        active_count: activeCount,
        inactive_count: inactiveCount
      }
    });
  } catch (error) {
    console.error('Error fetching branches:', error);
    return NextResponse.json(
      { error: 'Error fetching branches' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Creating branch with data:', body);
    
    const { data, error } = await supabase
      .from('branches')
      .insert([{
        kode_branch: body.kode_branch || null,
        nama_branch: body.nama_branch,
        alamat: body.alamat,
        kota: body.kota,
        provinsi: body.provinsi,
        brand: body.brand || null,
        jam_buka: body.jam_buka,
        jam_tutup: body.jam_tutup,
        hari_operasional: body.hari_operasional,
        pic_id: body.pic_id || null,
        is_active: body.is_active !== undefined ? body.is_active : true,
        badan: body.badan || null,
        created_by: 'SDE921SE0017',
        updated_by: null,
      }])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ branch: data[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating branch:', error);
    return NextResponse.json(
      { error: 'Error creating branch' },
      { status: 500 }
    );
  }
}