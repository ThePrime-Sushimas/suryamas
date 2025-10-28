export interface Branch {
  id_branch: number;
  kode_branch: string;
  nama_branch: string;
  alamat: string;
  kota: string;
  provinsi: string;
  brand: string;
  jam_buka: string;
  jam_tutup: string;
  hari_operasional: 'Senin-Jumat' | 'Senin-Sabtu' | 'Setiap Hari' | 'Senin-Minggu';
  pic_id: string;
  is_active: boolean;
  pic?: {
    employee_id: string;
    full_name: string;
    email: string;
    job_position: string;
  };
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
  badan: string;
}

export type BranchStatus = 'active' | 'inactive';
export type HariOperasional = 'Senin-Jumat' | 'Senin-Sabtu' | 'Setiap Hari' | 'Senin-Minggu';