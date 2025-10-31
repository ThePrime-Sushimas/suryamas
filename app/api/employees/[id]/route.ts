import { supabase } from "@/lib/supabaseClient";
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const { data: employee, error } = await supabase
      .from('employees')
      .select('*')
      .eq('employee_id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Error fetching employee:', error);
    return NextResponse.json({ error: 'Error fetching employee' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const { data: employee, error } = await supabase
      .from('employees')
      .update(body)
      .eq('employee_id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ employee });
  } catch (error) {
    console.error('Error updating employee:', error);
    return NextResponse.json({ error: 'Error updating employee' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Soft delete
    const { error } = await supabase
      .from('employees')
      .update({ is_deleted: true })
      .eq('employee_id', id);

    if (error) throw error;

    return NextResponse.json({ message: 'Employee deleted successfully' });
  } catch (error) {
    console.error('Error deleting employee:', error);
    return NextResponse.json({ error: 'Error deleting employee' }, { status: 500 });
  }
}