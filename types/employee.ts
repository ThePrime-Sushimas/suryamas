// types/employee.ts
export enum EmployeeStatus {
    PERMANENT = 'Permanent',
    CONTRACT = 'Contract',
    PART_TIME = 'Part Time',
    RESIGN = 'Resign',
    TERMINATED = 'Terminated'
  }
  
  export enum OrganizationType {
    OFFICE = 'OFFICE',
    RESTAURANT = 'RESTAURANT',
    CENTRAL = 'CENTRAL'
  }
  
  export interface Employee {
    employee_id: string;
    full_name: string;
    organization: OrganizationType;
    job_position: string;
    join_date: string;
    resign_date: string | null;
    status_employee: EmployeeStatus;
    end_date: string | null;
    sign_date: string | null;
    email: string;
    birth_date: string;
    birth_place: string;
    citizen_id_address: string;
    npwp: string;
    ptkp_status: string;
    mobile_phone: string;
    branch_name: string;
    parent_branch_name: string;
    religion: string;
    gender: string;
    marital_status: string;
    bank_name: string;
    bank_account: string;
    bank_account_holder: string;
    currency: string;
    profile_picture_url: string | null;
    is_deleted: boolean;
  }