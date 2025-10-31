import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('job_position')
      .not('job_position', 'is', null);
    
    if (error) throw error;

    const uniquePositions = [...new Set(data?.map(emp => emp.job_position).filter(Boolean))];
    
    return NextResponse.json({
      positions: uniquePositions
    });

  } catch (error) {
    return NextResponse.json({ positions: [] });
  }
}