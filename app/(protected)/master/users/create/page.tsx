'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import AuthGuard from '@/components/auth/AuthGuard';
import Link from 'next/link';

interface Employee {
  employee_id: string;
  full_name: string;
  email: string;
  branch_name: string;
  job_position: string;
}

interface Role {
  id: number;
  role_code: string;
  role_name: string;
}

interface Branch {
  id_branch: number;
  kode_branch: string;
  nama_branch: string;
  kota: string;
}

interface FormData {
  employee_id: string;
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  role_id: string;
  primary_branch_id: string;
  additional_branch_ids: string[];
  is_active: boolean;
  must_change_password: boolean;
}

export default function CreateUserPage() {
  return (
    <AuthGuard requiredPermission="users.create">
      <CreateUserContent />
    </AuthGuard>
  );
}

function CreateUserContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState<FormData>({
    employee_id: '',
    username: '',
    email: '',
    password: '',
    confirm_password: '',
    role_id: '',
    primary_branch_id: '',
    additional_branch_ids: [],
    is_active: true,
    must_change_password: true
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Fetch data untuk dropdowns
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch employees tanpa user account
        const employeesResponse = await fetch('/api/employees?has_user_account=false&limit=100');
        if (employeesResponse.ok) {
          const employeesData = await employeesResponse.json();
          setEmployees(employeesData.employees);
        }

        // Fetch roles
        const rolesResponse = await fetch('/api/roles');
        if (rolesResponse.ok) {
          const rolesData = await rolesResponse.json();
          setRoles(rolesData.roles);
        }

        // Fetch branches
        const branchesResponse = await fetch('/api/branches?is_active=true');
        if (branchesResponse.ok) {
          const branchesData = await branchesResponse.json();
          setBranches(branchesData.branches);
        }
      // amazonq-ignore-next-line
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };

    fetchData();
  }, []);

  // Auto-fill form ketika employee dipilih
  useEffect(() => {
    if (selectedEmployee) {
      setFormData(prev => ({
        ...prev,
        employee_id: selectedEmployee.employee_id,
        email: selectedEmployee.email,
        username: generateUsername(selectedEmployee.email)
      }));
    }
  }, [selectedEmployee]);

  const generateUsername = (email: string): string => {
    return email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.employee_id) {
      newErrors.employee_id = 'Employee is required';
    }

    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      // amazonq-ignore-next-line
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (formData.password !== formData.confirm_password) {
      // amazonq-ignore-next-line
      newErrors.confirm_password = 'Passwords do not match';
    }

    if (!formData.role_id) {
      newErrors.role_id = 'Role is required';
    }

    if (!formData.primary_branch_id) {
      newErrors.primary_branch_id = 'Primary branch is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employee_id: formData.employee_id,
          username: formData.username,
          email: formData.email,
          password: formData.password,
          // amazonq-ignore-next-line
          role_id: parseInt(formData.role_id),
          primary_branch_id: parseInt(formData.primary_branch_id),
          additional_branch_ids: formData.additional_branch_ids.map(id => parseInt(id)),
          is_active: formData.is_active,
          must_change_password: formData.must_change_password
        }),
      });

      if (response.ok) {
        router.push('/master/users?message=User created successfully');
      } else {
        const errorData = await response.json();
        // amazonq-ignore-next-line
        alert(errorData.error || 'Failed to create user');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean | string[]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleEmployeeSelect = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowEmployeeModal(false);
    setSearchTerm('');
  };

  const filteredEmployees = employees.filter(employee =>
    employee.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.employee_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.job_position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Create New User</h1>
          <p className="text-gray-600 mt-2">
            Create a new system user account
          </p>
        </div>
        <Link href="/master/users">
          <Button variant="outline">
            Back to Users
          </Button>
        </Link>
      </div>

      {/* Main Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
              <CardDescription>
                Fill in the basic information for the new user account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Employee Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Employee *
                    </label>
                    {selectedEmployee ? (
                      <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-green-800">
                              {selectedEmployee.full_name}
                            </div>
                            <div className="text-sm text-green-600">
                              {selectedEmployee.employee_id} • {selectedEmployee.job_position}
                            </div>
                            <div className="text-sm text-green-600">
                              {selectedEmployee.branch_name} • {selectedEmployee.email}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEmployee(null);
                              setFormData(prev => ({
                                ...prev,
                                employee_id: '',
                                email: '',
                                username: ''
                              }));
                            }}
                          >
                            Change
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowEmployeeModal(true)}
                          className="w-full justify-start"
                        >
                          Select Employee
                        </Button>
                        {errors.employee_id && (
                          <p className="text-red-600 text-sm mt-1">{errors.employee_id}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Username */}
                  <div>
                    <Input
                      label="Username *"
                      value={formData.username}
                      onChange={(e) => handleInputChange('username', e.target.value)}
                      error={errors.username}
                      placeholder="Enter username"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <Input
                      label="Email *"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      error={errors.email}
                      placeholder="Enter email address"
                    />
                  </div>

                  {/* Password */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Input
                        label="Password *"
                        type="password"
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        error={errors.password}
                        placeholder="Enter password"
                      />
                    </div>
                    <div>
                      <Input
                        label="Confirm Password *"
                        type="password"
                        value={formData.confirm_password}
                        onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                        error={errors.confirm_password}
                        placeholder="Confirm password"
                      />
                    </div>
                  </div>

                  {/* Role and Branch */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Role *
                      </label>
                      <select
                        value={formData.role_id}
                        onChange={(e) => handleInputChange('role_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select Role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.role_name}
                          </option>
                        ))}
                      </select>
                      {errors.role_id && (
                        <p className="text-red-600 text-sm mt-1">{errors.role_id}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Primary Branch *
                      </label>
                      <select
                        value={formData.primary_branch_id}
                        onChange={(e) => handleInputChange('primary_branch_id', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Select Primary Branch</option>
                        {branches.map((branch) => (
                          <option key={branch.id_branch} value={branch.id_branch}>
                            {branch.nama_branch} - {branch.kota}
                          </option>
                        ))}
                      </select>
                      {errors.primary_branch_id && (
                        <p className="text-red-600 text-sm mt-1">{errors.primary_branch_id}</p>
                      )}
                    </div>
                  </div>

                  {/* Additional Branches */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Additional Branches (Optional)
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                      {branches
                        .filter(branch => branch.id_branch.toString() !== formData.primary_branch_id)
                        .map((branch) => (
                        <label key={branch.id_branch} className="flex items-center">
                          <input
                            type="checkbox"
                            checked={formData.additional_branch_ids.includes(branch.id_branch.toString())}
                            onChange={(e) => {
                              const branchId = branch.id_branch.toString();
                              if (e.target.checked) {
                                handleInputChange('additional_branch_ids', [...formData.additional_branch_ids, branchId]);
                              } else {
                                handleInputChange('additional_branch_ids', formData.additional_branch_ids.filter(id => id !== branchId));
                              }
                            }}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mr-2"
                          />
                          <span className="text-sm">{branch.nama_branch} - {branch.kota}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Select additional branches this user can access
                    </p>
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_active"
                        checked={formData.is_active}
                        onChange={(e) => handleInputChange('is_active', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                        Account is active
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="must_change_password"
                        checked={formData.must_change_password}
                        onChange={(e) => handleInputChange('must_change_password', e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="must_change_password" className="ml-2 block text-sm text-gray-900">
                        User must change password on first login
                      </label>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-4 pt-6 border-t">
                  <Button
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Create User'}
                  </Button>
                  <Link href="/master/users">
                    <Button type="button" variant="outline" disabled={loading}>
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Guidelines */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div className="text-sm text-gray-600">
                  Select an employee who doesn't have a user account yet
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div className="text-sm text-gray-600">
                  Username must be unique and at least 3 characters long
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div className="text-sm text-gray-600">
                  Password must be at least 6 characters long
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                <div className="text-sm text-gray-600">
                  Choose appropriate role based on job responsibilities
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Summary Preview */}
          {selectedEmployee && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Name:</span>
                    <span className="font-medium">{selectedEmployee.full_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Employee ID:</span>
                    <span className="font-medium">{selectedEmployee.employee_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Position:</span>
                    <span className="font-medium">{selectedEmployee.job_position}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Primary Branch:</span>
                    <span className="font-medium">
                      {branches.find(b => b.id_branch === parseInt(formData.primary_branch_id))?.nama_branch || 'Not selected'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Additional Branches:</span>
                    <span className="font-medium text-right">
                      {formData.additional_branch_ids.length > 0 
                        ? formData.additional_branch_ids.map(id => 
                            branches.find(b => b.id_branch === parseInt(id))?.nama_branch
                          ).join(', ')
                        : 'None'
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Role:</span>
                    <span className="font-medium">
                      {roles.find(r => r.id === parseInt(formData.role_id))?.role_name || 'Not selected'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Employee Selection Modal */}
      <Modal
        isOpen={showEmployeeModal}
        onClose={() => {
          setShowEmployeeModal(false);
          setSearchTerm('');
        }}
        title="Select Employee"
        size="lg"
      >
        <div className="space-y-4">
          <Input
            placeholder="Search employees by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          
          <div className="max-h-96 overflow-y-auto">
            {filteredEmployees.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm ? 'No employees found matching your search' : 'No employees available for user creation'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.employee_id}
                    className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleEmployeeSelect(employee)}
                  >
                    <div className="font-medium">{employee.full_name}</div>
                    <div className="text-sm text-gray-600">
                      {employee.employee_id} • {employee.job_position}
                    </div>
                    <div className="text-sm text-gray-500">
                      {employee.branch_name} • {employee.email}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setShowEmployeeModal(false);
                setSearchTerm('');
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}