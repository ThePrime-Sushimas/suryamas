import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log('Fetching branch with ID:', id);
    
    const { data: branch, error } = await supabase
      .from('branches')
      .select('*')
      .eq('id_branch', id)
      .single();

    console.log('Branch query result:', { branch, error });

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!branch) {
      return NextResponse.json(
        { error: 'Branch not found' },
        { status: 404 }
      );
    }

    // Get employee info for PIC
    if (branch?.pic_id) {
      const { data: employee } = await supabase
        .from('employees')
        .select('employee_id, full_name, email, job_position')
        .eq('employee_id', branch.pic_id)
        .single();
      
      if (employee) {
        branch.pic = employee;
      }
    }

    return NextResponse.json({ branch });
  } catch (error) {
    console.error('Error fetching branch:', error);
    return NextResponse.json(
      { error: 'Branch not found' },
      { status: 404 }
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('branches')
      .update({
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
        badan: body.badan || null,
        is_active: body.is_active,
        updated_at: new Date().toISOString(),
        updated_by: 'SDE921SE0017' // Should be from auth session
      })
      .eq('id_branch', id)
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ branch: data[0] });
  } catch (error) {
    console.error('Error updating branch:', error);
    return NextResponse.json(
      { error: 'Error updating branch' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('branches')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString(),
        updated_by: 'SDE921SE0017'
      })
      .eq('id_branch', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error('Error deleting branch:', error);
    return NextResponse.json(
      { error: 'Error deleting branch' },
      { status: 500 }
    );
  }
}